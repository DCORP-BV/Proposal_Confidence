pragma solidity ^0.5.8;

/**
 * Call proxy used to abstract low level calls used for testing purposes 
 * 
 * Based on: http://truffleframework.com/tutorials/testing-for-throws-in-solidity-tests
 *
 * #created 01/10/2017
 * #author Frank Bonnet
 */
contract CallProxy {

    // Target contract
    address private target;

    // Calldata
    bytes private data;


    /**
     * Constuct for target contract
     *
     * @param _target The contact that is being tested
     */
    constructor(address _target) public {
        target = _target;
    }
    

   /**
    * Capture call data
    * 
    * This works because the called method does not exist
    * and the fallback function is called instead
    */
    function () external payable {
        data = msg.data;
    }


    /**
     * Test if `target` would have thrown when calling the 
     * target method
     *
     * @return Wheter the call resulted in an exception or not
     */
    function throws() public returns (bool) {
        (bool result,) = target.call(data);
        return result;
    }
}