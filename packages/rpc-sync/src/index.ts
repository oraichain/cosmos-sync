import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag, Tendermint37Client, TxEvent } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { EventEmitter } from 'stream';
import { Event, IndexedTx, StargateClient } from '@cosmjs/stargate';
import { parseTxEvent } from './helpers';
import { NewBlockHeaderEvent } from '@cosmjs/tendermint-rpc';
import { Stream } from 'xstream';

export enum CHANNEL {
  QUERY = 'query',
  SUBSCRIBE_TXS = 'subscribe_txs',
  SUBSCRIBE_HEADER = 'subscribe_new_header',
  ERROR = 'error',
  COMPLETE = 'complete'
}

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
  private running = false;
  private timer = undefined;
  private tendermintClient: Tendermint37Client = undefined;
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
    this.tendermintClient = await Tendermint37Client.connect(this.options.rpcUrl.replace('http', 'ws')).catch((err) =>
      { console.log(err)
        throw err
      }
    )
    const stargateClient = await StargateClient.create(this.tendermintClient);
    const [channelTx, channelNewBlockHeader] = (await this.subscribeEvents()) as [
      Stream<TxEvent>,
      Stream<NewBlockHeaderEvent>
    ];
    // Query the from offset to blockNewHeader.height - 1
    channelNewBlockHeader.addListener({
      next: (data) => {
        if (!this.running) {
          this.running = true;
          this.queryTendermintParallel(stargateClient, data.height - 1);
        }
      }
    });
    return [channelTx, channelNewBlockHeader];
  }

  public stop() {
    this.running = false;
  }

  public destroy() {
    this.running = false;
    clearTimeout(this.timer);
    // avoid leak
    Object.values(CHANNEL).forEach((channel) => {
      this.removeAllListeners(channel);
    })
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

  private queryTendermintParallel = async (client: StargateClient, currentHeight: number) => {
    // sleep so that we can delay the number of RPC calls per sec, reducing the traffic load
    const { queryTags, interval, limit, offset } = this.options;
    // wait until running is on
    if (!this.running)
      return (this.timer = setTimeout(() => this.queryTendermintParallel(client, currentHeight), interval));
    try {
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
    } catch (error) {
      console.log('error query tendermint parallel: ', error);
      // this makes sure that the stream doesn't stop and keeps reading forever even when there's an error
      throw error;
    } finally {
      this.timer = setTimeout(() => this.queryTendermintParallel(client, currentHeight), interval);
    }
  };

  private async queryTendermint(
    stargateClient: StargateClient,
    threadId: number,
    offset: number,
    currentHeight: number
  ): Promise<Tx[]> {
    const { queryTags } = this.options;
    const newOffset = this.calculateOffsetParallel(threadId, offset);
    const query = this.buildTendermintQuery(
      queryTags,
      newOffset,
      this.calculateMaxSearchHeight(newOffset, this.options.limit, currentHeight)
    );
    const result = await stargateClient.searchTx(query);
    const storedResults = result.map((tx) => this.parseTxResponse(tx));
    return storedResults;
  }

  private async subscribeEvents() {
    const { queryTags } = this.options;
    const query = buildQuery({ tags: queryTags });

    // subscribe the tx by filter
    const channelTx = this.tendermintClient.subscribeTx(query);

    channelTx.addListener({
      next: (data) => {
        const parsedTxEvent = parseTxEvent(data);
        this.emit(CHANNEL.SUBSCRIBE_TXS, parsedTxEvent);
      },
      error: (error) => {
        console.log('On error channelTx stream ', error);
        this.emit(CHANNEL.ERROR, error);
      },
      complete: () => {
        console.log('On complete channelTx stream');
        this.emit(CHANNEL.COMPLETE);
      }
    });
    // subscribe the new blockHeader for get timestamp
    const channelNewBlockHeader = this.tendermintClient.subscribeNewBlockHeader();

    channelNewBlockHeader.addListener({
      next: (data) => {
        this.emit(CHANNEL.SUBSCRIBE_HEADER, {
          height: data.height,
          timestamp: Math.ceil(data.time.getTime() / 1000)
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

    return [channelTx, channelNewBlockHeader];
  }
}

// (async () => {
//   const options: SyncDataOptions = {
//     queryTags: [
//       { key: 'wasm._contract_address', value: 'orai1nt58gcu4e63v7k55phnr3gaym9tvk3q4apqzqccjuwppgjuyjy6sxk8yzp' }
//     ],
//     rpcUrl: 'http://3.14.142.99:26657',
//     offset: 18000860
//   };
//   const sync = new SyncData(options);
//   const [channelTx, channelNewBlockHeader] = await sync.start();

//   sync.on(CHANNEL.SUBSCRIBE_TXS, (data) => {
//     console.log({ data });
//   });

//   sync.on(CHANNEL.SUBSCRIBE_HEADER, (data) => {
//     console.log({ data });
//   });

//   sync.on(CHANNEL.COMPLETE, (data) => {
//     console.log('complete');
//   });

//   sync.on(CHANNEL.QUERY, (data) => {
//     console.log(data);
//   });

//   await new Promise((resolve) => setTimeout(resolve, 10000));
// })();
