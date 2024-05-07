import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag, Tendermint37Client, TxEvent } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { EventEmitter } from 'stream';
import { Event, IndexedTx, StargateClient } from '@cosmjs/stargate';
import { parseTxEvent } from './helpers';
import { NewBlockHeaderEvent } from '@cosmjs/tendermint-rpc';
import xs, { Stream } from 'xstream';

export enum CHANNEL {
  QUERY = 'query',
  SUBSCRIBE_TXS = 'subscribe_txs',
  SUBSCRIBE_HEADER = 'subscribe_new_header',
  ERROR = 'error',
  COMPLETE = 'complete'
}

export type BlockTimeStamp = {
  height: number;
  timestamp: number;
};

export type Tx = IndexedTx & {
  timestamp?: string;
};

export type Txs = {
  txs: Tx[];
  offset: number;
  total: number;
  queryTags: QueryTag[];
};

export type TxSubscribe = {
  event: Event[];
  hash: string;
  height: number;
  timestamp: string;
};

export type TxsSubscribe = {
  txs: TxSubscribe[];
};
/**
 * timeoutSleep is deprecated
 */
export type SyncDataOptions = {
  queryTags: QueryTag[];
  rpcUrl: string;
  offset?: number;
  limit?: number;
  interval?: number;
  timeoutSleep?: number;
  maxThreadLevel?: number;
};

export class SyncData extends EventEmitter {
  public options: SyncDataOptions;
  private tendermintClient: Tendermint37Client = undefined;
  private channelQuery: Stream<unknown>;
  private stargateClient: StargateClient;
  private timer: NodeJS.Timer

  constructor(options: SyncDataOptions) {
    super({ captureRejections: true });
    // override with default options
    this.options = {
      offset: options.offset ?? 1,
      limit: Math.min(5000, options.limit ?? 1000),
      interval: options.interval ?? 5000,
      timeoutSleep: options.timeoutSleep ?? 5000,
      maxThreadLevel: options.maxThreadLevel ?? 4,
      ...options
    };
  }

  public async start() {
    this.tendermintClient = await Tendermint37Client.connect(
      this.options.rpcUrl.replace(/(http)(s)?\:\/\//, 'ws$2://')
    );
    this.stargateClient = await StargateClient.connect(this.options.rpcUrl);
    const [channelTx, channelNewBlockHeader] = this.subscribeEvents() as [Stream<TxEvent>, Stream<NewBlockHeaderEvent>];
    this.timer = setTimeout(this.queryTendermintParallel,this.options.interval, this.stargateClient)
    return [channelTx, channelNewBlockHeader];
  }

  public destroy() {
    // end stream
    this.channelQuery.endWhen(xs.empty());
    clearTimeout(this.timer);
    Object.values(CHANNEL).forEach((channel) => {
      this.removeAllListeners(channel);
    });
  }

  parseTxResponse(tx: IndexedTx): Tx {
    return {
      ...tx,
      timestamp: (tx as any).timestamp
    };
  }

  private calculateMaxSearchHeight(offset: number, limit: number, currentHeight: number): number {
    return Math.min(offset + limit || 1, currentHeight);
  }

  private buildTendermintQuery(queryTags: QueryTag[], oldOffset: number, newOffset: number) {
    return buildQuery({
      tags: queryTags,
      raw: `tx.height >= ${oldOffset} AND tx.height < ${newOffset}`
    });
  }

  private calculateOffsetParallel(threadId: number, offset: number) {
    return threadId * this.options.limit + offset;
  }

  private calculateParallelLevel(offset: number, currentHeight: number) {
    // if negative then default is 1. If larger than 4 then max is 4
    return Math.max(
      1,
      Math.min(this.options.maxThreadLevel, Math.floor((currentHeight - offset) / this.options.limit))
    );
  }

  private queryTendermintParallel = async (client: StargateClient) => {
    try {
      const { queryTags, limit, offset } = this.options;
      let currentHeight = await client.getHeight();
      if(currentHeight > offset) {
        let parallelLevel = this.calculateParallelLevel(offset, currentHeight);
        let threads = [];
        for (let i = 0; i < parallelLevel; i++) {
          threads.push(this.queryTendermint(client, i, offset, currentHeight));
        }
        const results: Tx[][] = await Promise.all(threads);
        let storedResults: Tx[] = [];
        for (let result of results) {
          storedResults.push(...result);
        }
        // calculate the next offset
        this.options.offset = this.calculateMaxSearchHeight(
          // parallel - 1 because its the final thread id which handles the highest offset possible assuming we have processed all height before it
          this.calculateOffsetParallel(parallelLevel - 1, offset),
          limit,
          currentHeight
        );
        this.emit(CHANNEL.QUERY, {
          txs: storedResults,
          offset: this.options.offset,
          queryTags
        });
      }
    } catch (error) {
      console.log('error query tendermint parallel: ', error);
      // this makes sure that the stream doesn't stop and keeps reading forever even when there's an error
    } finally {
      this.timer = setTimeout(this.queryTendermintParallel, this.options.interval, client);
    }
  };

  private async queryTendermint(
    stargateClient: StargateClient,
    threadId: number,
    offset: number,
    currentHeight: number
  ): Promise<Tx[]> {
    const { queryTags } = this.options;
    const oldOffset = this.calculateOffsetParallel(threadId, offset);
    const newOffset = this.calculateMaxSearchHeight(oldOffset, this.options.limit, currentHeight);
    if(newOffset > oldOffset) {
      const query = this.buildTendermintQuery(
        queryTags,
        oldOffset,
        this.calculateMaxSearchHeight(oldOffset, this.options.limit, currentHeight)
      );
      const result = await stargateClient.searchTx(query);
      const storedResults = result.map((tx) => this.parseTxResponse(tx));
      return storedResults;
    }
    return []
  }

  private subscribeEvents() {
    const { queryTags } = this.options;
    const query = buildQuery({ tags: queryTags });

    // subscribe the tx by filter
    const channelTx = this.tendermintClient.subscribeTx(query);

    // subscribe the new blockHeader for get timestamp
    const channelNewBlockHeader = this.tendermintClient.subscribeNewBlockHeader();
    channelNewBlockHeader.addListener({
      next: (data) => {
        this.emit(CHANNEL.SUBSCRIBE_HEADER, {
          height: data.height,
          timestamp: data.time.toISOString()
        });
      },
      error: (error) => {
        console.log('On error channelNewBlockHeader stream ', error);
        this.emit(CHANNEL.ERROR, error);
      },
      complete: () => {
        console.log('On complete channelNewBlockHeader stream');
        this.emit(CHANNEL.COMPLETE);
      }
    });

    // to get timeStamp from 2 channel
    channelTx.addListener({
      next: (event: TxEvent & { timestamp: string }) => {
        const parsedTxEvent = parseTxEvent(event);
        this.emit(CHANNEL.SUBSCRIBE_TXS, {
          ...parsedTxEvent,
          height: event.height,
          timestamp: event.timestamp
        });
      },
      error: (error) => {
        console.log('On error combinedChannel stream ', error);
        this.emit(CHANNEL.ERROR, error);
      },
      complete: () => {
        console.log('On complete combinedChannel stream');
        this.emit(CHANNEL.COMPLETE);
      }
    });

    return [channelTx, channelNewBlockHeader];
  }
}



export * from './helpers';
