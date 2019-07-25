import BigNumber from 'bignumber.js';
import { 
  MockDcorpProxyInstance, 
  MockTokenInstance, 
  DcorpDissolvementProposalInstance
} from '../types/truffle-contracts';

const truffleAssert = require('truffle-assertions');

/* global assert, it, artifacts, contract, before */

/**
 * DCORP Proxy execution integration tests
 *
 * #created 25/7/2019
 * #author Frank Bonnet
 */
const MockDcorpProxy = artifacts.require('MockDcorpProxy');
const MockDRPSToken = artifacts.require('MockDRPSToken');
const MockDRPUToken = artifacts.require('MockDRPUToken');
const DcorpDissolvementProposal = artifacts.require('DcorpDissolvementProposal');


/**
 * Start a cleanroom
 */
contract('Dissolvement Proposal (Deploy)', ([deployer, someExternalAccount, drpsTokenHolderAccount, drpuTokenHolderAccount]) => {
  // Config
  let drpsTokenholders = [{
    account: drpsTokenHolderAccount,
    balance: 9000
  }];

  let drpuTokenholders = [{
    account: drpuTokenHolderAccount,
    balance: 54000
  }];

  let prevProxyBalance: BigNumber;
  let prevProxyInstance: MockDcorpProxyInstance;
  let dissolvementProposalInstance: DcorpDissolvementProposalInstance;
  let drpsTokenInstance: MockTokenInstance;
  let drpuTokenInstance: MockTokenInstance;


    // Setup test
  before(async (): Promise<void> => {
    let dissolvementProposalInstanceTask = DcorpDissolvementProposal.deployed();
    let prevProxyInstanceTask = MockDcorpProxy.deployed();

    prevProxyInstance = await prevProxyInstanceTask;
    let prevProxyBalanceTask = web3.eth.getBalance(
      prevProxyInstance.address);

    [drpsTokenInstance, drpuTokenInstance] = await Promise.all([
      MockDRPSToken.deployed(),
      MockDRPUToken.deployed()
    ]);

    // Issue tokens
    let tokenIssueTasks: Promise<Truffle.TransactionResponse>[] = [];
    for (let holder of drpsTokenholders) {
      tokenIssueTasks.push(
        drpsTokenInstance.issue(holder.account, holder.balance));
    }

    for (let holder of drpuTokenholders) {
      tokenIssueTasks.push(
        drpuTokenInstance.issue(holder.account, holder.balance));
    }

    // Propose
    dissolvementProposalInstance = await dissolvementProposalInstanceTask;
    await prevProxyInstance.propose(dissolvementProposalInstance.address);
  
    await Promise.all(tokenIssueTasks);
    prevProxyBalance = new BigNumber(
      await prevProxyBalanceTask); 
  });


  // State:Deploying
  it('Should be in the deploying stage initially', async (): Promise<void> => {

    // Assert
    let isDeploying = await dissolvementProposalInstance.isDeploying();
    assert.isTrue(isDeploying, 'Should be in the deploying stage');
  });


  // State:Deploying
  it('Should not be able to deploy before receiving eth', async (): Promise<void> => {

    // Expect revert
    await truffleAssert.reverts(
      dissolvementProposalInstance.deploy(), 'f:deploy;e:invalid_balance');

    // Assert
    let isDeployed = await dissolvementProposalInstance.isDeployed();
    assert.isFalse(isDeployed, 'Should be in the deploying stage');
  });


  // State:Deploying
  it('Should not accept eth from any other address than the prev proxy', async (): Promise<void> => {
    let sendTransactionTask = web3.eth.sendTransaction({
      to: dissolvementProposalInstance.address, 
      from: someExternalAccount,
      value: prevProxyBalance.toString()
    });

    // Expect revert
    await truffleAssert.reverts(
      sendTransactionTask, 'f:fallback;e:invalid_sender');
    
    // Assert
    let balance = await web3.eth.getBalance(dissolvementProposalInstance.address);
    assert.isTrue(new BigNumber(balance).eq(0), 'Balance should not be updated');

    let isDepoying = await dissolvementProposalInstance.isDeploying();
    assert.isTrue(isDepoying, 'Should be in the deploying stage');
  });


  // State:Deploying
  it('Should be able to send eth in the deploying stage', async (): Promise<void> => {

    // Execute proposal
    await prevProxyInstance.execute(dissolvementProposalInstance.address);

    // Assert
    let balance = await web3.eth.getBalance(dissolvementProposalInstance.address);
    assert.isTrue(new BigNumber(balance).eq(prevProxyBalance), 'Balance should be transferred from prev proxy to dissolvement proposal');
  });


  // State:Deploying -> Deployed
  it('Should be able to deploy after receiving eth', async (): Promise<void> => {
    let dissolvementFundAccount = await dissolvementProposalInstance.dissolvementFund();
    let [balanceBefore, dissolvementFundAmount] = await Promise.all([
      web3.eth.getBalance(dissolvementFundAccount),
      dissolvementProposalInstance.DISSOLVEMENT_AMOUNT()
    ]);

    // Deploy passed proposal
    await dissolvementProposalInstance.deploy();

    // Assert
    let balanceAfter = new BigNumber(await web3.eth.getBalance(dissolvementFundAccount));
    let expected = (new BigNumber(balanceBefore)).plus(dissolvementFundAmount);
    assert.isTrue(balanceAfter.eq(expected), 'dissolvement funds should be transferred');

    let isDeployed = await dissolvementProposalInstance.isDeployed();
    assert.isTrue(isDeployed, 'Should be in the deployed stage');
  });


  // State:Deployed
  it('Should not be able to send eth to the dissolvement proposal in the deployed stage', async (): Promise<void> => {
    let balanceBefore = await web3.eth.getBalance(
      dissolvementProposalInstance.address);

    let sendTransactionTask = web3.eth.sendTransaction({
      to: dissolvementProposalInstance.address, 
      from: someExternalAccount,
      value: prevProxyBalance.toString()
    });

    // Expect revert
    await truffleAssert.reverts(
      sendTransactionTask, 'm:only_at_stage');

    let balanceAfter = await web3.eth.getBalance(
      dissolvementProposalInstance.address);

    // Assert
    assert.equal(balanceAfter, balanceBefore, 'Balance should not be updated');
  });


  // State:Deployed
  it('Should not allow any account other than the drp tokens to call notifyTokensReceived()', async (): Promise<void> => {
    let holder = drpsTokenholders[0];
    let token = drpsTokenInstance.address;

    // Expect revert
    await truffleAssert.reverts(
      dissolvementProposalInstance.notifyTokensReceived(holder.account, 10, {from: holder.account}), 'm:only_accepted_token');

    let balance = await dissolvementProposalInstance.balanceOf(token, holder.account);
    assert.isTrue(new BigNumber(balance).eq(0), 'No tokens should have been allocated');
  });


  // State:Deployed
  it('Should accept drps tokens in the deployed stage', async (): Promise<void> => {
    let holder = drpsTokenholders[0];

    // Transfer 
    await drpsTokenInstance.transfer(
      dissolvementProposalInstance.address, 
      holder.balance, 
      {
        from: holder.account
      });

    // Assert
    let drpsBalance = await drpsTokenInstance.balanceOf(dissolvementProposalInstance.address);
    assert.isTrue(new BigNumber(drpsBalance).eq(holder.balance), 'Proxy should have a drps balance');
  });


  // State:Deployed
  it('Should accept drpu tokens in the deployed stage', async (): Promise<void> => {
    let holder = drpuTokenholders[0];

    // Transfer 
    await drpuTokenInstance.transfer(
      dissolvementProposalInstance.address, 
      holder.balance, 
      {
        from: holder.account
      });

    // Assert
    let drpuBalance = await drpuTokenInstance.balanceOf(dissolvementProposalInstance.address);
    assert.isTrue(new BigNumber(drpuBalance).eq(holder.balance), 'Proxy should have a drpu balance');
  });
});