import BigNumber from 'bignumber.js';
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
    balance: 18000
  }, {
    account: drpsTokenHolderAccount2,
    balance: 540000
  }, {
    account: drpsTokenHolderAccount3,
    balance: 400
  }];

  const excludedDrpsTokenholder = {
    account: drpsTokenHolderAccount4,
    balance: 16000
  };

  const drpuTokenholders = [{
    account: drpuTokenHolderAccount1,
    balance: 18000
  }, {
    account: drpuTokenHolderAccount2,
    balance: 540000
  }, {
    account: drpuTokenHolderAccount3,
    balance: 600 // DRPU holders must have a heigher weight
  }];

  const excludedDrpuTokenholder = {
    account: drpuTokenHolderAccount4,
    balance: 18000
  };

  let prevProxyBalance: BigNumber;
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
    let prevProxyBalanceTask = web3.eth.getBalance(
      prevProxyInstance.address);
      
    dissolvementProposalInstance = await dissolvementProposalInstanceTask;
    prevProxyBalance = new BigNumber(await prevProxyBalanceTask);

    // Accept proposal
    await prevProxyInstance.propose(dissolvementProposalInstance.address);
    await prevProxyInstance.execute(dissolvementProposalInstance.address);
    await dissolvementProposalInstance.deploy();

    // Wait for token balances
    await Promise.all(tokenIssueTasks);
  });


  // State:Deployed
  for (let holder of drpsTokenholders) {
    it(`Should accept and record ${holder.balance} drps tokens in the deployed state`, async (): Promise<void> => {
      let response = await drpsTokenInstance.transfer(
        dissolvementProposalInstance.address, holder.balance, { from: holder.account });
      
      let [result, balance] = await Promise.all([
        truffleAssert.createTransactionResult(drpsTokenInstance, response.tx),
        dissolvementProposalInstance.balanceOf(drpsTokenInstance.address, holder.account)
      ]);

      // Assert
      truffleAssert.eventEmitted(result, 'Transfer', (ev: any) => {
        let actualValue = new BigNumber(ev._value);
        let expectedValue = new BigNumber(holder.balance);
        return ev._from === holder.account && ev._to === dissolvementProposalInstance.address && actualValue.eq(expectedValue);
      });

      let eq = (new BigNumber(balance)).eq(new BigNumber(holder.balance));
      assert.isTrue(eq, `A drps balance of ${holder.balance} should be recorded`);
    });
  }


  // State:Deployed
  for (let holder of drpuTokenholders) {
    it(`Should accept and record ${holder.balance} drpu tokens in the deployed state`, async (): Promise<void> => {
      let response = await drpuTokenInstance.transfer(
        dissolvementProposalInstance.address, holder.balance, { from: holder.account });
      
      let [result, balance] = await Promise.all([
        truffleAssert.createTransactionResult(drpuTokenInstance, response.tx),
        dissolvementProposalInstance.balanceOf(drpuTokenInstance.address, holder.account)
      ]);

      // Assert
      truffleAssert.eventEmitted(result, 'Transfer', (ev: any) => {
        let actualValue = new BigNumber(ev._value);
        let expectedValue = new BigNumber(holder.balance);
        return ev._from === holder.account && ev._to === dissolvementProposalInstance.address && actualValue.eq(expectedValue);
      });

      let eq = (new BigNumber(balance)).eq(new BigNumber(holder.balance));
      assert.isTrue(eq, `A drpu balance of ${holder.balance} should be recorded`);
    });
  }


  // State:Deployed
  it('Should not be able to execute before the claim period has ended', async (): Promise<void> => {

    // Expect revert
    await truffleAssert.reverts(
      dissolvementProposalInstance.execute(), 'm:only_after_claiming_period');

    // Assert
    let isExecuted = await dissolvementProposalInstance.isExecuted();
    assert.isFalse(isExecuted, 'Should be in the deploying stage');
  });


  // State:Deployed
  it('Should not accept and record drps tokens after the claiming period', async (): Promise<void> => {
    let claimingDuration = await dissolvementProposalInstance.CLAIMING_DURATION();

    // Forward to after claiming time
    await advanceTimeAndBlockAsync(claimingDuration.toNumber());

    let transfer = drpsTokenInstance.transfer(
      dissolvementProposalInstance.address, excludedDrpsTokenholder.balance, { from: excludedDrpsTokenholder.account });

    // Expect revert
    await truffleAssert.reverts(
      transfer, 'm:only_during_claiming_period');

    let balanceInProposal = await dissolvementProposalInstance.balanceOf(
      drpsTokenInstance.address, excludedDrpsTokenholder.account);

    let balanceInToken = await drpsTokenInstance.balanceOf(
      excludedDrpsTokenholder.account);

    // Assert
    balanceInProposal =  new BigNumber(balanceInProposal);
    balanceInToken =  new BigNumber(balanceInToken);

    assert.isTrue(balanceInProposal.isZero(), 'A drps balance of 0 should be recorded');
    assert.isTrue(balanceInToken.eq(excludedDrpsTokenholder.balance), `A drps balance of ${excludedDrpsTokenholder.balance} should be recorded`);
  });


  // State:Deployed
  it('Should not accept and record drpu tokens after the claiming period', async (): Promise<void> => {
    let transfer = drpuTokenInstance.transfer(
      dissolvementProposalInstance.address, excludedDrpuTokenholder.balance, { from: excludedDrpuTokenholder.account });

    // Expect revert
    await truffleAssert.reverts(
      transfer, 'm:only_during_claiming_period');

    let balanceInProposal = await dissolvementProposalInstance.balanceOf(
      drpuTokenInstance.address, excludedDrpuTokenholder.account);

    let balanceInToken = await drpuTokenInstance.balanceOf(
      excludedDrpuTokenholder.account);

    // Assert
    balanceInProposal =  new BigNumber(balanceInProposal);
    balanceInToken =  new BigNumber(balanceInToken);

    assert.isTrue(balanceInProposal.isZero(), 'A drpu balance of 0 should be recorded');
    assert.isTrue(balanceInToken.eq(excludedDrpuTokenholder.balance), `A drpu balance of ${excludedDrpuTokenholder.balance} should be recorded`);
  });


  // State:Deployed -> Executed
  it('Should be able to execute after the claim period has ended', async (): Promise<void> => {

    // Execute proposal
    await dissolvementProposalInstance.execute();

    // Assert
    let isExecuted = await dissolvementProposalInstance.isExecuted();
    assert.isTrue(isExecuted, 'Should be in the executed stage');
  });


  // State:Executed
  it('Should have a claimable balance', async (): Promise<void> => {
    let [claimTotalEther, dissolvementAmount] = await Promise.all([
      dissolvementProposalInstance.claimTotalEther(), 
      dissolvementProposalInstance.DISSOLVEMENT_AMOUNT()
    ]);

    claimTotalEther = new BigNumber(claimTotalEther);
    dissolvementAmount = new BigNumber(dissolvementAmount);

    // Assert
    assert.isTrue(claimTotalEther.eq(prevProxyBalance.minus(dissolvementAmount)), 'Incorrect total claimable amount');
  });


  // State:Executed
  it('Drps token should be locked after executing the proposal', async (): Promise<void> => {
    let isLocked = await drpsTokenInstance.isLocked();
    assert.isTrue(isLocked, 'DRPS token should be locked');
  });


  // State:Executed
  it('Drpu token should be locked after executing the proposal', async (): Promise<void> => {
    let isLocked = await drpuTokenInstance.isLocked();
    assert.isTrue(isLocked, 'DRPU token should be locked');
  });
});
