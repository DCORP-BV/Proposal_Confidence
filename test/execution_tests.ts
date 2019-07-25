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

  // All token holders
  const tokenholders = drpsTokenholders.concat(drpuTokenholders);

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
  });


  // State:Deployed
  it('Should not be able to execute before the claim period has ended', async (): Promise<void> => {

    // Expect revert
    await truffleAssert.reverts(
      dissolvementProposalInstance.execute(), 'm:only_after_claiming_period');

    // Assert
    let isDissolved = await dissolvementProposalInstance.isDissolved();
    assert.isFalse(isDissolved, 'Should be in the deploying stage');
  });


  // State:Deployed
  for (let holder of drpsTokenholders) {
    it(`Should accept ${holder.balance} drps tokens in the deployed state`, async (): Promise<void> => {
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
    it(`Should accept ${holder.balance} drpu tokens in the deployed state`, async (): Promise<void> => {
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


});
