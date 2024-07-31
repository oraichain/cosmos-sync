import { SyncData } from '@oraichain/cosmos-rpc-sync';
import { ORAI_TOKEN_CONTRACTS } from '@oraichain/common';

const RPC = 'https://rpc.orai.io';
const LIMIT = 4000;
const OFFSET = 28919883; // current block height when write example

const genQueryTagContract = (contractAddress: string) => {
  return [
    {
      key: 'wasm._contract_address',
      value: contractAddress
    }
  ];
};

const genQueryTagAddress = (address: string) => {
  return [
    {
      key: 'message.sender',
      value: address
    }
  ];
};

const main = async () => {
  const syncData = new SyncData({
    queryTags: genQueryTagContract(ORAI_TOKEN_CONTRACTS.USDC),
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
