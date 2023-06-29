import { Tendermint34Client, Event as RpcEvent } from '@cosmjs/tendermint-rpc';
import { buildQuery } from '@cosmjs/tendermint-rpc/build/tendermint37/requests';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';
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

export abstract class WriteData extends Writable {
  constructor() {
    super({ objectMode: true });
  }

  async _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error) => void): Promise<void> {
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

export abstract class SyncData extends Readable {
  constructor(public readonly options: SyncDataOptions) {
    super();
  }

  _read() {
    this.queryTendermint();
  }

  private async queryTendermint() {
    const tendermint = await Tendermint34Client.connect(this.options.rpcUrl);
    const query = buildQuery({ tags: this.options.queryTags });
    while (true) {
      try {
        const result = await tendermint.txSearch({
          query,
          page: this.options.offset,
          per_page: this.options.limit
        });
        const storedResults = result.txs.map((tx) => ({
          ...tx,
          hash: Buffer.from(tx.hash).toString('hex').toUpperCase(),
          events: tx.result.events
        }));
        await new Promise((resolve) => setTimeout(resolve, this.options.interval));
        this.push({ txs: storedResults, total: result.totalCount });
      } catch (error) {
        console.log('error query tendermint tx search: ', error);
        // only returns if search successfully
      }
    }
  }
}
