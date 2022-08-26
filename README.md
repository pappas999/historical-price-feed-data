# Chainlink Data Feeds Historical Data
 A Chainlink external adapter and consuming contract that allows obtaining verifiable historical Chainlink Price Feed data based on a proxy address and a search timestamp. Compatible with Ethereum testnet and mainnet, with all aggregator contract versions (including OCR aggregators)
 
 **Please note** this is still in development, and should not be used in a production scenario without thorough testing beforehand.

For instructions on running the external adapter, please head to the [historical-price-data external adapter README](https://github.com/pappas999/historical-price-feed-data/tree/main/src/historical-price-ea). The consumer contract in this repository needs to connect to an oracle running the external adapter in a job.

Take note, the solution is setup to use Chainlink multi-variable response, but for now uses a single delimited byte32 response until [this issue](https://github.com/smartcontractkit/chainlink/issues/4938) is resolved
 
## Live Deployment
The consumer contract has been deployed for users to interact with on the Kovan testnet at [the following address](https://kovan.etherscan.io/address/0x5660381b7621Cd2d4DD34866ae94fa9939b243bd#writeContract). You can connect your MetaMask wallet and call the getHistoricalPriceData function, passing in a valid [Kovan price feed](https://docs.chain.link/docs/ethereum-addresses/#Kovan%20Testnet) address, and a [unix timestamp](https://www.epochconverter.com/). A [LinkRiver](https://linkriver.io/) hosted Chainlink node hosting a job and the external adapter will receive the request, and send a response, which can be viewed via the [Read Contract tab](https://kovan.etherscan.io/address/0x836889aF31DeF5cfE35620F410648504FAb3F244#readContract). Values are as follows:
- priceAnswer: price at that point in time
- priceTimestamp: timestamp of the rounds answer
- answerRound: proxy roundId for the answer. This can be verified by passing it into the existing getHistoricalPrice function 



## Requirements

- [NPM](https://www.npmjs.com/) or [YARN](https://yarnpkg.com/)

## Installation

### Kovan Ethereum Testnet
Set your `KOVAN_RPC_URL` [environment variable.](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). You can get one for free at [Infura's site.](https://infura.io/) You'll also need to set the variable `PRIVATE_KEY` which is your private key from your wallet, ie MetaMask. This is needed for deploying contracts to public networks. 

### Setting Environment Variables
You can set these in your `.env` file if you're unfamiliar with how setting environment variables work. Check out our [.env example](https://github.com/smartcontractkit/hardhat-starter-kit/blob/main/.env.example). If you wish to use this method to set these variables, update the values in the .env.example file, and then rename it to '.env'

**WARNING** 

Don't commit and push any changes to .env files that may contain sensitive information, such as a private key! If this information reaches a public GitHub repository, someone can use it to check if you have any Mainnet funds in that wallet address, and steal them!

`.env` example:
```
KOVAN_RPC_URL='www.infura.io/asdfadsfafdadf'
MNEMONIC='cat dog frog...'
MAINNET_RPC_URL="https://eth-mainnet.alchemyapi.io/v2/your-api-key"
MUMBAI_RPC_URL='https://rpc-mumbai.maticvigil.com'
POLYGON_MAINNET_RPC_URL='https://rpc-mainnet.maticvigil.com'
```
`bash` example
```
export KOVAN_RPC_URL='www.infura.io/asdfadsfafdadf'
export MNEMONIC='cat dog frog...'
export MAINNET_RPC_URL='https://eth-mainnet.alchemyapi.io/v2/your-api-key'
export MUMBAI_RPC_URL='https://rpc-mumbai.maticvigil.com'
export POLYGON_MAINNET_RPC_URL='https://rpc-mainnet.maticvigil.com'
```

If you plan on deploying to a local [Hardhat network](https://hardhat.org/hardhat-network/) that's a fork of the Ethereum mainnet instead of a public test network like Kovan, you'll also need to set your `MAINNET_RPC_URL` [environment variable.](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html) and uncomment the `forking` section in `hardhat.config.js`. You can get one for free at [Alchemy's site.](https://alchemyapi.io/).

Then you can install all the dependencies

```bash
git clone https://github.com/pappas999/historical-price-feed-data/
cd historical-price-feed-data/contracts
```
then

```bash
npm install
```

Or

```bash
yarn
```

## Deploy

Deployment scripts are in the [deploy](https://github.com/pappas999/historical-price-feed-data/tree/main/contracts/deploy) directory. If no network is specified, it will default to the Kovan network.

```bash
npx hardhat deploy
```

To specifically deploy to testnet:
```bash
npx hardhat deploy --network kovan
```

## Run

The deployment output will give you the contract address as it's deployed. You can then use this contract address in conjunction with Hardhat tasks to perform operations on the contract


### Historical Price Data
The Historical Price Consumer contract has two tasks, one to request historical price data based on a set of parameters, and one to check to see what the result of the data request is. This contract needs to be funded with link first:

| Parameter  | Description                                             | Default Value |
| ---------- | :------------------------------------------------------ | :------------ |
| contract   | Address of the deployed consumer contract               |               |
| proxy      | [Proxy address](https://docs.chain.link/docs/ethereum-addresses/) of price feed                            | Kovan ETH/USD |
| timestamp  | [unix timestamp](https://www.epochconverter.com/) that you wish to know the price data for |               |


First you need to fund your contract with link

```bash
npx hardhat fund-link --contract insert-contract-address-here --network network
```

Once it's funded, you can request historical price data by passing in a number of parameters to the request-historical-data task. All parameters are mandatory. The following command makes a request to obtain historical price data at unix timestamp 1625095820 (Wednesday, 30 June 2021 23:30:20) for the [ETH/USD proxy contract](https://kovan.etherscan.io/address/0x9326BFA02ADD2366b30bacB125260Af641031331) running on the Kovan network.

```bash
npx hardhat request-historical-data --contract insert-contract-address-here --proxy 0x9326BFA02ADD2366b30bacB125260Af641031331 --timestamp 1625095820  --network kovan
```

Once you have successfully made a request for historical data, you can see the result via the read-data task
```bash
npx hardhat read-data --contract insert-contract-address-here --network network
```



