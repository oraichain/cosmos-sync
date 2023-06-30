import { QueryTag, Tendermint34Client, TxResponse } from '@cosmjs/tendermint-rpc';
import { SyncData } from '../src/index';

describe('test-parseTxResponse', () => {
  const txResponse: TxResponse = {
    tx: Buffer.from(''),
    hash: Buffer.from('foo'),
    height: 1,
    index: 1,
    result: {
      code: 0,
      events: [],
      gasUsed: 0,
      gasWanted: 0
    }
  };

  const queryLcdSpy = jest.spyOn(SyncData.prototype as any, 'queryLcd');
  queryLcdSpy.mockImplementation(() => {});
  const syncData = new SyncData({ lcdUrl: '', queryTags: [] });

  it.each<[QueryTag[], string]>([
    [[{ key: 'foo', value: 'bar' }], `events=${encodeURIComponent("foo='bar'")}&`],
    [[], '']
  ])('test-parseQueryTags-should-return-correct-encoded-uri-query-string', (tags, exepectedTagString) => {
    // Act
    const syncDataProto = Object.getPrototypeOf(syncData);
    const result = syncDataProto.parseQueryTags(tags);

    // Assert
    expect(result).toEqual(exepectedTagString);
  });

  it.each<[number, number, Long | number | undefined, number]>([
    [0, 0, 0, 0],
    [1, 2, undefined, 3],
    [1, 2, 4, 3],
    [1, 2, 1, 1]
  ])('test-calculateNewOffset-should-return-correct-new-offset', (offset, limit, total, expectedNewOffset) => {
    // Act
    const syncDataProto = Object.getPrototypeOf(syncData);
    const result = syncDataProto.calculateNewOffset(offset, limit, total);

    // Assert
    expect(result).toEqual(expectedNewOffset);
  });
});
