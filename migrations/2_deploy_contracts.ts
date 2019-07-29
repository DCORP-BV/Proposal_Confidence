// Contracts
const DcorpDissolvementProposal = artifacts.require("DcorpDissolvementProposal");

// Testing
const Accounts = artifacts.require("Accounts");
const MockDcorpProxy = artifacts.require('MockDcorpProxy');
const MockDRPSToken = artifacts.require("MockDRPSToken");
const MockDRPUToken = artifacts.require("MockDRPUToken");

// Vars
const deployingAddress = '0xA96Fd4994168bF4A15aeF72142ac605cF45b6d8e';
let dissolvementFundAddress = '';
let drpsTokenAddress = '';
let drpuTokenAddress = '';
let prevProxyAddress = '';

let preDeployAsync = () => Promise.resolve();
let postDeployAsync = () => Promise.resolve();

const isTestingNetwork = (network: string): boolean => {
  return network == 'test' || network == 'testing' || network == 'develop' || network == 'development';
};

const deployTestArtifactsAsync = async (deployer: Truffle.Deployer, accounts: string[]): Promise<void> => {
  await deployer.deploy(Accounts, accounts);
  await deployer.deploy(MockDRPSToken, 'DCorp Security', 'DRPS', 8, false);
  await deployer.deploy(MockDRPUToken, 'DCorp Utility', 'DRPU', 8, false);
  await deployer.deploy(
    MockDcorpProxy, 
    MockDRPSToken.address, 
    MockDRPUToken.address, 
    {
      value: web3.utils.toWei('2509.123456', 'ether')
    });

  let mockDRPSTokenInstance = await MockDRPSToken.deployed();
  let mockDRPUTokenInstance = await MockDRPUToken.deployed();
  let mockDcorpProxyInstance = await MockDcorpProxy.deployed();

  drpsTokenAddress = mockDRPSTokenInstance.address;
  drpuTokenAddress = mockDRPUTokenInstance.address;
  prevProxyAddress = mockDcorpProxyInstance.address;
  dissolvementFundAddress = accounts[accounts.length - 1];

  await mockDRPSTokenInstance.addOwner(prevProxyAddress);
  await mockDRPUTokenInstance.addOwner(prevProxyAddress);

  await mockDRPSTokenInstance.registerObserver(prevProxyAddress);
  await mockDRPUTokenInstance.registerObserver(prevProxyAddress);
};

const cleanUpAsync = async (deployingAccount: string): Promise<void> => {
  let mockDRPSTokenInstance = await MockDRPSToken.deployed();
  let mockDRPUTokenInstance = await MockDRPUToken.deployed();
  await mockDRPSTokenInstance.removeOwner(deployingAccount);
  await mockDRPUTokenInstance.removeOwner(deployingAccount);
};

module.exports = async function(deployer: Truffle.Deployer, network: string, accounts: string[]): Promise<void> {

  // Test env settings
  if (isTestingNetwork(network)) {
    preDeployAsync = () => deployTestArtifactsAsync(deployer, accounts);
  } else {
    postDeployAsync = () => cleanUpAsync(deployingAddress);
  }

  // Deploy
  await preDeployAsync();

  await deployer.deploy(DcorpDissolvementProposal, 
    drpsTokenAddress, drpuTokenAddress, prevProxyAddress, dissolvementFundAddress);

  await postDeployAsync();
  
} as Truffle.Migration;

export {};
