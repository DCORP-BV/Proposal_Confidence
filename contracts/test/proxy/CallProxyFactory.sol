pragma solidity ^0.5.8;

import "./CallProxy.sol";

/**
 * CallProxy creation
 *
 * #created 01/10/2017
 * #author Frank Bonnet
 */  
contract CallProxyFactory {

    /**
     * Create a CallProxy instance
     */
    function create(address _target) public returns (address) {
        return address(new CallProxy(_target));
    }
}