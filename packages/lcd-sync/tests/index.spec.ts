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

  // it('test-parseTxResponse-hash-should-convert-to-hex-form-and-to-upper-case', () => {
  //   // Act
  //   const tx = syncData.parseTxResponse(txResponse);

  //   // Assert
  //   expect(tx.hash).toEqual(Buffer.from('foo').toString('hex').toUpperCase());
  // });

  // it('test-parseTxResponse-hash-should-include-all-attributes-of-events-attribute', () => {
  //   // Arrange
  //   const modifiedTxResponse = {
  //     ...txResponse,
  //     result: { ...txResponse.result, events: [{ type: 'foobar', attributes: [] }] }
  //   };

  //   // Act
  //   const tx = syncData.parseTxResponse(modifiedTxResponse);

  //   // Assert
  //   expect(tx.events[0].type).toEqual('foobar');
  // });

  // it('test-parseTxResponse-hash-should-include-convert-attributes-from-buffer-to-string', () => {
  //   // Arrange
  //   const modifiedTxResponse = {
  //     ...txResponse,
  //     result: {
  //       ...txResponse.result,
  //       events: [{ type: 'foobar', attributes: [{ key: Buffer.from('abc'), value: Buffer.from('xyz') }] }]
  //     }
  //   };

  //   // Act
  //   const tx = syncData.parseTxResponse(modifiedTxResponse);

  //   // Assert
  //   expect(tx.events[0].attributes[0].key).toEqual('abc');
  //   expect(tx.events[0].attributes[0].value).toEqual('xyz');
  // });
});
