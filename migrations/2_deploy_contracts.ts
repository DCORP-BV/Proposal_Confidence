// Contracts
const DcorpDissolvementProposal = artifacts.require("DcorpDissolvementProposal");

// Testing
const Accounts = artifacts.require("Accounts");
const MockWhitelist = artifacts.require('MockWhitelist');
const MockDcorpProxy = artifacts.require('MockDcorpProxy');
const MockDRPSToken = artifacts.require("MockDRPSToken");
const MockDRPUToken = artifacts.require("MockDRPUToken");

// Vars
const deployingAddress = '0xA96Fd4994168bF4A15aeF72142ac605cF45b6d8e';
let whitelistAddress = '0xdd5cec9019ec8449a5d01d0d8175e6519530d276';
let dissolvementFundAddress = '0xA96Fd4994168bF4A15aeF72142ac605cF45b6d8e';
let drpsTokenAddress = '0x3e250a4f78410c29cfc39463a81f14a226690eb4';
let drpuTokenAddress = '0xe30e02f049957e2a5907589e06ba646fb2c321ba';
let prevProxyAddress = '0x01d5d0108589f3c52fcce6e65503bb6515e66698';

let preDeployAsync = () => Promise.resolve();
let postDeployAsync = () => Promise.resolve();

const isTestingNetwork = (network: string): boolean => {
  return network == 'test' || network == 'testing' || network == 'develop' || network == 'development' || network == 'ropsten';
};

const deployTestArtifactsAsync = async (deployer: Truffle.Deployer, network: string, accounts: string[]): Promise<void> => {
  await deployer.deploy(Accounts, accounts);
  await deployer.deploy(MockWhitelist);
  await deployer.deploy(MockDRPSToken, 'DCorp Security', 'DRPS', 8, false);
  await deployer.deploy(MockDRPUToken, 'DCorp Utility', 'DRPU', 8, false);

  if (network == 'ropsten') {
    await deployer.deploy(
      MockDcorpProxy, 
      MockDRPSToken.address, 
      MockDRPUToken.address, 
      {
        value: web3.utils.toWei('0.123456', 'ether')
      });
  }
  else {
    await deployer.deploy(
      MockDcorpProxy, 
      MockDRPSToken.address, 
      MockDRPUToken.address, 
      {
        value: web3.utils.toWei('2509.123456', 'ether')
      });
  }
  
  let mockWhitelistInstance = await MockWhitelist.deployed();
  let mockDRPSTokenInstance = await MockDRPSToken.deployed();
  let mockDRPUTokenInstance = await MockDRPUToken.deployed();
  let mockDcorpProxyInstance = await MockDcorpProxy.deployed();

  whitelistAddress = mockWhitelistInstance.address;
  drpsTokenAddress = mockDRPSTokenInstance.address;
  drpuTokenAddress = mockDRPUTokenInstance.address;
  prevProxyAddress = mockDcorpProxyInstance.address;
  dissolvementFundAddress = accounts[accounts.length - 1];

  await mockDRPSTokenInstance.addOwner(prevProxyAddress);
  await mockDRPUTokenInstance.addOwner(prevProxyAddress);

  await mockDRPSTokenInstance.registerObserver(prevProxyAddress);
  await mockDRPUTokenInstance.registerObserver(prevProxyAddress);
};

module.exports = async function(deployer: Truffle.Deployer, network: string, accounts: string[]): Promise<void> {

  // Test env settings
  if (isTestingNetwork(network)) {
    preDeployAsync = () => deployTestArtifactsAsync(deployer, network, accounts);
  }

  // Deploy
  await preDeployAsync();

  await deployer.deploy(DcorpDissolvementProposal, 
    whitelistAddress, drpsTokenAddress, drpuTokenAddress, prevProxyAddress, dissolvementFundAddress);

  await postDeployAsync();
  
} as Truffle.Migration;

export {};
