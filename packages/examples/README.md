# Cosmos-sync Examples

| A collection of examples on how to interact with the Oraichain network using Cosmos-sync SDK. |
| --------------------------------------------------------------------------------------------- |

## Basic listening for transactions of smart contract

```ts
import { SyncData } from '@oraichain/cosmos-rpc-sync';
import { ORAI_TOKEN_CONTRACTS } from '@oraichain/common';

const RPC = 'https://rpc.orai.io';
const LIMIT = 4000;
const OFFSET = 28919883; // current block height when write example

const main = async () => {
  const syncData = new SyncData({
    queryTags: [
      {
        key: 'wasm._contract_address',
        value: ORAI_TOKEN_CONTRACTS.USDC
      }
    ],
    rpcUrl: RPC,
    offset: OFFSET,
    limit: LIMIT
  });

  await syncData.start();

  syncData.on('data', (data) => {
    console.log('data: ', data);
  });
};

main();
```

Here you can listen for transaction of a smart contract by using cosmos-sync.

At this example, we are going to listen for transactions of CW20 USDC smart contract. The key here is what `queryTags` you defined to query blockchain states and `params` you pass to initiate `SyncData` instance.

We define `queryTags` with key is `wasm._contract_address` and value is USDC contract address. Other `params` for initiating `SyncData` are:
```ts
/**
 * @rpcUrl: rpc url to query blockchain states
 * @offset: block height that start to query
 * @limit: total blocks to query states at one time
 * @interval: time interval to query
 * @timeoutSleep: time sleep to reduce rpc traffic load
 * @maxThreadLevel: thread level to query parallel
 */
```

The results will be handled by listen to event `data`, here we just basically log it out.

## Basic listening for transactions of an address

```ts
import { SyncData } from '@oraichain/cosmos-rpc-sync';

const RPC = 'https://rpc.orai.io';
const LIMIT = 4000;
const OFFSET = 28919883; // current block height when write example

const main = async () => {
  const syncData = new SyncData({
    queryTags: [
      {
        key: 'message.sender',
        value: "orai1lwuqpj9teef8j0rjy2l4c5ay9yddw26m03tlem"
      }
    ],
    rpcUrl: RPC,
    offset: OFFSET,
    limit: LIMIT
  });

  await syncData.start();

  syncData.on('data', (data) => {
    console.log('data: ', data);
  });
};

main();
```

Here we listen for transactions that executed by an address.

At this example, we define queryTags that key is `message.sender` and value is an address. The results is still just logged out.