task("read-data", "Calls an API Consumer Contract to read data obtained from an external API")
    .addParam("contract", "The address of the API Consumer contract that you want to call")
    .setAction(async taskArgs => {

        const contractAddr = taskArgs.contract
        const networkId = network.name
        console.log("Reading data from API Consumer contract ", contractAddr, " on network ", networkId)
        const HistoricalPriceConsumer = await ethers.getContractFactory("HistoricalPriceConsumer")

        //Get signer information
        const accounts = await ethers.getSigners()
        const signer = accounts[0]

        //Create connection to API Consumer Contract and call the createRequestTo function
        const historicalPriceConsumer = new ethers.Contract(contractAddr, HistoricalPriceConsumer.interface, signer)
        let proxyContract = await historicalPriceConsumer.getProxyContract()
        let timestamp = BigInt(await historicalPriceConsumer.getSearchTimestamp()).toString()
        let price = BigInt(await historicalPriceConsumer.priceAnswer()).toString()
        let answerRound = BigInt(await historicalPriceConsumer.answerRound()).toString()
        let answerTimestamp = BigInt(await historicalPriceConsumer.priceTimestamp()).toString()
        console.log('Historical Data for proxy contract ' + proxyContract + ' at timestamp ' + timestamp + ' is: Price: ' + price + ' roundID: ' + answerRound + ' Round Timestamp: ' + answerTimestamp)
        if (price == 0 && ['hardhat', 'localhost', 'ganache'].indexOf(network.name) == 0) {
            console.log("You'll either need to wait another minute, or fix something!")
        }
        if (['hardhat', 'localhost', 'ganache'].indexOf(network.name) >= 0) {
            console.log("You'll have to manually update the value since you're on a local chain!")
        }
    })

module.exports = {}
