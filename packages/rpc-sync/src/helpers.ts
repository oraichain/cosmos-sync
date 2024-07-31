import { DecodedTxRaw, decodeTxRaw } from "@cosmjs/proto-signing";
import { TxEvent, Event } from "@cosmjs/tendermint-rpc/build/tendermint37";

// TxEvent Parsing
export interface ParsedTxEvent {
  hash: string;
  tx: DecodedTxRaw;
  height: number;
  result: {
      events: Event[];
      code: number;
      codespace?: string;
      log?: string;
      data?: Uint8Array;
      gasWanted: number;
      gasUsed: number;
  };
}


export function parseTxEvent(txEvent: TxEvent):ParsedTxEvent {
  return {
    hash: Buffer.from(txEvent.hash).toString('hex').toLocaleUpperCase(),
    tx: decodeTxRaw(txEvent.tx),
    height: txEvent.height,
    result: {
      ...txEvent.result,
      events: parseRpcEvents(txEvent.result.events)
    }
  }
}

export function isBase64(str: string) {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

export const parseRpcEvents = (events: readonly Event[]): Event[] => {
  return events.map((ev: any) => ({
    ...ev,
    attributes: ev.attributes.map((attr) => {
      let obj;
      try {
        obj = {
          key: isBase64(attr.key) ? Buffer.from(attr.key, "base64").toString("utf-8") : attr.key,
          value: isBase64(attr.value) ? Buffer.from(attr.value, "base64").toString("utf-8") : attr.value
        };
      } catch (err) {
        obj = {
          key: isBase64(attr.key) ? Buffer.from(attr.key, "base64").toString("utf-8") : attr.key,
          value: attr.value
        };
      }
      return obj;
    })
  }));
};
