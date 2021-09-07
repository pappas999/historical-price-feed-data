let { networkConfig} = require('../helper-hardhat-config')

module.exports = async ({
  getNamedAccounts,
  deployments
}) => {
  const { deploy, log, get } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = await getChainId()
  let linkTokenAddress
   let additionalMessage = ""
  //set log level to ignore non errors
  //ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR)


  linkTokenAddress = networkConfig[chainId]['linkToken']
  const networkName = networkConfig[chainId]['name']


  const historicalPriceConsumer = await deploy('HistoricalPriceConsumer', {
    from: deployer,
    args: [],
    log: true
  })

  log("Run Historical Price Consumer contract with following command:")
  log("npx hardhat request-historical-data --contract " + historicalPriceConsumer.address + " --proxy 0x9326BFA02ADD2366b30bacB125260Af641031331 --timestamp 1625095820 " + " --network " + networkName)
  log("----------------------------------------------------")
}
module.exports.tags = ['all']
