import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { EventEmitter, Readable, Writable } from 'stream';
import { IndexedTx, StargateClient } from '@cosmjs/stargate';
import { exit } from 'process';

export type Tx = IndexedTx & {
  timestamp?: string;
};

export type Txs = {
  txs: Tx[];
  offset: number;
  total: number;
  queryTags: QueryTag[];
};

/**
 * timeoutSleep is deprepcated
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
    this.running = true;
    const stargateClient = await StargateClient.connect(this.options.rpcUrl);
    await this.queryTendermintParallel(stargateClient);
  }

  public stop() {
    this.running = false;
  }

  public destroy() {
    this.running = false;
    clearTimeout(this.timer);
    // avoid leak
    this.removeAllListeners('data');
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
    // sleep so that we can delay the number of RPC calls per sec, reducing the traffic load
    const { queryTags, interval, limit, offset } = this.options;

    // wait until running is on
    if (!this.running) return (this.timer = setTimeout(() => this.queryTendermintParallel(client), interval));
    try {
      const currentHeight = await client.getHeight();
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
      this.emit('data', {
        txs: storedResults,
        offset: this.options.offset,
        queryTags
      });
    } catch (error) {
      console.log('error query tendermint parallel: ', error);
      // this makes sure that the stream doesn't stop and keeps reading forever even when there's an error
      throw error;
    } finally {
      this.timer = setTimeout(() => this.queryTendermintParallel(client), interval);
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
    // console.log('thread id: ', threadId, 'stored result length: ', storedResults.length, 'query: ', query);
    return storedResults;
  }
}
