// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ShieldedPool} from "./ShieldedPool.sol";

/// @dev Minimal ERC20 interface for token operations.
interface IERC20Relayer {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MetaTxRelayer
 * @notice Executes deposits and withdrawals on behalf of users via EIP-712
 *         signed authorizations. Fees are paid in the pool's ERC20 token —
 *         users need zero AVAX.
 *
 * ── Deposit flow ────────────────────────────────────────────────────────────
 *   1. User approves this contract for (amount + fee) * amountScale of ERC20
 *   2. User signs EIP-712 RelayDeposit message
 *   3. Relay wallet calls relayDeposit()
 *   4. Contract pulls total from user, deposits net into pool, sends fee to relay
 *
 * ── Withdraw flow ───────────────────────────────────────────────────────────
 *   1. User generates ZK proof (no specific recipient binding in circuit)
 *   2. User signs EIP-712 RelayWithdraw message
 *   3. Relay wallet calls relayWithdraw()
 *   4. Contract calls pool.withdraw(recipient = address(this))
 *   5. Contract sends (amount - fee) to actual recipient, fee to relay
 *
 * ── Security ────────────────────────────────────────────────────────────────
 *   - Nonce per signer prevents replay
 *   - Deadline prevents stale signatures
 *   - EIP-712 domain binds to chain + contract address
 *   - Fee is explicit in the signed message — relay cannot inflate
 */
contract MetaTxRelayer {
    // ────────────────────────────────────────────────────────────────────────
    // EIP-712
    // ────────────────────────────────────────────────────────────────────────

    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 public constant RELAY_DEPOSIT_TYPEHASH =
        keccak256(
            "RelayDeposit(address depositor,address pool,uint256 amount,uint256 commitment,uint256 fee,uint256 deadline,uint256 nonce)"
        );

    bytes32 public constant RELAY_WITHDRAW_TYPEHASH =
        keccak256(
            "RelayWithdraw(address withdrawer,address pool,bytes32 proofHash,uint256 merkleRoot,uint256 nullifierHash,uint256 amount,uint256 changeCommitment,address recipient,uint256 fee,uint256 deadline,uint256 nonce)"
        );

    // ────────────────────────────────────────────────────────────────────────
    // Structs (avoid stack-too-deep)
    // ────────────────────────────────────────────────────────────────────────

    struct DepositRequest {
        address depositor;
        address pool;
        uint256 amount;
        uint256 commitment;
        uint256 fee;
        uint256 deadline;
        uint256 nonce;
        bytes signature;
    }

    struct WithdrawRequest {
        address withdrawer;
        address pool;
        bytes proof;
        uint256 merkleRoot;
        uint256 nullifierHash;
        uint256 amount;
        uint256 changeCommitment;
        address recipient;
        bytes encryptedMemo;
        uint256 fee;
        uint256 deadline;
        uint256 nonce;
        bytes signature;
    }

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Replay-protection nonce per signer address.
    mapping(address => uint256) public nonces;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event RelayedDeposit(
        address indexed depositor,
        address indexed pool,
        uint256 amount,
        uint256 fee,
        uint256 commitment
    );

    event RelayedWithdraw(
        address indexed withdrawer,
        address indexed pool,
        uint256 amount,
        uint256 fee,
        address recipient
    );

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("ShroudMetaTxRelayer"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Relay: Deposit
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Execute a deposit on behalf of `depositor` using a signed authorization.
     *
     * The depositor must have approved this contract for at least
     * `(amount + fee) * pool.amountScale()` of the pool's ERC20 token.
     */
    function relayDeposit(DepositRequest calldata req) external {
        require(block.timestamp <= req.deadline, "MetaTxRelayer: expired deadline");
        require(req.nonce == nonces[req.depositor], "MetaTxRelayer: invalid nonce");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                RELAY_DEPOSIT_TYPEHASH,
                req.depositor,
                req.pool,
                req.amount,
                req.commitment,
                req.fee,
                req.deadline,
                req.nonce
            )
        );
        _verifySignature(req.depositor, structHash, req.signature);

        // Increment nonce (replay protection)
        nonces[req.depositor] = req.nonce + 1;

        // Execute deposit + fee distribution
        _executeDeposit(req);
    }

