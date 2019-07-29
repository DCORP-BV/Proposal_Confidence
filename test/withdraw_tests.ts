import BigNumber from 'bignumber.js';
BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN })
import { advanceTimeAndBlockAsync } from './helpers/evm';
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
 * #created 24/7/2019
 * #author Frank Bonnet
 */
const MockDcorpProxy = artifacts.require('MockDcorpProxy');
const MockDRPSToken = artifacts.require('MockDRPSToken');
const MockDRPUToken = artifacts.require('MockDRPUToken');
const DcorpDissolvementProposal = artifacts.require('DcorpDissolvementProposal');


/**
 * Start a cleanroom
 */
contract('Dissolvement Proposal (Execution)', ([
  deployer, someExternalAccount, 
  drpsTokenHolderAccount1, drpsTokenHolderAccount2, drpsTokenHolderAccount3, drpsTokenHolderAccount4, 
  drpuTokenHolderAccount1, drpuTokenHolderAccount2, drpuTokenHolderAccount3, drpuTokenHolderAccount4]) => {

  // Config
  const drpsTokenholders = [{
    account: drpsTokenHolderAccount1,
    balance: 18000 * Math.pow(10, 8)
  }, {
    account: drpsTokenHolderAccount2,
    balance: 540000 * Math.pow(10, 8)
  }, {
    account: drpsTokenHolderAccount3,
    balance: 400 * Math.pow(10, 8)
  }];

  const excludedDrpsTokenholder = {
    account: drpsTokenHolderAccount4,
    balance: 16000 * Math.pow(10, 8)
  };

  const drpuTokenholders = [{
    account: drpuTokenHolderAccount1,
    balance: 18000 * Math.pow(10, 8)
  }, {
    account: drpuTokenHolderAccount2,
    balance: 540000 * Math.pow(10, 8)
  }, {
    account: drpuTokenHolderAccount3,
    balance: 600  * Math.pow(10, 8) // DRPU holders must have a heigher weight
  }];

  const excludedDrpuTokenholder = {
    account: drpuTokenHolderAccount4,
    balance: 18000  * Math.pow(10, 8)
  };

  let claimTotalEther: BigNumber;
  let claimTotalWeight: BigNumber;
  let prevProxyInstance: MockDcorpProxyInstance;
  let dissolvementProposalInstance: DcorpDissolvementProposalInstance;
  let drpsTokenInstance: MockTokenInstance;
  let drpuTokenInstance: MockTokenInstance;


  // Setup test
  before(async (): Promise<void> => {
    let dissolvementProposalInstanceTask = DcorpDissolvementProposal.deployed();
    let prevProxyInstanceTask = MockDcorpProxy.deployed();

    // Get tokens
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

    tokenIssueTasks.push(drpsTokenInstance.issue(
      excludedDrpsTokenholder.account, excludedDrpsTokenholder.balance));

    for (let holder of drpuTokenholders) {
      tokenIssueTasks.push(
        drpuTokenInstance.issue(holder.account, holder.balance));
    }

    tokenIssueTasks.push(drpuTokenInstance.issue(
      excludedDrpuTokenholder.account, excludedDrpuTokenholder.balance));

    prevProxyInstance = await prevProxyInstanceTask;
    dissolvementProposalInstance = await dissolvementProposalInstanceTask;

    // Accept proposal
    await prevProxyInstance.propose(dissolvementProposalInstance.address);
    await prevProxyInstance.execute(dissolvementProposalInstance.address);
    await dissolvementProposalInstance.deploy();

    // Wait for token balances
    await Promise.all(tokenIssueTasks);

    for (let holder of drpsTokenholders) {
      await drpsTokenInstance.transfer(
        dissolvementProposalInstance.address, holder.balance, { from: holder.account });
    }

    for (let holder of drpuTokenholders) {
      await drpuTokenInstance.transfer(
        dissolvementProposalInstance.address, holder.balance, { from: holder.account });
    }

    // Forward to after claiming time
    let claimingDuration = await dissolvementProposalInstance.CLAIMING_DURATION();
    await advanceTimeAndBlockAsync(claimingDuration.toNumber() + 1);

    // Execute proposal
    await dissolvementProposalInstance.execute();

    let [claimTotalEtherTask, claimTotalWeightTask] = await Promise.all([
      dissolvementProposalInstance.claimTotalEther(),
      dissolvementProposalInstance.claimTotalWeight()
    ]);

    claimTotalEther = new BigNumber(await claimTotalEtherTask);
    claimTotalWeight = new BigNumber(await claimTotalWeightTask);
  });


  // State:Executed
  for (let holder of drpsTokenholders) {
    it(`DRPS account ${holder.account} should be able to withdraw`, async (): Promise<void> => {
      let balanceBefore = new BigNumber(
        await web3.eth.getBalance(holder.account));

      // Withdraw
      let result = await dissolvementProposalInstance.withdraw({ 
        from: holder.account 
      });

      let tx = await web3.eth.getTransaction(result.tx);
      let gasPrice = new BigNumber(tx.gasPrice);
      let gasUsed = new BigNumber(result.receipt.gasUsed);
      let gasCost = gasPrice.multipliedBy(gasUsed);

      let weight = new BigNumber(holder.balance * 2);
      let share = weight.multipliedBy(claimTotalEther).dividedBy(claimTotalWeight);
      let expectedBalance = balanceBefore.minus(gasCost).plus(share);

      let balanceAfer = new BigNumber(
        await web3.eth.getBalance(holder.account));

      // Assert
      assert.isTrue(expectedBalance.eq(balanceAfer), 'Balance does not match expected balance');
    });
  }


  // State:Executed
  for (let holder of drpuTokenholders) {
    it(`DRPU account ${holder.account} should be able to withdraw`, async (): Promise<void> => {
      let balanceBefore = new BigNumber(
        await web3.eth.getBalance(holder.account));

      // Withdraw
      let result = await dissolvementProposalInstance.withdraw({ 
        from: holder.account 
      });

      let tx = await web3.eth.getTransaction(result.tx);
      let gasPrice = new BigNumber(tx.gasPrice);
      let gasUsed = new BigNumber(result.receipt.gasUsed);
      let gasCost = gasPrice.multipliedBy(gasUsed);

      let weight = new BigNumber(holder.balance);
      let share = weight.multipliedBy(claimTotalEther).dividedBy(claimTotalWeight);
      let expectedBalance = balanceBefore.minus(gasCost).plus(share);

      let balanceAfer = new BigNumber(
        await web3.eth.getBalance(holder.account));

      // Assert
      assert.isTrue(expectedBalance.eq(balanceAfer), 'Balance does not match expected balance');
    });
  }


  // State:Executed
  it('Remaining balance of the proposal should be near to zero', async (): Promise<void> => {
    let balance = await new BigNumber(
      await web3.eth.getBalance(dissolvementProposalInstance.address));

    // Assert
    let maxBalance = web3.utils.toWei('1', 'kwei'); // Due to rouding rounding remainders
    assert.isTrue(balance.isLessThanOrEqualTo(maxBalance), 'Balance should be zero');
  });
});
