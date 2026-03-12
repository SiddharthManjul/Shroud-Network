// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MetaTxRelayer} from "../src/MetaTxRelayer.sol";

/**
 * @title DeployMetaTxRelayer
 * @notice Deploys the MetaTxRelayer contract (stateless except nonces).
 *
 * Usage:
 *   forge script script/DeployMetaTxRelayer.s.sol --rpc-url fuji --broadcast
 */
contract DeployMetaTxRelayer is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== MetaTxRelayer Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        MetaTxRelayer relayer = new MetaTxRelayer();

        vm.stopBroadcast();

        console.log("");
        console.log("MetaTxRelayer deployed:", address(relayer));
        console.log("DOMAIN_SEPARATOR:", vm.toString(relayer.DOMAIN_SEPARATOR()));
        console.log("");
        console.log("Add to client .env.local:");
        console.log("  NEXT_PUBLIC_META_TX_RELAYER_ADDRESS=", address(relayer));
    }
}
