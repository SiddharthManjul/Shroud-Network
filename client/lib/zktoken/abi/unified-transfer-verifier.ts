export const UNIFIED_TRANSFER_VERIFIER_ABI = [
  {
    "type": "function",
    "name": "verifyProof",
    "inputs": [
      {
        "name": "_pA",
        "type": "uint256[2]",
        "internalType": "uint256[2]"
      },
      {
        "name": "_pB",
        "type": "uint256[2][2]",
        "internalType": "uint256[2][2]"
      },
      {
        "name": "_pC",
        "type": "uint256[2]",
        "internalType": "uint256[2]"
      },
      {
        "name": "_pubSignals",
        "type": "uint256[4]",
        "internalType": "uint256[4]"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  }
] as const;
