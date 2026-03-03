// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Paymaster} from "../src/Paymaster.sol";

/**
 * @title DeployPaymaster
 * @notice Foundry deployment script for the Paymaster gas-refund contract.
 *
 * Environment variables:
 *   DEPLOYER_PRIVATE_KEY    — required
 *   SHIELDED_POOL_ADDRESS   — required (from previous Deploy.s.sol run)
 *
 * Usage:
 *   forge script script/DeployPaymaster.s.sol --rpc-url fuji --broadcast
 *
 * After deployment:
 *   cast send <PAYMASTER_ADDRESS> --value 5ether --rpc-url fuji --private-key $DEPLOYER_PRIVATE_KEY
 */
contract DeployPaymaster is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address poolAddress = vm.envAddress("SHIELDED_POOL_ADDRESS");

        console.log("=== Paymaster Deployment ===");
        console.log("Deployer       :", deployer);
        console.log("ShieldedPool   :", poolAddress);
        console.log("Chain ID       :", block.chainid);

        vm.startBroadcast(deployerKey);

        // Default max gas price: 100 gwei
        Paymaster paymaster = new Paymaster(poolAddress, 100 gwei);

        console.log("Paymaster      :", address(paymaster));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment complete ===");
        console.log("Add to .env:");
        console.log("  PAYMASTER_ADDRESS=", address(paymaster));
        console.log("");
        console.log("Fund the paymaster:");
        console.log("  cast send", address(paymaster), "--value 5ether --rpc-url fuji");
    }
}
