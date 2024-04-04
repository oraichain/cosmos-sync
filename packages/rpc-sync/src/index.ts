import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { Readable, Writable } from 'stream';
import { IndexedTx, StargateClient } from '@cosmjs/stargate';
import { Tendermint34Client, tendermint34 } from '@cosmjs/tendermint-rpc';

export type Tx = IndexedTx & {
  timestamp?: string;
};

export type Txs = {
  txs: Tx[];
  offset: number;
  total: number;
  queryTags: QueryTag[];
};

export abstract class WriteData extends Writable {
  constructor() {
    super({ objectMode: true });
  }

  async _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error) => void): Promise<void> {
    let success = false;
    try {
      success = await this.process(chunk);
    } catch (error) {
      console.log('error writing data: ', error);
    } finally {
      if (success) callback();
    }
  }

  abstract process(txs: Txs): Promise<boolean>;
}

export type SyncDataOptions = {
  queryTags: QueryTag[];
  rpcUrl: string;
  offset?: number;
  limit?: number;
  interval?: number;
  timeoutSleep?: number;
  maxThreadLevel?: number;
};

export class SyncData extends Readable {
  public options: SyncDataOptions;
  constructor(options: SyncDataOptions) {
    super({ objectMode: true });
    // override with default options
    this.options = {
      offset: options.offset ?? 1,
      limit: Math.min(5000, options.limit ?? 1000),
      interval: options.interval ?? 5000,
      timeoutSleep: options.timeoutSleep ?? 5000,
      maxThreadLevel: options.maxThreadLevel ?? 4,
      ...options
    };
    this.queryTendermintParallel();
  }

  _read() {}

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

  private async queryTendermintParallel() {
    while (true) {
      try {
        const { rpcUrl, offset, queryTags } = this.options;
        const tendermint = await Tendermint34Client.connect(rpcUrl);
        const currentHeight = (await tendermint.status()).syncInfo.latestBlockHeight;
        let parallelLevel = this.calculateParallelLevel(offset, currentHeight);
        let threads = [];
        for (let i = 0; i < parallelLevel; i++) {
          threads.push(this.queryTendermint(i, offset, currentHeight));
        }
        const results: Tx[][] = await Promise.all(threads);
        let storedResults: Tx[] = [];
        for (let result of results) {
          storedResults.push(...result);
        }
        // console.log('stored results length: ', storedResults.length);
        // calculate the next offset
        this.options.offset = this.calculateMaxSearchHeight(
          // parallel - 1 because its the final thread id which handles the highest offset possible assuming we have processed all height before it
          this.calculateOffsetParallel(parallelLevel - 1, offset),
          this.options.limit,
          currentHeight
        );
        this.push({
          txs: storedResults,
          offset: this.options.offset,
          queryTags
        });
      } catch (error) {
        console.log('error query tendermint parallel: ', error);
      } finally {
        await new Promise((resolve) => setTimeout(resolve, this.options.interval));
      }
    }
  }

  private async queryTendermint(threadId: number, offset: number, currentHeight: number): Promise<Tx[]> {
    const { queryTags, rpcUrl, timeoutSleep } = this.options;
    const stargateClient = await StargateClient.connect(rpcUrl);
    const newOffset = this.calculateOffsetParallel(threadId, offset);
    const query = this.buildTendermintQuery(
      queryTags,
      newOffset,
      this.calculateMaxSearchHeight(newOffset, this.options.limit, currentHeight)
    );
    while (true) {
      try {
        const result = await stargateClient.searchTx(query);
        const storedResults = result.map((tx) => this.parseTxResponse(tx));
        // console.log('thread id: ', threadId, 'stored result length: ', storedResults.length, 'query: ', query);
        return storedResults;
      } catch (error) {
        console.log('error query stargateClient tx search: ', error);
        await new Promise((resolve) => setTimeout(resolve, timeoutSleep));
        // only returns if search successfully
      }
    }
  }
}
