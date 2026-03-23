// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {UnifiedShieldedPool} from "../src/UnifiedShieldedPool.sol";
import {UnifiedTransferVerifier} from "../src/UnifiedTransferVerifier.sol";
import {UnifiedWithdrawVerifier} from "../src/UnifiedWithdrawVerifier.sol";
import {TestToken} from "../src/TestToken.sol";

/**
 * @title DeployUnified
 * @notice Foundry deployment script for the Unified Shielded Pool (multi-token).
 *
 * Deploys:
 *   1. PoseidonT2 (Poseidon(1) for asset_id computation) from bytecode
 *   2. PoseidonT3 (Poseidon(2) for Merkle tree) from bytecode (or reuse existing)
 *   3. UnifiedTransferVerifier (Groth16, 4 public inputs)
 *   4. UnifiedWithdrawVerifier (Groth16, 5 public inputs)
 *   5. UnifiedShieldedPool (multi-token, depth 24, 16M leaves)
 *   6. Optionally: TestToken + whitelist it in the pool
 *
 * Environment variables (from .env):
 *   DEPLOYER_PRIVATE_KEY  -- required
 *   POSEIDON_T3_ADDRESS   -- Deployed Poseidon(2). If empty, deploys from bytecode.
 *   TOKENS                -- Comma-separated ERC20 addresses to whitelist (optional)
 *
 * Usage:
 *   # Local anvil
 *   forge script script/DeployUnified.s.sol --rpc-url anvil --broadcast
 *
 *   # Fuji testnet
 *   forge script script/DeployUnified.s.sol --rpc-url fuji --broadcast
 *
 *   # Avalanche mainnet
 *   forge script script/DeployUnified.s.sol --rpc-url avalanche --broadcast --verify
 */
contract DeployUnified is Script {
    address private constant SENTINEL = address(0);

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Optional: reuse existing Poseidon(2) deployment
        address poseidonT3Addr = vm.envOr("POSEIDON_T3_ADDRESS", SENTINEL);

        console.log("=== Unified Shielded Pool Deployment ===");
        console.log("Deployer       :", deployer);
        console.log("Chain ID       :", block.chainid);

        vm.startBroadcast(deployerKey);

        // -- 1. Poseidon(1) for asset_id = Poseidon(token_address) ---------
        address poseidonT2Addr = _deployFromBytecodeFile("src/PoseidonT2Bytecode.bin");
        console.log("PoseidonT2     :", poseidonT2Addr);

        // -- 2. Poseidon(2) for Merkle tree hashing ------------------------
        if (poseidonT3Addr == SENTINEL) {
            poseidonT3Addr = _deployFromBytecodeFile("src/PoseidonBytecode.bin");
            console.log("PoseidonT3  (new):", poseidonT3Addr);
        } else {
            console.log("PoseidonT3 (existing):", poseidonT3Addr);
        }

        // -- 3. UnifiedTransferVerifier ------------------------------------
        UnifiedTransferVerifier transferVerifier = new UnifiedTransferVerifier();
        console.log("TransferVerifier:", address(transferVerifier));

        // -- 4. UnifiedWithdrawVerifier ------------------------------------
        UnifiedWithdrawVerifier withdrawVerifier = new UnifiedWithdrawVerifier();
        console.log("WithdrawVerifier:", address(withdrawVerifier));

        // -- 5. UnifiedShieldedPool ----------------------------------------
        UnifiedShieldedPool pool = new UnifiedShieldedPool(
            address(transferVerifier),
            address(withdrawVerifier),
            poseidonT2Addr,
            poseidonT3Addr
        );
        console.log("UnifiedPool    :", address(pool));
        console.log("Initial root   :", pool.getRoot());

        // -- 6. Optional: Deploy TestToken and whitelist --------------------
        TestToken testToken = new TestToken();
        console.log("TestToken      :", address(testToken));
        testToken.faucet();

        pool.addToken(address(testToken));
        console.log("TestToken asset_id:", pool.getAssetId(address(testToken)));

        vm.stopBroadcast();

        // -- Summary -------------------------------------------------------
        console.log("");
        console.log("=== Deployment complete ===");
        console.log("Add to .env:");
        console.log("  POSEIDON_T2_ADDRESS=", poseidonT2Addr);
        console.log("  POSEIDON_T3_ADDRESS=", poseidonT3Addr);
        console.log("  UNIFIED_TRANSFER_VERIFIER=", address(transferVerifier));
        console.log("  UNIFIED_WITHDRAW_VERIFIER=", address(withdrawVerifier));
        console.log("  UNIFIED_SHIELDED_POOL=", address(pool));
        console.log("  TEST_TOKEN=", address(testToken));
    }

    // -----------------------------------------------------------------------
    // Internal: deploy contract from raw bytecode file
    // -----------------------------------------------------------------------
    function _deployFromBytecodeFile(string memory path) internal returns (address addr) {
        bytes memory bytecode = vm.readFileBinary(path);
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "DeployUnified: bytecode deploy failed");
    }
}
