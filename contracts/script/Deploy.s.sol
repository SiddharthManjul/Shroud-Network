// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ShieldedPool} from "../src/ShieldedPool.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";

/**
 * @title Deploy
 * @notice Foundry deployment script for the ZkToken ShieldedPool.
 *
 * Prerequisites before running:
 *   1. Deploy a Poseidon(2) contract (from poseidon-solidity or circomlibjs).
 *      Set POSEIDON_ADDRESS env var to its address.
 *   2. Set TOKEN_ADDRESS to the ERC20 token you want to wrap.
 *   3. Groth16VerifierTransfer and Groth16VerifierWithdraw are deployed
 *      by this script directly from the compiled artifacts.
 *
 * Usage:
 *   # Local anvil (for testing)
 *   forge script script/Deploy.s.sol --rpc-url anvil --broadcast
 *
 *   # Fuji testnet
 *   forge script script/Deploy.s.sol \
 *     --rpc-url fuji \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast --verify
 *
 *   # Avalanche mainnet
 *   forge script script/Deploy.s.sol \
 *     --rpc-url avalanche \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast --verify
 */
contract Deploy is Script {
    // ── Environment variables ────────────────────────────────────────────────
    // Required
    address private constant SENTINEL = address(0);

    function run() external {
        // Read deployment parameters from environment
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        address poseidonAddress = vm.envOr("POSEIDON_ADDRESS", SENTINEL);

        require(tokenAddress != address(0), "Deploy: TOKEN_ADDRESS not set");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== ZkToken ShieldedPool Deployment ===");
        console.log("Deployer      :", deployer);
        console.log("Token         :", tokenAddress);
        console.log("Poseidon      :", poseidonAddress);
        console.log("Chain ID      :", block.chainid);

        vm.startBroadcast(deployerKey);

        // ── 1. Deploy transfer verifier ──────────────────────────────────────
        // The verifier bytecode is embedded at compile time from the artifact.
        // We deploy it inline so there is one tx per verifier.
        address transferVerifier = _deployTransferVerifier();
        console.log("TransferVerifier:", transferVerifier);

        // ── 2. Deploy withdraw verifier ──────────────────────────────────────
        address withdrawVerifier = _deployWithdrawVerifier();
        console.log("WithdrawVerifier:", withdrawVerifier);

        // ── 3. Deploy ShieldedPool ──────────────────────────────────────────
        ShieldedPool pool = new ShieldedPool(
            tokenAddress,
            transferVerifier,
            withdrawVerifier,
            poseidonAddress
        );
        console.log("ShieldedPool    :", address(pool));
        console.log("Initial root    :", pool.getRoot());

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("");
        console.log("=== Deployment complete ===");
        console.log("Add to .env:");
        console.log("  SHIELDED_POOL_ADDRESS=", address(pool));
        console.log("  TRANSFER_VERIFIER_ADDRESS=", transferVerifier);
        console.log("  WITHDRAW_VERIFIER_ADDRESS=", withdrawVerifier);
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _deployTransferVerifier() internal returns (address addr) {
        // Import the auto-generated verifier artifact.
        // Foundry resolves this via the artifact + ABI in out/.
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
// Shim interfaces — Foundry needs an importable name to resolve creationCode.
// These are declared at file scope so no runtime overhead.
// ---------------------------------------------------------------------------

import {
    Groth16VerifierTransfer as contracts_src_Groth16VerifierTransfer
} from "../src/Groth16VerifierTransfer.sol";
import {
    Groth16VerifierWithdraw as contracts_src_Groth16VerifierWithdraw
} from "../src/Groth16VerifierWithdraw.sol";
