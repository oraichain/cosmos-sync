import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
import { EventEmitter } from 'stream';
import { GetTxsEventResponse } from 'cosmjs-types/cosmos/tx/v1beta1/service';
import { StringEvent, TxResponse } from 'cosmjs-types/cosmos/base/abci/v1beta1/abci';

export type ModifiedTxResponse = Omit<TxResponse, 'events'> & {
  events: StringEvent[];
};

export type TxsEventResponse = Omit<GetTxsEventResponse, 'txResponses'> & {
  tx_responses: ModifiedTxResponse[];
};

export type Txs = {
  txs: ModifiedTxResponse[];
  offset: number;
  total: number;
  queryTags: QueryTag[];
};

export type SyncDataOptions = {
  queryTags: QueryTag[];
  lcdUrl: string;
  offset?: number;
  limit?: number;
  timeout?: number;
  interval?: number;
};

export class SyncData extends EventEmitter {
  public options: SyncDataOptions;
  private running = false;
  private timer = undefined;
  constructor(options: SyncDataOptions) {
    super({ captureRejections: true });
    // override with default options
    this.options = { offset: 1, limit: 100, timeout: 30000, interval: 5000, ...options };

    this.queryLcd();
  }

  public start() {
    this.running = true;
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

  private async fetchWithTimeout() {
    const { lcdUrl, offset, limit, queryTags, timeout } = this.options;

    const url = `${lcdUrl}/cosmos/tx/v1beta1/txs?${this.parseQueryTags(
      queryTags
    )}pagination.offset=${offset}&pagination.limit=${limit}`;

    const response: TxsEventResponse = await fetch(url, {
      signal: AbortSignal.timeout(timeout)
    }).then((res) => res.json());
    return response;
  }

  private parseQueryTags(queryTags: QueryTag[]): string {
    let finalQuery = '';
    for (let tag of queryTags) {
      finalQuery = finalQuery.concat(`events=${encodeURIComponent(`${tag.key}='${tag.value}'`)}&`);
    }
    return finalQuery;
  }

  private calculateNewOffset(offset: number, limit: number, total: Long | number | BigInt | undefined): number {
    return total ? Math.min(offset + limit, parseInt(total.toString())) : offset + limit;
  }

  queryLcd = async () => {
    const { offset, limit, interval, queryTags } = this.options;

    // wait until running is on
    if (!this.running) return (this.timer = setTimeout(this.queryLcd, interval));

    try {
      const { tx_responses, total } = await this.fetchWithTimeout();
      this.options.offset = this.calculateNewOffset(offset, limit, total);
      this.emit('data', {
        txs: tx_responses,
        total,
        offset: this.options.offset,
        queryTags
      });
    } catch (error) {
      console.log('error query tendermint tx search: ', error);
      // only returns if search successfully
      throw error;
    } finally {
      this.timer = setTimeout(this.queryLcd, interval);
    }
  };
}
