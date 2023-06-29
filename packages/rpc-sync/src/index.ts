import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { Event } from 'cosmjs-types/tendermint/abci/types';
import { Readable, Writable } from 'stream';

export type Tx = {
  hash: string;
  height: number;
  timestamp?: string;
  events: readonly Event[];
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
    this.options = { offset: 1, limit: 100, interval: 5000, ...options };
    this.queryTendermint();
  }

  _read() {}

  private async queryTendermint() {
    const { offset, limit, interval, queryTags, rpcUrl } = this.options;
    const tendermint = await Tendermint34Client.connect(rpcUrl);
    const query = buildQuery({ tags: queryTags });
    while (true) {
      try {
        const result = await tendermint.txSearch({
          query,
          page: offset,
          per_page: limit
        });
        const storedResults = result.txs.map((tx) => ({
          ...tx,
          hash: Buffer.from(tx.hash).toString('hex').toUpperCase(),
          events: tx.result.events.map((event) => ({
            ...event,
            attributes: event.attributes.map((attr) => ({
              ...attr,
              key: Buffer.from(attr.key).toString(),
              value: Buffer.from(attr.value).toString()
            }))
          }))
        }));
        this.options.offset = offset * limit > result.totalCount ? offset : offset + 1;
        this.push({
          txs: storedResults,
          total: result.totalCount,
          offset: this.options.offset,
          queryTags
        });
      } catch (error) {
        console.log('error query tendermint tx search: ', error);
        // only returns if search successfully
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      await this.queryTendermint();
    }
  }
}
