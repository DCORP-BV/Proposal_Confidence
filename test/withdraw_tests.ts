import BigNumber from 'bignumber.js';
BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN })
import { advanceTimeAndBlockAsync } from './helpers/evm';
import { 
  MockWhitelistInstance,
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
const MockWhitelist = artifacts.require('MockWhitelist');
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
  let whitelistInstance: MockWhitelistInstance;
  let prevProxyInstance: MockDcorpProxyInstance;
  let dissolvementProposalInstance: DcorpDissolvementProposalInstance;
  let drpsTokenInstance: MockTokenInstance;
  let drpuTokenInstance: MockTokenInstance;


  // Setup test
  before(async (): Promise<void> => {
    let dissolvementProposalInstanceTask = DcorpDissolvementProposal.deployed();
    let prevProxyInstanceTask = MockDcorpProxy.deployed();
    let whitelistInstanceTask = MockWhitelist.deployed();

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

    await drpuTokenInstance.transfer(
      dissolvementProposalInstance.address, excludedDrpuTokenholder.balance, { from: excludedDrpuTokenholder.account });

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
    whitelistInstance = await whitelistInstanceTask;
  });


  // State:Executed
  for (let holder of drpsTokenholders) {
    it(`DRPS account ${holder.account} should not be able to withdraw when not authenticated`, async (): Promise<void> => {
      let balanceBefore = await dissolvementProposalInstance.balanceOf(
        drpsTokenInstance.address, holder.account);

      let withdrawTask = dissolvementProposalInstance.withdraw({ 
        from: holder.account 
      });

      // Expect revert
      await truffleAssert.reverts(
        withdrawTask, 'm:only_authenticated');

      let balanceAfer = await dissolvementProposalInstance.balanceOf(
        drpsTokenInstance.address, holder.account);

      // Assert
      assert.isTrue(balanceBefore.eq(balanceAfer), 'Balance should not have changed');
    });
  }


  // State:Executed
  for (let holder of drpuTokenholders) {
    it(`DRPU account ${holder.account} should not be able to withdraw when not authenticated`, async (): Promise<void> => {
      let balanceBefore = await dissolvementProposalInstance.balanceOf(
        drpsTokenInstance.address, holder.account);

      let withdrawTask = dissolvementProposalInstance.withdraw({ 
        from: holder.account 
      });

      // Expect revert
      await truffleAssert.reverts(
        withdrawTask, 'm:only_authenticated');

      let balanceAfer = await dissolvementProposalInstance.balanceOf(
        drpsTokenInstance.address, holder.account);

      // Assert
      assert.isTrue(balanceBefore.eq(balanceAfer), 'Balance should not have changed');
    });
  }


  // State:Executed
  for (let holder of drpsTokenholders) {
    it(`DRPS account ${holder.account} should be able to withdraw when authenticated`, async (): Promise<void> => {
      let balanceBefore = new BigNumber(
        await web3.eth.getBalance(holder.account));

      // Add to whitelist
      await whitelistInstance.add(
        holder.account, { from: deployer });

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
    it(`DRPU account ${holder.account} should be able to withdraw when authenticated`, async (): Promise<void> => {
      let balanceBefore = new BigNumber(
        await web3.eth.getBalance(holder.account));

      // Add to whitelist
      await whitelistInstance.add(
        holder.account, { from: deployer });

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
  it('Should not allow withdraws after the withdraw period', async (): Promise<void> => {
    let withdrawDuration = await dissolvementProposalInstance.WITHDRAW_DURATION();

    // Add to whitelist
    await whitelistInstance.add(
      excludedDrpuTokenholder.account, { from: deployer });

    // Move to after withdraw period
    await advanceTimeAndBlockAsync(withdrawDuration.toNumber() + 1);

    let withdrawTask = dissolvementProposalInstance.withdraw({ 
      from: excludedDrpuTokenholder.account 
    });

    // Expect revert
    await truffleAssert.reverts(
      withdrawTask, 'm:only_during_withdraw_period');

    let balance = await dissolvementProposalInstance.balanceOf(
      drpuTokenInstance.address, excludedDrpuTokenholder.account);

    // Assert
    assert.strictEqual(balance.toNumber(), excludedDrpuTokenholder.balance, "Balance should not have changed");
  });


  // State:Executed
  it('Should allow the owner to destroy the contract after the withdraw period', async (): Promise<void> => {
    let ownerBalanceBefore = new BigNumber(
      await web3.eth.getBalance(deployer));

    let proposalBalanceBefore = new BigNumber(
      await web3.eth.getBalance(dissolvementProposalInstance.address));

    // Retrieve ether
    let result = await dissolvementProposalInstance.retrieveEther({ 
      from: deployer 
    });

    let ownerBalanceAfter = new BigNumber(
      await web3.eth.getBalance(deployer));

    let proposalBalanceAfter = new BigNumber(
      await web3.eth.getBalance(dissolvementProposalInstance.address));

    let tx = await web3.eth.getTransaction(result.tx);
    let gasPrice = new BigNumber(tx.gasPrice);
    let gasUsed = new BigNumber(result.receipt.gasUsed);
    let gasCost = gasPrice.multipliedBy(gasUsed);

    // Assert
    let expectedOwnerBalance = ownerBalanceBefore.plus(proposalBalanceBefore).minus(gasCost);
    assert.isTrue(ownerBalanceAfter.eq(expectedOwnerBalance), "Proposal balance should be transferred to owner");
    assert.isTrue(proposalBalanceAfter.isZero(), "Proposal balance should be zero");
  });
});
