import { SyncData } from '../src/index';
import { IndexedTx } from '@cosmjs/stargate';
import { QueryTag } from '@cosmjs/tendermint-rpc/build/tendermint37';

describe('test-parseTxResponse', () => {
  let txResponse: IndexedTx = {
    tx: Buffer.from(''),
    code: 0,
    hash: 'foo',
    height: 1,
    txIndex: 1,
    rawLog: '',
    msgResponses: [],
    gasUsed: 0,
    gasWanted: 0,
    events: []
  };

  const myPrivateFunc = jest.spyOn(SyncData.prototype as any, 'queryTendermint');
  myPrivateFunc.mockImplementation(() => {});
  const syncData = new SyncData({ rpcUrl: '', queryTags: [] });

  it('test-parseTxResponse-should-include-all-attributes-of-TxResponse', () => {
    // prepare
    (txResponse as any).timestamp = '1';

    // Act
    const tx = syncData.parseTxResponse(txResponse);

    // Assert
    expect(tx.height).toEqual(1);
    expect(tx.txIndex).toEqual(1);
    expect(tx.timestamp).toEqual('1');
  });

  it.each<[number, number, number, number]>([
    [1, 2, 3, 3],
    [1, 2, 0, 0],
    [1, 2, 4, 3]
  ])(
    'test-calculateMaxSearchHeight-should-return-correct-new-offset',
    (offset, limit, currentHeight, expectedNewOffset) => {
      // Act
      const syncDataProto = Object.getPrototypeOf(syncData);
      const result = syncDataProto.calculateMaxSearchHeight(offset, limit, currentHeight);

      // Assert
      expect(result).toEqual(expectedNewOffset);
    }
  );

  it.each<[QueryTag[], number, number, string]>([
    [[{ key: 'foo', value: 'bar' }], 2, 3, "foo='bar' AND tx.height >= 2 AND tx.height < 3"],
    [[], 2, 3, 'tx.height >= 2 AND tx.height < 3']
  ])(
    'test-buildTendermintQuery-should-return-correct-build-query',
    (queryTags, oldOffset, newOffset, expectedQuery) => {
      // Act
      const syncDataProto = Object.getPrototypeOf(syncData);
      const result = syncDataProto.buildTendermintQuery(queryTags, oldOffset, newOffset);

      // Assert
      expect(result).toEqual(expectedQuery);
    }
  );
});
