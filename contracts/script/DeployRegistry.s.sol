// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolRegistry} from "../src/PoolRegistry.sol";
import {TestToken} from "../src/TestToken.sol";

/**
 * @title DeployRegistry
 * @notice Deploys the shared infrastructure (Poseidon, verifiers) and the
 *         PoolRegistry factory, then creates an initial pool for a test token.
 *
 * Environment variables:
 *   DEPLOYER_PRIVATE_KEY  — required
 *   TOKEN_ADDRESS          — ERC20 to create first pool for. If empty, deploys TestToken.
 *   POSEIDON_ADDRESS       — Deployed Poseidon(2). If empty, deploys from bytecode.
 *   MAX_GAS_PRICE          — Paymaster max gas price in wei (default: 100 gwei).
 *   PAYMASTER_FUND_AMOUNT  — AVAX to fund paymaster (wei). Default: 0.5 ether.
 *
 * Usage:
 *   forge script script/DeployRegistry.s.sol --rpc-url fuji --broadcast
 */
contract DeployRegistry is Script {
    address private constant SENTINEL = address(0);

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address tokenAddress = vm.envOr("TOKEN_ADDRESS", SENTINEL);
        address poseidonAddress = vm.envOr("POSEIDON_ADDRESS", SENTINEL);
        address transferVerifierAddr = vm.envOr("TRANSFER_VERIFIER_ADDRESS", SENTINEL);
        address withdrawVerifierAddr = vm.envOr("WITHDRAW_VERIFIER_ADDRESS", SENTINEL);
        uint256 maxGasPrice = vm.envOr("MAX_GAS_PRICE", uint256(100 gwei));
        uint256 fundAmount = vm.envOr("PAYMASTER_FUND_AMOUNT", uint256(0.5 ether));

        console.log("=== PoolRegistry Deployment ===");
        console.log("Deployer      :", deployer);
        console.log("Chain ID      :", block.chainid);

        vm.startBroadcast(deployerKey);

        // ── 1. Token ──────────────────────────────────────────────────────
        if (tokenAddress == SENTINEL) {
            TestToken testToken = new TestToken();
            tokenAddress = address(testToken);
            testToken.faucet();
            console.log("TestToken deployed:", tokenAddress);
        }
        console.log("Token         :", tokenAddress);

        // ── 2. Poseidon ───────────────────────────────────────────────────
        if (poseidonAddress == SENTINEL) {
            poseidonAddress = _deployPoseidon();
            console.log("Poseidon deployed:", poseidonAddress);
        }
        console.log("Poseidon      :", poseidonAddress);

        // ── 3. Verifiers ──────────────────────────────────────────────────
        address transferVerifier = transferVerifierAddr;
        if (transferVerifier == SENTINEL) {
            transferVerifier = _deployTransferVerifier();
            console.log("TransferVerifier deployed:", transferVerifier);
        }
        console.log("TransferVerifier:", transferVerifier);

        address withdrawVerifier = withdrawVerifierAddr;
        if (withdrawVerifier == SENTINEL) {
            withdrawVerifier = _deployWithdrawVerifier();
            console.log("WithdrawVerifier deployed:", withdrawVerifier);
        }
        console.log("WithdrawVerifier:", withdrawVerifier);

        // ── 4. PoolRegistry ───────────────────────────────────────────────
        PoolRegistry registry = new PoolRegistry(
            transferVerifier,
            withdrawVerifier,
            poseidonAddress
        );
        console.log("PoolRegistry    :", address(registry));

        // ── 5. Create initial pool ────────────────────────────────────────
        (address pool, address paymaster) = registry.createPool(
            tokenAddress,
            maxGasPrice
        );
        console.log("ShieldedPool    :", pool);
        console.log("Paymaster       :", paymaster);

        // ── 6. Fund paymaster ─────────────────────────────────────────────
        if (fundAmount > 0 && deployer.balance >= fundAmount) {
            (bool ok, ) = paymaster.call{value: fundAmount}("");
            require(ok, "DeployRegistry: paymaster funding failed");
            console.log("Paymaster funded:", fundAmount);
        }

        vm.stopBroadcast();

        // ── Summary ───────────────────────────────────────────────────────
        console.log("");
        console.log("=== Deployment complete ===");
        console.log("Add to client .env.local:");
        console.log("  NEXT_PUBLIC_POOL_REGISTRY_ADDRESS=", address(registry));
        console.log("  NEXT_PUBLIC_TOKEN_ADDRESS=", tokenAddress);
        console.log("  NEXT_PUBLIC_SHIELDED_POOL_ADDRESS=", pool);
        console.log("  NEXT_PUBLIC_PAYMASTER_ADDRESS=", paymaster);
    }

    // ── Internal helpers ──────────────────────────────────────────────────

    function _deployPoseidon() internal returns (address addr) {
        bytes memory bytecode = vm.readFileBinary("src/PoseidonBytecode.bin");
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "DeployRegistry: Poseidon deploy failed");
    }

    function _deployTransferVerifier() internal returns (address addr) {
        bytes memory bytecode = type(contracts_src_Groth16VerifierTransfer)
            .creationCode;
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "DeployRegistry: TransferVerifier deploy failed");
    }

    function _deployWithdrawVerifier() internal returns (address addr) {
        bytes memory bytecode = type(contracts_src_Groth16VerifierWithdraw)
            .creationCode;
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "DeployRegistry: WithdrawVerifier deploy failed");
    }
}

// Shim imports for creationCode resolution
import {
    Groth16VerifierTransfer as contracts_src_Groth16VerifierTransfer
} from "../src/Groth16VerifierTransfer.sol";
import {
    Groth16VerifierWithdraw as contracts_src_Groth16VerifierWithdraw
} from "../src/Groth16VerifierWithdraw.sol";
