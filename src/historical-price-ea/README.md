# Chainlink Historical Price Data External Adapter
Chainlink external adapter for obtaining verifiable historical price data. 

## Installation

### Setting Environment Variables
Set your `RPC_URL` [environment variable.](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). You can get one for free at [Infura's site.](https://infura.io/). This can be set to a Kovan or Ethereum mainnet RPC endpoint

![WARNING](https://via.placeholder.com/15/f03c15/000000?text=+) **WARNING** ![WARNING](https://via.placeholder.com/15/f03c15/000000?text=+)

Don't commit and push any changes to .env files that may contain sensitive information, such as a private key! If this information reaches a public GitHub repository, someone can use it to check if you have any Mainnet funds in that wallet address, and steal them!

```bash
git clone https://github.com/pappas999/historical-price-feed-data
cd historical-price-feed-data/src/historical-price-ea
```



See [Install Locally](#install-locally) for a quickstart

## Input Params
| Parameter  | Description                                             | Default Value |
| ---------- | :------------------------------------------------------ | :------------ |
| proxyAddress      | [Proxy address](https://docs.chain.link/docs/ethereum-addresses/) of price feed                            |  |
| unixDateTime  | [unix timestamp](https://www.epochconverter.com/) that you wish to know the price data for |               |

## Output

The output is a JSON object containing the aggregator Phase ID, then answerRound, the previous round before the answer round, and the round after the answer round.
All rounds are aggregator rounds, not proxy rounds


```json
{
 "jobRunID": "278c97ffadb54a5bbb93cfec5f7b5503",
 "data": {2,1829,1828,1830},
 "statusCode": 200
}
```

## Install Locally

Install dependencies:

```bash
yarn
```

Natively run the application (defaults to port 8080):

### Run

```bash
yarn start
```

## Call the external adapter/API server

```bash
curl -X POST -H "content-type:application/json" "http://localhost:8080/" --data '{ "id": 0, "data": {  "proxyAddress": "0x9326BFA02ADD2366b30bacB125260Af641031331", "unixDateTime": 1609465692 } }'
```

## Example JSON Jobspec for Chainlink node
Here is an example Job spec for using the external adapter. 

```
{
  "name": "historical-price-data",
  "initiators": [
    {
      "id": 11,
      "jobSpecId": "a2f91a0f-bdc0-4654-a34e-ea23bbf4f115",
      "type": "runlog",
      "params": {
        "address": "0xb6efece462ea6118a0a7ec1f2a3c7033b1f82967"
      }
    }
  ],
  "tasks": [
    {
      "jobSpecId": "a2f91a0fbdc04654a34eea23bbf4f115",
      "type": "historical-price"
    },
    {
      "jobSpecId": "a2f91a0fbdc04654a34eea23bbf4f115",
      "type": "ethbytes32"
    },
    {
      "jobSpecId": "a2f91a0fbdc04654a34eea23bbf4f115",
      "type": "ethtx",
      "confirmations": 1
    }
  ]
}
```

## Increasing the Chainlink Node API Call Timeout Parameter
Due to the heavy computation of finding the right aggregator, and doing a binary search over thousands of rounds, sometimes the external adapter can take 15-20 seconds to complete. This can cause the call to the adapter to timeout due to the standard 15 second DEFAULT_HTTP_TIMEOUT parameter. If you find it's timing out, set the DEFAULT_HTTP_TIMEOUT value to a higher number in your node's .env file

```
DEFAULT_HTTP_TIMEOUT=60
```


## Docker

If you wish to use Docker to run the adapter, you can build the image by running the following command:

```bash
docker build . -t external-adapter
```

Then run it with:

```bash
docker run -p 8080:8080 -it external-adapter:latest
```

## Serverless hosts

After [installing locally](#install-locally):

### Create the zip

```bash
zip -r external-adapter.zip .
```

### Install to AWS Lambda

- In Lambda Functions, create function
- On the Create function page:
  - Give the function a name
  - Use Node.js 12.x for the runtime
  - Choose an existing role or create a new one
  - Click Create Function
- Under Function code, select "Upload a .zip file" from the Code entry type drop-down
- Click Upload and select the `external-adapter.zip` file
- Handler:
    - index.handler for REST API Gateways
    - index.handlerv2 for HTTP API Gateways
- Add the environment variable (repeat for all environment variables):
  - Key: API_KEY
  - Value: Your_API_key
- Save

#### To Set Up an API Gateway (HTTP API)

If using a HTTP API Gateway, Lambda's built-in Test will fail, but you will be able to externally call the function successfully.

- Click Add Trigger
- Select API Gateway in Trigger configuration
- Under API, click Create an API
- Choose HTTP API
- Select the security for the API
- Click Add

#### To Set Up an API Gateway (REST API)

If using a REST API Gateway, you will need to disable the Lambda proxy integration for Lambda-based adapter to function.

- Click Add Trigger
- Select API Gateway in Trigger configuration
- Under API, click Create an API
- Choose REST API
- Select the security for the API
- Click Add
- Click the API Gateway trigger
- Click the name of the trigger (this is a link, a new window opens)
- Click Integration Request
- Uncheck Use Lamba Proxy integration
- Click OK on the two dialogs
- Return to your function
- Remove the API Gateway and Save
- Click Add Trigger and use the same API Gateway
- Select the deployment stage and security
- Click Add

### Install to GCP

- In Functions, create a new function, choose to ZIP upload
- Click Browse and select the `external-adapter.zip` file
- Select a Storage Bucket to keep the zip in
- Function to execute: gcpservice
- Click More, Add variable (repeat for all environment variables)
  - NAME: API_KEY
  - VALUE: Your_API_key
