pragma solidity ^0.5.8;

import "./MockToken.sol";

/**
 * @title Mock DRPS Token for testing only
 *
 * #created 7/23/2019
 * #author Frank Bonnet
 */  
contract MockDRPSToken is MockToken {

    /**
     * Construct DRPS mock token
     */
    constructor(string memory _name, string memory _symbol, uint8 _decimals, bool _locked) public
        MockToken(_name, _symbol, _decimals, _locked) {}
}