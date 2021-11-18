## Getting Started

## ENV Config
```sh
MONGODB_CONNECTION={mongodb connection string}
POLKADOT_RPC_URL={polkadot node}
KUSAMA_RPC_URL={kusama node}
SEED={seed for your bot}
CACHE_PORT={port for staking-bot cache server}
FRACTAPP_CLIENT_URL={url from fractapp server}
```

## Manual
1. Create .env config

2. Install yarn packages
```sh
yarn install
```

3. Build
```sh
yarn build
```

4. Start cache
```sh
yarn run cache
```

5. Start stakingBot
```sh
yarn run stakingBot
```

## Tests

```sh
yarn test
```
