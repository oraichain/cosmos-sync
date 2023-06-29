import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { SyncData } from '../src/index';

describe('foobar', () => {
  it('foo', async () => {
    console.log('foo');
    const tendermintSpy = jest.spyOn(Tendermint34Client, 'connect');
    tendermintSpy.mockImplementation((endpoint): any => {
      const obj = {
        txSearch: () => {
          return {
            txs: [],
            totalCount: 1
          };
        }
      };
      return obj;
    });
    const sync = new SyncData({ rpcUrl: '', queryTags: [] });
  });
});