    function _executeDeposit(DepositRequest calldata req) internal {
        ShieldedPool sp = ShieldedPool(req.pool);
        IERC20Relayer token = IERC20Relayer(address(sp.token()));
        uint256 scale = sp.amountScale();

        // Pull total (amount + fee) from depositor
        require(
            token.transferFrom(req.depositor, address(this), (req.amount + req.fee) * scale),
            "MetaTxRelayer: transferFrom failed"
        );

        // Approve pool for the net deposit amount
        token.approve(req.pool, req.amount * scale);

        // Execute deposit — pool pulls tokens from this contract
        sp.deposit(req.amount, req.commitment);

        // Send fee to relay wallet
        if (req.fee > 0) {
            require(
                token.transfer(msg.sender, req.fee * scale),
                "MetaTxRelayer: fee transfer failed"
            );
        }

        emit RelayedDeposit(req.depositor, req.pool, req.amount, req.fee, req.commitment);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Relay: Withdraw
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Execute a withdrawal on behalf of a user using a signed authorization.
     *
     * The contract calls pool.withdraw() with recipient = address(this),
     * then distributes: (amount - fee) to the actual recipient, fee to msg.sender.
     */
    function relayWithdraw(WithdrawRequest calldata req) external {
        require(block.timestamp <= req.deadline, "MetaTxRelayer: expired deadline");
        require(req.nonce == nonces[req.withdrawer], "MetaTxRelayer: invalid nonce");
        require(req.fee < req.amount, "MetaTxRelayer: fee >= amount");
        require(req.recipient != address(0), "MetaTxRelayer: zero recipient");

        // Verify EIP-712 signature — hash the proof to keep struct manageable
        bytes32 proofHash = keccak256(req.proof);
        bytes32 structHash = keccak256(
            abi.encode(
                RELAY_WITHDRAW_TYPEHASH,
                req.withdrawer,
                req.pool,
                proofHash,
                req.merkleRoot,
                req.nullifierHash,
                req.amount,
                req.changeCommitment,
                req.recipient,
                req.fee,
                req.deadline,
                req.nonce
            )
        );
        _verifySignature(req.withdrawer, structHash, req.signature);

        // Increment nonce
        nonces[req.withdrawer] = req.nonce + 1;

        // Execute withdraw + fee distribution
        _executeWithdraw(req);
    }

    function _executeWithdraw(WithdrawRequest calldata req) internal {
        ShieldedPool sp = ShieldedPool(req.pool);
        uint256 scale = sp.amountScale();

        // Withdraw to this contract (we distribute afterwards)
        sp.withdraw(
            req.proof,
            req.merkleRoot,
            req.nullifierHash,
            req.amount,
            req.changeCommitment,
            address(this),
            req.encryptedMemo
        );

        // Distribute: (amount - fee) to recipient, fee to relay wallet
        IERC20Relayer token = IERC20Relayer(address(sp.token()));

        require(
            token.transfer(req.recipient, (req.amount - req.fee) * scale),
            "MetaTxRelayer: recipient transfer failed"
        );

        if (req.fee > 0) {
            require(
                token.transfer(msg.sender, req.fee * scale),
                "MetaTxRelayer: fee transfer failed"
            );
        }

        emit RelayedWithdraw(req.withdrawer, req.pool, req.amount, req.fee, req.recipient);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Internal: EIP-712 signature verification
    // ────────────────────────────────────────────────────────────────────────

    function _verifySignature(
        address signer,
        bytes32 structHash,
        bytes calldata signature
    ) internal view {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        require(signature.length == 65, "MetaTxRelayer: invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        address recovered = ecrecover(digest, v, r, s);
        require(recovered != address(0), "MetaTxRelayer: invalid signature");
        require(recovered == signer, "MetaTxRelayer: signer mismatch");
    }
}
