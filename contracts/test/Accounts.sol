pragma solidity ^0.5.8;

/**
 * Accounts wrapper for unit tests
 *
 * #created 01/10/2017
 * #author Frank Bonnet
 */  
contract Accounts {

    address[] private accounts;


   /**
    * Accept accounts
    * 
    * @param _accounts List of accounts to grant access to
    */  
    constructor(address[] memory _accounts) public {
        accounts = _accounts;
    }


   /**
    * Returns the number of accounts
    * 
    * @return Number of accounts
    */  
    function length() public view returns (uint) {
        return accounts.length;
    }


   /**
    * Returns the account at `_index` 
    * 
    * @param _index Location of the account
    * @return address
    */ 
    function get(uint _index) public view returns (address) {
        return accounts[_index];
    }
}