// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ShieldedPool} from "../src/ShieldedPool.sol";
import {TestToken} from "../src/TestToken.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";

/**
 * @title Deploy
 * @notice Foundry deployment script for the ZkToken ShieldedPool.
 *
 * Environment variables (from .env):
 *   DEPLOYER_PRIVATE_KEY  — required
 *   TOKEN_ADDRESS          — ERC20 to wrap. If empty/zero, deploys TestToken.
 *   POSEIDON_ADDRESS       — Deployed Poseidon(2). If empty/zero, deploys from bytecode.
 *   SNOWTRACE_API_KEY      — for --verify on Fuji/mainnet
 *
 * Usage:
 *   # Local anvil
 *   forge script script/Deploy.s.sol --rpc-url anvil --broadcast
 *
 *   # Fuji testnet
 *   forge script script/Deploy.s.sol --rpc-url fuji --broadcast
 *
 *   # Avalanche mainnet
 *   forge script script/Deploy.s.sol --rpc-url avalanche --broadcast --verify
 */
contract Deploy is Script {
    address private constant SENTINEL = address(0);

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Read optional addresses — default to zero (auto-deploy)
        address tokenAddress = vm.envOr("TOKEN_ADDRESS", SENTINEL);
        address poseidonAddress = vm.envOr("POSEIDON_ADDRESS", SENTINEL);

        console.log("=== ZkToken ShieldedPool Deployment ===");
        console.log("Deployer      :", deployer);
        console.log("Chain ID      :", block.chainid);

        vm.startBroadcast(deployerKey);

        // ── 1. Token ────────────────────────────────────────────────────────
        if (tokenAddress == SENTINEL) {
            TestToken testToken = new TestToken();
            tokenAddress = address(testToken);
            console.log("TestToken deployed:", tokenAddress);

            // Mint tokens to deployer for testing
            testToken.faucet();
            console.log("Minted 1000 SRD to deployer");
        }
        console.log("Token         :", tokenAddress);

        // ── 2. Poseidon ─────────────────────────────────────────────────────
        if (poseidonAddress == SENTINEL) {
            poseidonAddress = _deployPoseidon();
            console.log("Poseidon deployed:", poseidonAddress);
        }
        console.log("Poseidon      :", poseidonAddress);

        // ── 3. Transfer verifier ────────────────────────────────────────────
        address transferVerifier = _deployTransferVerifier();
        console.log("TransferVerifier:", transferVerifier);

        // ── 4. Withdraw verifier ────────────────────────────────────────────
        address withdrawVerifier = _deployWithdrawVerifier();
        console.log("WithdrawVerifier:", withdrawVerifier);

        // ── 5. ShieldedPool ─────────────────────────────────────────────────
        ShieldedPool pool = new ShieldedPool(
            tokenAddress,
            transferVerifier,
            withdrawVerifier,
            poseidonAddress
        );
        console.log("ShieldedPool    :", address(pool));
        console.log("Initial root    :", pool.getRoot());

        vm.stopBroadcast();

        // ── Summary ─────────────────────────────────────────────────────────
        console.log("");
        console.log("=== Deployment complete ===");
        console.log("Add to .env:");
        console.log("  TOKEN_ADDRESS=", tokenAddress);
        console.log("  POSEIDON_ADDRESS=", poseidonAddress);
        console.log("  SHIELDED_POOL_ADDRESS=", address(pool));
        console.log("  TRANSFER_VERIFIER_ADDRESS=", transferVerifier);
        console.log("  WITHDRAW_VERIFIER_ADDRESS=", withdrawVerifier);
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    function _deployPoseidon() internal returns (address addr) {
        // Read pre-generated Poseidon(2) bytecode from circomlibjs.
        // Generate with: node scripts/generate_poseidon.js
        bytes memory bytecode = vm.readFileBinary("src/PoseidonBytecode.bin");
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "Deploy: Poseidon deploy failed");
    }

    function _deployTransferVerifier() internal returns (address addr) {
        bytes memory bytecode = type(contracts_src_Groth16VerifierTransfer)
            .creationCode;
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "Deploy: TransferVerifier deploy failed");
    }

    function _deployWithdrawVerifier() internal returns (address addr) {
        bytes memory bytecode = type(contracts_src_Groth16VerifierWithdraw)
            .creationCode;
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "Deploy: WithdrawVerifier deploy failed");
    }
}

// ---------------------------------------------------------------------------
// Shim imports — Foundry needs importable names to resolve creationCode.
// ---------------------------------------------------------------------------

import {
    Groth16VerifierTransfer as contracts_src_Groth16VerifierTransfer
} from "../src/Groth16VerifierTransfer.sol";
import {
    Groth16VerifierWithdraw as contracts_src_Groth16VerifierWithdraw
} from "../src/Groth16VerifierWithdraw.sol";
