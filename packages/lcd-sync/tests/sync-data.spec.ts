import { SyncData, Txs } from '../src/index';
import timer from 'timers/promises';

describe('test-sync-data', () => {
  const syncData = new SyncData({ lcdUrl: 'https://lcd.orai.io', queryTags: [], interval: 500 });

  it('test-lcd-sync', async () => {
    syncData.on('data', (data: Txs) => {
      console.log(data.txs.length);
    });

    syncData.start();

    // should run 2 times
    await timer.setTimeout(syncData.options.interval! * 2.5);
    syncData.destroy();
  });
});
