pragma solidity ^0.5.8;

import "../../source/token/IToken.sol";
import "../../infrastructure/ownership/IMultiOwned.sol";

/**
 * @title Mock Dcorp Proxy for testing only
 *
 * #created 19/7/2019
 * #author Frank Bonnet
 */  
contract MockDcorpProxy {

    struct Proposal {
        address payable nextProxyAddress;
        uint256 deadline;
        uint256 approvedWeight;
        uint256 disapprovedWeight;
        mapping (address => uint256) voted;
    }

    Proposal public transferProposal;

    // Tokens
    IToken private drpsToken;
    IToken private drpuToken;


    /**
     * Construct the proxy
     *
     * @param _drpsToken The new security token
     * @param _drpuToken The new utility token
     */
    constructor(address _drpsToken, address _drpuToken) public payable {
        drpsToken = IToken(_drpsToken);
        drpuToken = IToken(_drpuToken);
    }


    function getDrpsToken() public view returns (address) {
        return address(drpsToken);
    }


    function getDrpuToken() public view returns (address) {
        return address(drpuToken);
    }


    function propose(address payable _nextProxyAddress) public {
        transferProposal = Proposal({
            nextProxyAddress: _nextProxyAddress,
            deadline: now,
            approvedWeight: 0,
            disapprovedWeight: 0
        });
    }


    function execute(address payable _acceptedAddress) public {

        // Add accepted address as token owner
        IMultiOwned(address(drpsToken)).addOwner(_acceptedAddress);
        IMultiOwned(address(drpuToken)).addOwner(_acceptedAddress);

        // Remove self token as owner
        IMultiOwned(address(drpsToken)).removeOwner(address(this));
        IMultiOwned(address(drpuToken)).removeOwner(address(this));

        // Transfer Eth (safe because we don't know how much gas is used counting votes)
        uint balanceBefore = _acceptedAddress.balance;
        uint balanceToSend = address(this).balance;
        _acceptedAddress.transfer(balanceToSend);

        // Assert balances
        assert(balanceBefore + balanceToSend == _acceptedAddress.balance);
        assert(address(this).balance == 0);
    }
}
