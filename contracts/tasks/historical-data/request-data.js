let { networkConfig, getNetworkIdFromName } = require('../../helper-hardhat-config')

task("request-historical-data", "Calls the consumer contract to request historical price data")
    .addParam("contract", "The address of the consumer contract that you want to execute the task on")
    .addParam("proxy", "The address of the proxy contract that you want to search")
    .addParam("timestamp", "The timestamp that you you want to search")
    .setAction(async taskArgs => {

        const contractAddr = taskArgs.contract
        const proxyAddr = taskArgs.proxy
        const timestamp = taskArgs.timestamp
        let networkId = await getNetworkIdFromName(network.name)
        console.log("Calling Historical Price Consumer contract ", contractAddr, " with proxy address " + proxyAddr + " and timestamp " + timestamp + " on network ", network.name)
        const HistoricalPriceConsumer = await ethers.getContractFactory("HistoricalPriceConsumer")

        //Get signer information
        const accounts = await ethers.getSigners()
        const signer = accounts[0]

        //Create connection to Consumer Contract and call the createRequestTo function
        const historicalPriceConsumer = new ethers.Contract(contractAddr, HistoricalPriceConsumer.interface, signer)
        var result = await historicalPriceConsumer.getHistoricalPrice(proxyAddr,timestamp)
        console.log('Contract ', contractAddr, ' historical data request successfully called. Transaction Hash: ', result.hash)
        console.log("Run the following to read the returned result:")
        console.log("npx hardhat read-data --contract " + contractAddr + " --network " + network.name)
    })
module.exports = {}
