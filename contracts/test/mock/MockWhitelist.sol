pragma solidity ^0.5.8;

/**
 * @title Mock Whitelist 
 *
 * Whitelist authentication list
 *
 * #created 30/7/2019
 * #author Frank Bonnet
 */
contract MockWhitelist {

    struct Entry {
        uint datetime;
        bool accepted;
        uint index;
    }

    mapping (address => Entry) internal list;
    address[] internal listIndex;


    /**
     * Returns whether an entry exists for `_account`
     *
     * @param _account The account to check
     * @return whether `_account` is has an entry in the whitelist
     */
    function hasEntry(address _account) public view returns (bool) {
        return listIndex.length > 0 && _account == listIndex[list[_account].index];
    }


    /**
     * Add `_account` to the whitelist
     *
     * If an account is currently disabled, the account is reenabled, otherwise 
     * a new entry is created
     *
     * @param _account The account to add
     */
    function add(address _account) public {
        if (!hasEntry(_account)) {
            list[_account] = Entry(
                now, true, listIndex.push(_account) - 1);
        } else {
            Entry storage entry = list[_account];
            if (!entry.accepted) {
                entry.accepted = true;
                entry.datetime = now;
            }
        }
    }


    /**
     * Remove `_account` from the whitelist
     *
     * Will not acctually remove the entry but disable it by updating
     * the accepted record
     *
     * @param _account The account to remove
     */
    function remove(address _account) public {
        if (hasEntry(_account)) {
            Entry storage entry = list[_account];
            entry.accepted = false;
            entry.datetime = now;
        }
    }


    /**
     * Authenticate 
     *
     * Returns whether `_account` is on the whitelist
     *
     * @param _account The account to authenticate
     * @return whether `_account` is successfully authenticated
     */
    function authenticate(address _account) public view returns (bool) {
        return list[_account].accepted;
    }
}