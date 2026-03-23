// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IUnifiedTransferVerifier
/// @notice Interface for the UnifiedTransfer Groth16 verifier (4 public inputs)
/// @dev Public signals: [merkle_root, nullifier_hash, new_commitment_1, new_commitment_2]
interface IUnifiedTransferVerifier {
    function verifyProof(
        uint256[2]    calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2]    calldata _pC,
        uint256[4]    calldata _pubSignals
    ) external view returns (bool);
}

/// @title IUnifiedWithdrawVerifier
/// @notice Interface for the UnifiedWithdraw Groth16 verifier (5 public inputs)
/// @dev Public signals: [merkle_root, nullifier_hash, amount, change_commitment, asset_id]
interface IUnifiedWithdrawVerifier {
    function verifyProof(
        uint256[2]    calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2]    calldata _pC,
        uint256[5]    calldata _pubSignals
    ) external view returns (bool);
}
