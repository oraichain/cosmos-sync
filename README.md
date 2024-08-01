# Cosmos-sync

<p align="center" width="100%">
    <img height="90" src="https://user-images.githubusercontent.com/545047/190171475-b416f99e-2831-4786-9ba3-a7ff4d95b0d3.svg" />
</p>
<p align="center" width="100%">
   <a href="https://github.com/oraichain/cosmos-sync/blob/master/LICENSE"><img height="20" src="https://img.shields.io/badge/License-GNU%20GPL-blue.svg"></a>
</p>

:information_desk_person: This repository provides an SDK designed to streamline the synchronization of Cosmos-based transactions using Tendermint RPC. It facilitates this process by leveraging a set of query tags.

## 📦 Packages

| Name                                                                                        | Version                                  | Description                              |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| [@oraichain/cosmos-rpc-sync](https://github.com/oraichain/cosmos-sync/tree/master/packages/rpc-sync) | <a href="https://www.npmjs.com/package/@oraichain/common"><img height="20" src="https://img.shields.io/github/package-json/v/oraichain/cosmos-sync?filename=packages%2Frpc-sync%2Fpackage.json"></a> |  Synchronize transaction using rpc. |
| [@oraichain/cosmos-lcd-sync](https://github.com/oraichain/cosmos-sync/tree/master/packages/lcd-sync) | <a href="https://www.npmjs.com/package/@oraichain/common"><img height="20" src="https://img.shields.io/github/package-json/v/oraichain/cosmos-sync?filename=packages%2Flcd-sync%2Fpackage.json"></a> | Synchronize transaction using lcd. |

## Installation
The npm package for the Oraichain [Cosmos-sync SDK](https://github.com/oraichain/cosmos-sync)

```bash
yarn add @oraichain/cosmos-rpc-sync
yarn add @oraichain/cosmos-lcd-sync
```

## Quick start
Please refer to [examples](./packages//examples/README.md) to get start with our SDK.

## 🛠 Developing

Checkout the repository and bootstrap the yarn workspace:

```bash
# Clone the repo.
git clone https://github.com/oraichain/cosmos-sync.git
cd cosmos-sync
yarn
```

### Testing
```bash
# Run all tests
yarn test
```

### Building
```sh
yarn build packages/rpc-sync
yarn build packages/lcd-sync
```

### Publishing
```bash
yarn deploy packages/rpc-sync
yarn deploy packages/lcd-sync
```

## Credits

🛠 Built by Oraichain Labs — if you like our tools, please consider delegating to [OWallet validators ⚛️](https://owallet.dev/validators)

## 🪪 License

All packages are [GPL 3.0](https://www.gnu.org/licenses/gpl-3.0.en.html) licensed.

## Disclaimer

AS DESCRIBED IN THE LICENSES, THE SOFTWARE IS PROVIDED “AS IS”, AT YOUR OWN RISK, AND WITHOUT WARRANTIES OF ANY KIND.

No developer or entity involved in creating this software will be liable for any claims or damages whatsoever associated with your use, inability to use, or your interaction with other users of the code, including any direct, indirect, incidental, special, exemplary, punitive or consequential damages, or loss of profits, cryptocurrencies, tokens, or anything else of value.