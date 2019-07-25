const Migrations = artifacts.require("Migrations");

module.exports = async function(deployer: Truffle.Deployer): Promise<void> {
  await deployer.deploy(Migrations);
} as Truffle.Migration;

export {};