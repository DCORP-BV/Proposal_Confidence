pragma solidity ^0.5.8;

import "./ITokenRetriever.sol";
import "../IToken.sol";

/**
 * @title Token retrieve
 *
 * Allows tokens to be retrieved from a contract
 *
 * #created 18/10/2017
 * #author Frank Bonnet
 */
contract TokenRetriever is ITokenRetriever {

    /**
     * Extracts tokens from the contract
     *
     * @param _tokenContract The address of ERC20 compatible token
     */
    function retrieveTokens(address _tokenContract) public {
        IToken tokenInstance = IToken(_tokenContract);
        uint tokenBalance = tokenInstance.balanceOf(address(this));
        if (tokenBalance > 0) {
            tokenInstance.transfer(msg.sender, tokenBalance);
        }
    }
}