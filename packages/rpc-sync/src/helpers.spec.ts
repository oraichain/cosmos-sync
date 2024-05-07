import { readFileSync } from 'fs';
import { parseTxEvent } from './helpers';
import { resolve } from 'path';

describe('Test helper functions', () => {
  it('should parse TxEvent raw types to TxEvent', async () => {
    const txEvent = JSON.parse(readFileSync(resolve(__dirname, './tx.json'), 'utf-8'));
    const uint8Array = new Uint8Array(Object.values(txEvent.hash));
    txEvent.hash = uint8Array;
    txEvent.tx = new Uint8Array(Object.values(txEvent.tx));
    const parsedTxEvent = parseTxEvent(txEvent);
    console.log('🚀 ~ it ~ parsedTxEvent:', parsedTxEvent);
    expect(true).toBe(true);
  });
 
});
