pragma solidity ^0.5.8;

import "./token/IToken.sol";
import "./token/IManagedToken.sol";
import "./token/observer/TokenObserver.sol";
import "./token/retriever/TokenRetriever.sol";
import "../infrastructure/behaviour/IObservable.sol";
import "../infrastructure/ownership/IMultiOwned.sol";
import "../infrastructure/ownership/TransferableOwnership.sol";

/**
 * @title Dcorp Dissolvement Proposal
 *
 * Serves as a placeholder for the Dcorp funds, allowing the community the ability 
 * to claim their part of the ether. 
 *
 * This contact is deployed upon receiving the Ether that is currently held by the previous proxy contract.
 *
 * #created 18/7/2019
 * #author Frank Bonnet
 */
contract DcorpDissolvementProposal is TokenObserver, TransferableOwnership, TokenRetriever {

    enum Stages {
        Deploying,
        Deployed,
        Executed
    }

    struct Balance {
        uint drps;
        uint drpu;
        uint index;
    }

    // State
    Stages private stage;

    // Settings
    uint public constant CLAIMING_DURATION = 60 days;
    uint public constant WITHDRAW_DURATION = 60 days;
    uint public constant DISSOLVEMENT_AMOUNT = 1000 ether;

    // Alocated balances
    mapping (address => Balance) private allocated;
    address[] private allocatedIndex;

    // Tokens
    IToken public drpsToken;
    IToken public drpuToken;

    // Previous proxy
    address public prevProxy;
    uint public prevProxyRecordedBalance;

    // Dissolvement
    address payable public dissolvementFund;

    uint public claimTotalWeight;
    uint public claimTotalEther;
    uint public claimDeadline;
    uint public withdrawDeadline;
    

    /**
     * Require that the contract is in `_stage` 
     */
    modifier only_at_stage(Stages _stage) {
        require(stage == _stage, "m:only_at_stage");
        _;
    }


    /**
     * Require that now is past `_timestamp` 
     */
    modifier only_after(uint _timestamp) {
        require(now > _timestamp, "m:only_after");
        _;
    }


    /**
     * Require `_token` to be one of the drp tokens
     *
     * @param _token The address to test against
     */
    modifier only_accepted_token(address _token) {
        require(_token == address(drpsToken) || _token == address(drpuToken), "m:only_accepted_token");
        _;
    }


    /**
     * Require that `_token` is not one of the drp tokens
     *
     * @param _token The address to test against
     */
    modifier not_accepted_token(address _token) {
        require(_token != address(drpsToken) && _token != address(drpuToken), "m:not_accepted_token");
        _;
    }


    /**
     * Require that sender has more than zero tokens 
     */
    modifier only_token_holder() {
        require(allocated[msg.sender].drps > 0 || allocated[msg.sender].drpu > 0, "m:only_token_holder");
        _;
    }


    /**
     * Require that the claiming period for the proposal has
     * not yet ended
     */
    modifier only_during_claiming_period() {
        require(claimDeadline > 0 && now <= claimDeadline, "m:only_during_claiming_period");
        _;
    }


    /**
     * Require that the claiming period for the proposal has ended
     */
    modifier only_after_claiming_period() {
        require(claimDeadline > 0 && now > claimDeadline, "m:only_after_claiming_period");
        _;
    }


    /**
     * Require that the withdraw period for the proposal has
     * not yet ended
     */
    modifier only_during_withdraw_period() {
        require(withdrawDeadline > 0 && now <= withdrawDeadline, "m:only_during_withdraw_period");
        _;
    }


    /**
     * Require that the withdraw period for the proposal has ended
     */
    modifier only_after_withdraw_period() {
        require(withdrawDeadline > 0 && now > withdrawDeadline, "m:only_after_withdraw_period");
        _;
    }
    

    /**
     * Construct the proxy
     *
     * @param _drpsToken The new security token
     * @param _drpuToken The new utility token
     * @param _prevProxy Proxy accepts and requires ether from the prev proxy
     * @param _dissolvementFund Ether to be used for the dissolvement of DCORP
     */
    constructor(address _drpsToken, address _drpuToken, address _prevProxy, address payable _dissolvementFund) public {
        drpsToken = IToken(_drpsToken);
        drpuToken = IToken(_drpuToken);
        prevProxy = _prevProxy;
        prevProxyRecordedBalance = _prevProxy.balance;
        dissolvementFund = _dissolvementFund;
        stage = Stages.Deploying;
    }


    /**
     * Returns whether the proposal is being deployed
     *
     * @return Whether the proposal is in the deploying stage
     */
    function isDeploying() public view returns (bool) {
        return stage == Stages.Deploying;
    }


    /**
     * Returns whether the proposal is deployed. The proposal is deployed 
     * when it receives Ether from the prev proxy contract
     *
     * @return Whether the proposal is deployed
     */
    function isDeployed() public view returns (bool) {
        return stage == Stages.Deployed;
    }


    /**
     * Returns whether the proposal is executed
     *
     * @return Whether the proposal is deployed
     */
    function isExecuted() public view returns (bool) {
        return stage == Stages.Executed;
    }


    /**
     * Accept eth from the prev proxy while deploying
     */
    function () external payable only_at_stage(Stages.Deploying) {
        require(msg.sender == address(prevProxy), "f:fallback;e:invalid_sender");
    }


    /**
     * Deploy the proposal
     */
    function deploy() public only_owner only_at_stage(Stages.Deploying) {
        require(address(this).balance >= prevProxyRecordedBalance, "f:deploy;e:invalid_balance");

        // Mark deployed
        stage = Stages.Deployed;
        
        // Start claiming period
        claimDeadline = now + CLAIMING_DURATION;

        // Remove prev proxy as observer
        IObservable(address(drpsToken)).unregisterObserver(prevProxy);
        IObservable(address(drpuToken)).unregisterObserver(prevProxy);

        // Register this proxy as observer
        IObservable(address(drpsToken)).registerObserver(address(this));
        IObservable(address(drpuToken)).registerObserver(address(this));

        // Transfer dissolvement funds
        uint amountToTransfer = DISSOLVEMENT_AMOUNT;
        if (amountToTransfer > address(this).balance) {
            amountToTransfer = address(this).balance;
        }

        dissolvementFund.transfer(amountToTransfer);
    }


    /**
     * Returns the combined total supply of all drp tokens
     *
     * @return The combined total drp supply
     */
    function getTotalSupply() public view returns (uint) {
        uint sum = 0; 
        sum += drpsToken.totalSupply();
        sum += drpuToken.totalSupply();
        return sum;
    }


    /**
     * Returns true if `_owner` has a balance allocated
     *
     * @param _owner The account that the balance is allocated for
     * @return True if there is a balance that belongs to `_owner`
     */
    function hasBalance(address _owner) public view returns (bool) {
        return allocatedIndex.length > 0 && _owner == allocatedIndex[allocated[_owner].index];
    }


    /** 
     * Get the allocated drps or drpu token balance of `_owner`
     * 
     * @param _token The address to test against
     * @param _owner The address from which the allocated token balance will be retrieved
     * @return The allocated drps token balance
     */
    function balanceOf(address _token, address _owner) public view returns (uint) {
        uint balance = 0;
        if (address(drpsToken) == _token) {
            balance = allocated[_owner].drps;
        } 
        
        else if (address(drpuToken) == _token) {
            balance = allocated[_owner].drpu;
        }

        return balance;
    }


    /**
     * Executes the proposal
     *
     * Dissolves DCORP Decentralized and allows the ether to be withdrawn
     *
     * Should only be called after the claiming period
     */
    function execute() public only_at_stage(Stages.Deployed) only_after_claiming_period {
        
        // Mark as executed
        stage = Stages.Executed;
        withdrawDeadline = now + WITHDRAW_DURATION;

        // Remaining balance is claimable
        claimTotalEther = address(this).balance;

        // Disable tokens
        IManagedToken(address(drpsToken)).lock();
        IManagedToken(address(drpuToken)).lock();

        // Remove self token as owner
        IMultiOwned(address(drpsToken)).removeOwner(address(this));
        IMultiOwned(address(drpuToken)).removeOwner(address(this));
    }


    /**
     * Allows an account to claim ether during the claiming period
     */
    function withdraw() public only_at_stage(Stages.Executed) only_during_withdraw_period only_token_holder {
        Balance storage b = allocated[msg.sender];
        uint weight = b.drpu + _convertDrpsWeight(b.drps);

        // Mark claimed
        b.drpu = 0;
        b.drps = 0;

        // Transfer amount
        uint amountToTransfer = weight * claimTotalEther / claimTotalWeight;
        msg.sender.transfer(amountToTransfer);
    }


    /**
     * Event handler that initializes the token conversion
     * 
     * Called by `_token` when a token amount is received on 
     * the address of this token changer
     *
     * @param _token The token contract that received the transaction
     * @param _from The account or contract that send the transaction
     * @param _value The value of tokens that where received
     */
    function onTokensReceived(address _token, address _from, uint _value) internal only_during_claiming_period only_accepted_token(_token) {
        require(_token == msg.sender, "f:onTokensReceived;e:only_receiving_token");

        // Allocate tokens
        if (!hasBalance(_from)) {
            allocated[_from] = Balance(
                0, 0, allocatedIndex.push(_from) - 1);
        }

        Balance storage b = allocated[_from];
        if (_token == address(drpsToken)) {
            b.drps += _value;
            claimTotalWeight += _convertDrpsWeight(_value);
        } else {
            b.drpu += _value;
            claimTotalWeight += _value;
        }
    }


    /**
     * Failsafe mechanism
     * 
     * Allows the owner to retrieve ether from the contract that was not claimed 
     * within the claiming period.
     */
    function retrieveEther() public only_owner only_after_withdraw_period {
        selfdestruct(msg.sender);
    }


    /**
     * Failsafe mechanism
     * 
     * Allows the owner to retrieve tokens (other than DRPS and DRPU tokens) from the contract that 
     * might have been send there by accident
     *
     * @param _tokenContract The address of ERC20 compatible token
     */
    function retrieveTokens(address _tokenContract) public only_owner not_accepted_token(_tokenContract) {
        super.retrieveTokens(_tokenContract);
    }


    /**
     * Converts the weight for DRPS tokens
     * 
     * @param _value The amount of tokens to convert
     */
    function _convertDrpsWeight(uint _value) private pure returns (uint) {
        return _value * 2;
    }
}
