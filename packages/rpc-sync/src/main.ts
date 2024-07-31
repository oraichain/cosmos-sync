import { CHANNEL, SyncData, Txs } from ".";

(async () => {
    const sync = new SyncData({
      rpcUrl: 'https://rpc.orai.io',
      queryTags: [],
      limit: 200,
      offset: 19404388,
      interval: 1000,
      maxThreadLevel: 4
    });
    await sync.start();
    sync.on(CHANNEL.QUERY, (data: Txs) => {
      // console.log({ tx: data.txs[0] });
      console.log(data.offset);
    });
  //  sync.on(CHANNEL.SUBSCRIBE_TXS, (data) => {
  //   console.log({data});
  //  })
  })();