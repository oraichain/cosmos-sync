import { SyncData } from "src";

(async () => {
    const sync = new SyncData({
      rpcUrl: 'https://rpc.orai.io',
      queryTags: [],
      limit: 50,
      offset: 19404388,
      interval: 5000,
      maxThreadLevel: 4
    });
    await sync.start();
    // sync.on(CHANNEL.QUERY, (data: Txs) => {
    //   console.log({ tx: data.txs[0] });
    // });
  //  sync.on(CHANNEL.SUBSCRIBE_TXS, (data) => {
  //   console.log({data});
  
  //  })
  })();