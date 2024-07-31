import { SyncData } from '@oraichain/cosmos-rpc-sync';
import { COSMOS_CHAIN_IDS, ORAI_TOKEN_CONTRACTS, OraiCommon } from '@oraichain/common';
import { StargateClient } from '@cosmjs/stargate';

const LIMIT = 4000;

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
  const common = await OraiCommon.initializeFromGitRaw({ chainIds: [COSMOS_CHAIN_IDS.ORAICHAIN] });
  const rpc = common.chainInfos.cosmosChains.find((chain) => chain.chainId === COSMOS_CHAIN_IDS.ORAICHAIN).rpc;
  const client = await StargateClient.connect(rpc);
  const latestBlock = await client.getHeight();
  // const latestBlock =
  const syncData = new SyncData({
    queryTags: genQueryTagContract(ORAI_TOKEN_CONTRACTS.USDC),
    rpcUrl: rpc,
    offset: latestBlock,
    interval: 1000,
    limit: 10
  });

  await syncData.start();

  syncData.on('data', (data) => {
    console.log('data: ', data);
  });
};

main();
