const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const config = require('./config')
require('dotenv').config()
var log = require('npmlog')

const createRequest = async (input, callback) => {
  /* Params expected in the request:
     proxyAddress: This is the address of the proxy contract for data feed that has all the historical data that we want to access. ie, taken from https://docs.chain.link/docs/reference-contracts/

     epochTime: This is the time in unix time (seconds) that we want to get price data for. This field is optional
     dateTime:  This is the human readable date/time that we want to get historical price data for. This field is optional, and is in the format of YYYY-MM-DD HH24:mi:ss
     Note: one of the two date formats above is required. If both are passed in as different values, then the unix epoch time will be used by default
   */

  //constant variables
  const MAINNET_PRICE_FEEDS_LIVE_BLOCK_NO = 10606501 //mainnet block that price feeds went live on Ethereum, Aug 6 2020
  const KOVAN_PRICE_FEEDS_LIVE_BLOCK_NO = 20349280
  const MAINNET_LOG_CHUNKS = 200000
  const KOVAN_LOG_CHUNKS = 900000
  const NEW_ROUND_TOPIC = "0x0109fc6f55cf40689f02fbaad7af7fe7bbac8a3d2186600afc7d3e10cac60271" //topic0 on NewRound event emitted.
  const NEW_ROUND_TOPIC_LEGACY_AGGREGATOR = "0xc3c45d1924f55369653f407ee9f095309d1e687b2c0011b1f709042d4f457e17" //older aggregators had a different topic
  const RPC_URL = process.env.RPC_URL //connection to Ethereum
  const accessControlledAggregatorABI = config.aggregatorContractABI
  const EACAggregatorProxyABI = config.EACAggregatorProxyABI
  const aggregatorFacadeABI = config.aggregatorFacadeABI
  const aggregatorABI = config.aggregatorFacadeABI
  const accessControlledOffchainAggregatorABI = config.accessControlledOffchainAggregatorABI
  const currentDateTime = Math.round(Date.now() / 1000)

  //parse request input
  const jobRunID = input.id
  const aggregatorProxyAddress = input.data.proxyAddress
  const paramUnixDateTime = input.data.unixDateTime
  const paramISODateTime = input.data.ISODateTime

  //get a connection to we3, with a slightly longer timeout (for searching logs using infura)
  const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL, { timeout: 10e3 }));


  try {

    //validate inputs here
    //check passed in proxy contract is a valid ethereum contract address
    let validAddress = web3.utils.isAddress(aggregatorProxyAddress)
    var proxyAggregatorNumber;

    //check unix time is populated, and if so validate it
    if (paramUnixDateTime) {
      //first ensure it's an integer
      if (isNaN(parseFloat(paramUnixDateTime)) && isFinite(paramUnixDateTime)) {
        throw ('unix time parameter is not a valid number')
      }

      //check param isn't in the future
      if (paramUnixDateTime > currentDateTime) {
        throw ('unix time parameter greater than current datetime')
      }

      //all check have passed, set the specifiedDateTime variable to the passed in unix timestamp
      specifiedDateTime = paramUnixDateTime

      //if no unix timestamp was specified, try check for an ISO datetime
    } else if (paramISODateTime) {

      // check to see it can be converted to a unix timestamp
      var validISOTime = (new Date(paramISODateTime)).getTime() > 0;

      //check param isn't in the future
      if (validISOTime > currentDateTime) {
        throw ('unix time parameter greater than current datetime')
      }

      //all check have passed, set the specifiedDateTime variable to the passed in ISO datetime, converted to unix timestamp
      specifiedDateTime = validISOTime

    } else {
      throw ("didn't provide a date parameter")
    }
    log.info(new Date().toISOString() + ': New historical price request received for proxy: ' + aggregatorProxyAddress + ' at timestamp: ' + specifiedDateTime)

    //now that we've validated the address and time, lets connect to the proxy contract, and grab a list of all the underlying aggregator contracts with their phase IDs
    //we need this info to work out which aggregator contract we need to look at to find the historical price data
    var aggregators = new Array();
    const proxyAggregator = new web3.eth.Contract(EACAggregatorProxyABI, aggregatorProxyAddress);
    let phaseId = 1
    let aggregatorContract = 1
    while (true) {
      aggregatorContract = await proxyAggregator.methods.phaseAggregators(phaseId).call()
      if (!(parseInt(aggregatorContract) == '0')) {
        aggregators.push(aggregatorContract)
        phaseId = phaseId + 1
      } else {
        break
      }
    }

    //now we have all the aggregators and their phases (index in the array + 1, as phases start from 1), assuming there's more than 1, we need to work out which one contains the historical price data
    //we can do this by seeing which one has a timestamp > search date parameter in their maximum/latest round
    if (aggregators.length == 0) {
      throw ('no aggreagator found')
    } else if (aggregators.length == 1) {
      aggregatorAddress = aggregators[0]  //only 1 aggregator, this is the one we need to search
    } else {  //multiple aggregators found
      //we need to loop through and find which one is the one we want to search
      //because some aggreagators run in parallel, we will loop backwards from the most recent one to the ealiest one
      //the correct aggreagator contract is the first one where the data against the first roundId is < the date being searched

      for (let i = aggregators.length - 1; i >= 0; i--) {
        //lets get the aggregator version to work out if its an accessControlledAggreagator contract, or an AggregatorFacade contract, or a legacy Aggregator etc
        //cast to aggreagatorfacade even if its not that, we just need to call the version public getter function which is common across all aggregators
        var tempAggregator = await new web3.eth.Contract(accessControlledAggregatorABI, aggregators[i])
        var version = await tempAggregator.methods.version().call()

        if (version == 4) {  //its an OCR aggreagator
          var aggreagatorBeingSearched = new web3.eth.Contract(accessControlledOffchainAggregatorABI, aggregators[i])
          var aggreagatorBeingSearchedAddress = aggregators[i]
          var filterTopic = NEW_ROUND_TOPIC
          log.verbose(new Date().toISOString() + ': OCR contract found ' + aggreagatorBeingSearchedAddress)
        } else if (version == 3) {  //its an flux aggregator
          var aggreagatorBeingSearched = new web3.eth.Contract(accessControlledAggregatorABI, aggregators[i])
          var aggreagatorBeingSearchedAddress = aggregators[i]
          var filterTopic = NEW_ROUND_TOPIC
          log.verbose(new Date().toISOString() + ': flux contract found ' + aggreagatorBeingSearchedAddress)
        } else if (version == 2) {              //its a facade contract, get the underlying aggreagator contract
          let aggregatorFacade = new web3.eth.Contract(aggregatorFacadeABI, aggregators[i]);
          let aggregatorAddress = await aggregatorFacade.methods.aggregator().call()
          log.verbose(new Date().toISOString() + ': aggregator contract found: ' + aggregatorAddress)
          var aggreagatorBeingSearched = new web3.eth.Contract(aggregatorABI, aggregatorAddress)
          var aggreagatorBeingSearchedAddress = aggregatorAddress
          var filterTopic = NEW_ROUND_TOPIC_LEGACY_AGGREGATOR
        } else {
          throw ('unexpected aggregator version found')
        }

        //now lets see if this aggregators first round timestamp is < our search timestamp
        let earliestTimestamp = await aggreagatorBeingSearched.methods.getTimestamp(1).call()
        log.verbose(new Date().toISOString() + ': earliest timestamp for aggreagator ' + aggreagatorBeingSearchedAddress + ' : ' + earliestTimestamp)
        if (earliestTimestamp < specifiedDateTime) { //if this aggregator first round timestamp < the date we're searching for, this is the correct one that will contain our price data
          aggregatorAddress = aggreagatorBeingSearchedAddress
          log.verbose(new Date().toISOString() + ': found aggreagator contract that matches criteria: ' + aggreagatorBeingSearchedAddress)
          proxyAggregatorNumber = i + 1;
          break
        }
      }
    }

    //now that we've validated everything, and found the correct aggreagator contract, lets populated an array of all the roundIds in the aggregator
    log.verbose(new Date().toISOString() + ': finding rounds for aggreagator ' + aggreagatorBeingSearchedAddress)
    var rounds = new Array();
    var priceFeedsLiveBlockNo
    var logBatchAmount

    //depending on which network the adapter is running on, set the starting block for when price feeds went live (to limit the getPastLogs query)
    //also we're limiting chunking depending on network, this is to avoid timeouts
    var networkId = await web3.eth.net.getId()
    if (networkId == 42) { //kovan
      priceFeedsLiveBlockNo = KOVAN_PRICE_FEEDS_LIVE_BLOCK_NO
      logBatchAmount = KOVAN_LOG_CHUNKS
    } else if (networkId == 1) { //mainnet
      priceFeedsLiveBlockNo = MAINNET_PRICE_FEEDS_LIVE_BLOCK_NO
      logBatchAmount = MAINNET_LOG_CHUNKS
    } else {
      throw ('network not supported: ' + networkId)
    }

    //now we're reading to iterate through all the 'newRound' logs for this aggreagator. This allows us to create an array with all the rounds in the aggregator
    //with 100% certainty that the round numbers are correct
    var startedAt
    let currentBlock = await web3.eth.getBlockNumber()
    log.verbose(new Date().toISOString() + ': searching for logs from block: ' + KOVAN_PRICE_FEEDS_LIVE_BLOCK_NO + ' to block ' + currentBlock)
    for (let i = parseInt(priceFeedsLiveBlockNo); i < currentBlock + 1; i += logBatchAmount) {
      let toBlock = parseInt(i) + parseInt(logBatchAmount - 1)
      log.verbose(new Date().toISOString() + ': searching logs from blocks ' + i + ' to ' + toBlock)

      let res = await web3.eth.getPastLogs({
        address: aggreagatorBeingSearchedAddress,
        topics: [filterTopic],
        fromBlock: parseInt(i),
        toBlock: parseInt(toBlock)
      })
      if (!(Object.keys(res).length == 0)) {
        for (const rec of res) {
          roundId = new BigNumber(web3.eth.abi.decodeParameter('int256', rec.topics[1]))
          //if its a flux aggreagator, we can filter out 0 results by looking at the startedAt topic, potentially saving some time later on
          if (version == 2) {
            startedAt = web3.eth.abi.decodeParameter('int256', rec.topics[2])
            if (startedAt > 0) {
              rounds.push(roundId.toString())
            }
          } else {  //not a flux aggregator, have to add the round and sort it out after if any zero results are found
            rounds.push(roundId.toString())
          }
        }
      }

      //no need to continue searching once we reach the current block
      if (toBlock > currentBlock) {
        break
      }

    }

    if (rounds.length == 0) {
      throw ('no logs found for aggregator ' + aggreagatorBeingSearchedAddress)
    }

    //now that we have an array full of valid round IDs for the aggregator, perform a binary search to find which rounds are within range of our answer
    log.verbose(new Date().toISOString() + ': number of rounds found: ' + rounds.length)
    log.verbose(new Date().toISOString() + ': starting binary search')
    var binSearchResult = await binarySearch(filterTopic, rounds, Math.floor((rounds.length - 1) / 2))
    var foundRounds = binSearchResult
    log.verbose(new Date().toISOString() + ': binary search complete. Results: ' + JSON.stringify(foundRounds))

    //only proceed if we found a result
    if (foundRounds.length > 0) {

      //next we need to order the foundArray in ascending order of updatedAt
      var sortedArray = foundRounds.sort((a, b) => a.updatedTime - b.updatedTime);

      //now that we have an ordered array, we need to find the greatest updatedAt that is <= specifiedDateTime
      var sortedArray = sortedArray.filter(function (x) { return x.updatedTime <= specifiedDateTime })
      var targetRound = Math.max.apply(Math, sortedArray.map(o => o.updatedTime))

      var roundAnswer = foundRounds.find(o => o.updatedTime === JSON.stringify(targetRound))

      //now that we have an answerRound, we need to find the round before and after it (for verification purposes on-chain)
      //the previous and next round can be obtained from the aggregator rounds array by going to the previous and next index in the array
      let returnRoundIndex = (rounds.indexOf(roundAnswer.round));
      let lowerBoundIndex = returnRoundIndex - 1
      let higherBoundIndex = returnRoundIndex + 1
      var roundAnswer = roundAnswer.round
      var earlierRoundAnswer = rounds[lowerBoundIndex]
      var laterRoundAnswer = rounds[higherBoundIndex]

      //now convert the rounds to the phased aggreagator rounds, as the consumer contracts won't recognize internal aggregator rounds
      /* commented out until multi-variable responses work with external adapters - https://github.com/smartcontractkit/chainlink/issues/4938
      var phasedRoundAnswer = (BigInt(proxyAggregatorNumber) << BigInt(64) | BigInt(roundAnswer)).toString()
      var phasedPrevRoundAnswer = (BigInt(proxyAggregatorNumber) << BigInt(64) | BigInt(earlierRoundAnswer)).toString()
      var phasedNextRoundAnswer = (BigInt(proxyAggregatorNumber) << BigInt(64) | BigInt(laterRoundAnswer)).toString()

      log.verbose(new Date().toISOString() + ': final phased round answer: ' + phasedRoundAnswer)
      log.verbose(new Date().toISOString() + ': phasedPrevRoundAnswer phased round answer: ' + phasedPrevRoundAnswer)
      log.verbose(new Date().toISOString() + ': phasedNextRoundAnswer phased round answer: ' + phasedNextRoundAnswer)

      //return the phase number plus the rounds in their aggregator numbers, then turn them into the proxy rounds back on-chain
      //this is to avoid hitting the 32 byte limit on single word response
      log.verbose(new Date().toISOString() + ': aggregator number/phase: ' + proxyAggregatorNumber)
      log.verbose(new Date().toISOString() + ': final round answer: ' + roundAnswer)
      log.verbose(new Date().toISOString() + ': phasedPrevRoundAnswer round answer: ' + earlierRoundAnswer)
      log.verbose(new Date().toISOString() + ': phasedNextRoundAnswer round answer: ' + laterRoundAnswer)
      */
    } else { //binary search found no results
      throw ('no results found in binary search')
    }


    //until multi-word response works with external adapters, return a delimited string of the phase and aggregator round IDs
    //then turn into phased round IDs back on-chain
    /*
    callback(200,
      {
        jobRunID,
        data: { "roundAnswer": phasedRoundAnswer, "earlierRoundAnswer": phasedPrevRoundAnswer, "laterRoundAnswer": phasedNextRoundAnswer },
        result: {data: { "roundAnswer": phasedRoundAnswer, "earlierRoundAnswer": phasedPrevRoundAnswer, "laterRoundAnswer": phasedNextRoundAnswer }},
        statusCode: 200
      });
      */

    //while using single word response, return a string array containing the aggregator phase ID, plus the 3 aggregator rounds
    //they will be converted back to proxy roundIDs back on-chain, 32 bytes isn't big enough to fit them in their current form here
    finalResponse = `{${proxyAggregatorNumber},${roundAnswer},${earlierRoundAnswer},${laterRoundAnswer}}`
    callback(200,
      {
        jobRunID,
        data: finalResponse,
        result: finalResponse,
        statusCode: 200
      });

  }
  catch (error) {
    callback(500,
      {
        jobRunID,
        data: {},
        result: error,
        statusCode: 500
      });
  }

  //internal function for performing the binary search. Can be called recursively
  async function binarySearch(filterTopic, roundArray, midParam) {
    var foundRounds = new Array();
    let start = 0;
    let end = roundArray.length - 1;
    //continue to loop through array of rounds, doing a binary search
    //if a round is found that has an updatedDateTime within 2 hours of the timestamp being searched, it will add it to a results array
    //The idea is to just get all the potential rounds that occur around the time the user is searching for, put them in an ordered array, then we'll do a proper comparison later on
    var historicalRoundData
    var midDateTime
    var midPrice
    while (start <= end) {
      let mid = Math.floor((start + end) / 2);
      log.verbose(new Date().toISOString() + ': performing binary search on start: ' + start + ' mid: ' + mid + ' end: ' + end)
      //different methods depending on whether its a flux or ocr aggregator or a traditional aggregator
      if (filterTopic == NEW_ROUND_TOPIC) {
        historicalRoundData = await aggreagatorBeingSearched.methods.getRoundData(roundArray[mid]).call()
        midDateTime = historicalRoundData.updatedAt
        midPrice = historicalRoundData.answer
      } else {
        midDateTime = await aggreagatorBeingSearched.methods.getTimestamp(roundArray[mid]).call()
        midPrice = await aggreagatorBeingSearched.methods.getAnswer(roundArray[mid]).call()
      }


      log.verbose(new Date().toISOString() + ': found data! dateTime: ' + midDateTime + ' search param: ' + specifiedDateTime + ' price: ' + midPrice)

      //if the round is bad (0 result), we need to remove this round from the rounds array (because its not valid)
      //then we need to do the binary search again on the new array
      if (midDateTime == 0) {
        log.verbose(new Date().toISOString() + ': got a bad result for round ' + roundArray[mid] + ', removing it and doing recursion')

        //rather than just removing this bad round and doing a new search, lets go back in time and forward in time
        //and strip out any 0 records directly before or after
        //ie if the array is [1,2,3,4,0,0,0,8,9,10], after finding a bad round at index 5, it should remove the 0
        //before and after that, resulting in [1,2,3,4,8,9,10]

        //first, find how many zeros after there are
        let zerosAfter = 0
        let zeroAfterTest = 0
        while (zeroAfterTest == 0) {
          zeroAfterTest = await aggreagatorBeingSearched.methods.getTimestamp(roundArray[mid + zerosAfter]).call()
          if (zeroAfterTest == 0) {
            zerosAfter += 1
          }
        }
        log.verbose(new Date().toISOString() + ': number of zeros after index: ' + zerosAfter)

        //now find the amount of zeros BEFORE the index
        let zerosBefore = 0
        let zeroBeforeTest = 0
        while (zeroBeforeTest == 0) {
          zeroBeforeTest = await aggreagatorBeingSearched.methods.getTimestamp(roundArray[mid - zerosBefore]).call()
          if (zeroBeforeTest == 0) {
            zerosBefore += 1
          }
        }
        log.verbose(new Date().toISOString() + ': number of zeros before index: ' + zerosBefore)

        //now that we know how many zeros before and after, we simply need to splice the array
        //first remove the bad index that was found
        roundArray.splice(mid, 1)
        //now remove all the zeros after, taking into account the spliced array. If none were found nothing will be spliced
        roundArray.splice(mid, zerosAfter)
        //now remove all the zeros before,taking into account the spliced array. If none were found nothing will be spliced
        roundArray.splice(mid - zerosBefore, zerosBefore)

        log.verbose(new Date().toISOString() + ': done stripping out 0 results, new array length: ' + roundArray.length)
        return binarySearch(filterTopic, roundArray)
      } else {
        //now check to see if answer dateTime is within 2 hours mins of the search param. If so add it to a new array, we'll go through all found values later and work out which is the right one
        if (Math.abs(midDateTime - specifiedDateTime) <= 10800) {
          let foundRound = {
            "round": roundArray[mid],
            "price": midPrice,
            "updatedTime": midDateTime
          }
          foundRounds.push(foundRound)
        }

        //grab a new set of lower and upper bound ranges to search in the next iteration of the binary search
        if (specifiedDateTime < midDateTime) {
          end = mid - 1;
        } else {
          start = mid + 1;
        }
      }
    }
    return foundRounds
  }
}




// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest

