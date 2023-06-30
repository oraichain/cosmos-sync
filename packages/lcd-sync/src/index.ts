import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { Readable, Writable } from 'stream';
import AbortSignal from 'abort-controller';
import { GetTxsEventResponse } from 'cosmjs-types/cosmos/tx/v1beta1/service';
import { TxResponse } from 'cosmjs-types/cosmos/base/abci/v1beta1/abci';

export type Txs = {
  txs: TxResponse[];
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
  lcdUrl: string;
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
    this.queryLcd();
  }

  _read() {}

  private async fetchWithTimeout() {
    const controller = new AbortSignal();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);
    const { signal } = controller;
    const { lcdUrl, offset, limit, queryTags } = this.options;

    const url = `${lcdUrl}/cosmos/tx/v1beta1/txs?${this.parseQueryTags(
      queryTags
    )}pagination.offset=${offset}&pagination.limit=${limit}`;
    const response: GetTxsEventResponse = await fetch(url, {
      signal: signal as any
    }).then((res) => {
      clearTimeout(timeoutId);
      return res.json();
    });
    return response;
  }

  private parseQueryTags(queryTags: QueryTag[]): string {
    let finalQuery = '';
    for (let tag of queryTags) {
      finalQuery = finalQuery.concat(`events=${encodeURIComponent(`${tag.key}='${tag.value}'`)}&`);
    }
    return finalQuery;
  }

  private async queryLcd() {
    const { offset, limit, interval, queryTags } = this.options;
    while (true) {
      try {
        const { txResponses, pagination } = await this.fetchWithTimeout();
        const total = pagination.total;
        this.options.offset = total ? Math.min(offset + limit, total.toNumber()) : offset + limit;
        this.push({
          txs: txResponses,
          total,
          offset: this.options.offset,
          queryTags
        });
      } catch (error) {
        console.log('error query tendermint tx search: ', error);
        // only returns if search successfully
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      await this.queryLcd();
    }
  }
}
