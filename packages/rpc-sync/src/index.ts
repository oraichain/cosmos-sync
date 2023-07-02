import { Tendermint34Client, TxResponse } from '@cosmjs/tendermint-rpc';
import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { StringEvent } from 'cosmjs-types/cosmos/base/abci/v1beta1/abci';
import { Readable, Writable } from 'stream';

export type Tx = Omit<TxResponse, 'hash'> & {
  hash: string;
  timestamp?: string;
  events: readonly StringEvent[];
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

  parseTxResponse(tx: TxResponse): Tx {
    return {
      ...tx,
      hash: Buffer.from(tx.hash).toString('hex').toUpperCase(),
      events: tx.result.events.map((event) => ({
        ...event,
        attributes: event.attributes.map((attr) => ({
          ...attr,
          index: (attr as any).index,
          key: Buffer.from(attr.key).toString(),
          value: Buffer.from(attr.value).toString()
        }))
      }))
    };
  }

  private calculateMaxSearchHeight(offset: number, limit: number, currentHeight: number): number {
    if (offset > currentHeight || offset + limit > currentHeight) return currentHeight;
    if (offset + limit <= currentHeight) return offset + limit;
  }

  private async queryTendermint() {
    const { offset, limit, interval, queryTags, rpcUrl } = this.options;
    const tendermint = await Tendermint34Client.connect(rpcUrl);
    const currentHeight = (await tendermint.block()).block.header.height;
    this.options.offset = this.calculateMaxSearchHeight(offset, limit, currentHeight);
    const query = buildQuery({
      tags: queryTags,
      raw: `tx.height > ${offset} AND tx.height <= ${this.options.offset}`
    });
    while (true) {
      try {
        const result = await tendermint.txSearch({
          query
        });
        const storedResults = result.txs.map((tx) => this.parseTxResponse(tx));
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
