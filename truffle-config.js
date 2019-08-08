require("ts-node/register");

const fs = require('fs');
const HDWalletProvider = require("truffle-hdwallet-provider");
const secret = JSON.parse(fs.readFileSync("secret.json").toString().trim());

module.exports = {
  migrations_directory: "./build/ts",

  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    development: {
        host: "127.0.0.1",     // Localhost (default: none)
        port: 7545,            // Standard Ethereum port (default: none)
        network_id: "*",       // Any network (default: none)
        accounts: 10,
        defaultEtherBalance: 500
    },
    testing: {
        host: "localhost",     // Localhost (default: none)
        port: 8545,            // Standard Ethereum port (default: none)
        network_id: "*",       // Any network (default: none)
        accounts: 10
    },
    ropsten: {
      provider: () => new HDWalletProvider(secret.robsten, `https://ropsten.infura.io/v3/42603e7e72bf4278ab055f3385efc2de`),
      network_id: 3,       // Ropsten's id
      gas: 5500000,        // Ropsten has a lower block limit than mainnet
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
    mainnet: {
      provider: () => new HDWalletProvider(secret.main, `https://mainnet.infura.io/v3/42603e7e72bf4278ab055f3385efc2de`),
      network_id: 1,       // Mainnet's id
      gas: 5500000,        // Same as test network
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200  // # of blocks before a deployment times out  (minimum/default: 50)
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.8",    // Fetch exact version from solc-bin (default: truffle's version)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: false,
         runs: 200
       },
       evmVersion: "petersburg"
      }
    }
  }
};