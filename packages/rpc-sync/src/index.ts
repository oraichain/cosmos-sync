import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { Readable, Writable } from 'stream';
import { IndexedTx, StargateClient } from '@cosmjs/stargate';

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
};

export class SyncData extends Readable {
  public options: SyncDataOptions;
  constructor(options: SyncDataOptions) {
    super({ objectMode: true });
    // override with default options
    this.options = {
      offset: options.offset ?? 1,
      limit: options.limit ?? 1000,
      interval: options.interval ?? 5000,
      ...options
    };
    this.queryTendermint();
  }

  _read() {}

  parseTxResponse(tx: IndexedTx): Tx {
    return {
      ...tx,
      timestamp: (tx as any).timestamp
    };
  }

  private calculateMaxSearchHeight(offset: number, limit: number, currentHeight: number): number {
    return Math.min(offset + limit, currentHeight);
  }

  private buildTendermintQuery(queryTags: QueryTag[], oldOffset: number, newOffset: number) {
    return buildQuery({
      tags: queryTags,
      raw: `tx.height >= ${oldOffset} AND tx.height <= ${newOffset}`
    });
  }

  private async queryTendermint() {
    const { offset, limit, interval, queryTags, rpcUrl } = this.options;
    const stargateClient = await StargateClient.connect(rpcUrl);
    const currentHeight = (await stargateClient.getBlock()).header.height;
    this.options.offset = this.calculateMaxSearchHeight(offset, limit, currentHeight);
    const query = this.buildTendermintQuery(queryTags, offset, this.options.offset);
    while (true) {
      try {
        const result = await stargateClient.searchTx(query);
        const storedResults = result.map((tx) => this.parseTxResponse(tx));
        this.push({
          txs: storedResults,
          offset: this.options.offset,
          queryTags
        });
      } catch (error) {
        console.log('error query stargateClient tx search: ', error);
        // only returns if search successfully
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      await this.queryTendermint();
    }
  }
}
