pragma solidity ^0.5.8;

import "./MockToken.sol";

/**
 * @title Mock DRPU Token for testing only
 *
 * #created 7/23/2019
 * #author Frank Bonnet
 */  
contract MockDRPUToken is MockToken {

    /**
     * Construct DRPU mock token
     */
    constructor(string memory _name, string memory _symbol, uint8 _decimals, bool _locked) public
        MockToken(_name, _symbol, _decimals, _locked) {}
}