import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { Event as RpcEvent } from '@cosmjs/tendermint-rpc';
import { Event } from 'cosmjs-types/tendermint/abci/types';
import { Readable, Writable } from 'stream';

export type Tx = {
  hash: string;
  height: number;
  events: readonly Event[];
};

export type Txs = {
  txs: Tx[];
  total: number;
};

abstract class WriteData extends Writable {
  constructor() {
    super();
  }

  async _write(chunk: any, encoding, next) {
    try {
      await this.process(chunk);
    } catch (error) {
      console.log('error writing data: ', error);
    } finally {
      next();
    }
  }

  abstract process(chunk: any): any;
}

abstract class SyncData extends Readable {
  private _queryTags: QueryTag[];
  private _rpcUrl: string;
  private _interval: number;
  public offset: number;
  public limit: number;
  constructor({
    queryTags,
    rpcUrl,
    offset = 1,
    limit = 100,
    interval = 5000
  }: {
    queryTags: QueryTag[];
    rpcUrl: string;
    offset?: number;
    limit?: number;
    interval?: number;
  }) {
    super();
    this._rpcUrl = rpcUrl;
    this._queryTags = queryTags;
    this.offset = offset;
    this.limit = limit;
    this._interval = interval;
  }
  _read() {
    this.queryTendermint();
  }

  private convertEventAttrsToAscii(events: readonly RpcEvent[]): Event[] {
    return events.map((event) => ({
      ...event,
      attributes: event.attributes.map((attr) => ({
        index: (attr as any).index,
        key: Buffer.from(attr.key).toString('ascii'),
        value: Buffer.from(attr.value).toString('ascii')
      }))
    }));
  }

  private async queryTendermint() {
    const tendermint = await Tendermint34Client.connect(this._rpcUrl);
    const query = buildQuery({ tags: this._queryTags });
    while (true) {
      try {
        const result = await tendermint.txSearch({
          query,
          page: this.offset,
          per_page: this.limit
        });
        const storedResults = result.txs.map((tx) => ({
          ...tx,
          hash: Buffer.from(tx.hash).toString('hex').toUpperCase(),
          events: this.convertEventAttrsToAscii(tx.result.events)
        }));
        await new Promise((resolve) => setTimeout(resolve, this.interval));
        await this.query({ txs: storedResults, total: result.totalCount });
      } catch (error) {
        console.log('error query tendermint tx search: ', error);
        // only returns if search successfully
      }
    }
  }

  abstract query(txs: Txs): any;

  get queryTags() {
    return this._queryTags;
  }

  get rpcUrl() {
    return this._rpcUrl;
  }

  get interval() {
    return this._interval;
  }
}

export { WriteData, SyncData };
