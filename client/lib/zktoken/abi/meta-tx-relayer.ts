export const META_TX_RELAYER_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "DOMAIN_SEPARATOR",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "RELAY_DEPOSIT_TYPEHASH",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "RELAY_WITHDRAW_TYPEHASH",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nonces",
    "inputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "relayDeposit",
    "inputs": [
      {
        "name": "req",
        "type": "tuple",
        "internalType": "struct MetaTxRelayer.DepositRequest",
        "components": [
          { "name": "depositor", "type": "address", "internalType": "address" },
          { "name": "pool", "type": "address", "internalType": "address" },
          { "name": "amount", "type": "uint256", "internalType": "uint256" },
          { "name": "commitment", "type": "uint256", "internalType": "uint256" },
          { "name": "fee", "type": "uint256", "internalType": "uint256" },
          { "name": "deadline", "type": "uint256", "internalType": "uint256" },
          { "name": "nonce", "type": "uint256", "internalType": "uint256" },
          { "name": "signature", "type": "bytes", "internalType": "bytes" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "relayWithdraw",
    "inputs": [
      {
        "name": "req",
        "type": "tuple",
        "internalType": "struct MetaTxRelayer.WithdrawRequest",
        "components": [
          { "name": "withdrawer", "type": "address", "internalType": "address" },
          { "name": "pool", "type": "address", "internalType": "address" },
          { "name": "proof", "type": "bytes", "internalType": "bytes" },
          { "name": "merkleRoot", "type": "uint256", "internalType": "uint256" },
          { "name": "nullifierHash", "type": "uint256", "internalType": "uint256" },
          { "name": "amount", "type": "uint256", "internalType": "uint256" },
          { "name": "changeCommitment", "type": "uint256", "internalType": "uint256" },
          { "name": "recipient", "type": "address", "internalType": "address" },
          { "name": "encryptedMemo", "type": "bytes", "internalType": "bytes" },
          { "name": "fee", "type": "uint256", "internalType": "uint256" },
          { "name": "deadline", "type": "uint256", "internalType": "uint256" },
          { "name": "nonce", "type": "uint256", "internalType": "uint256" },
          { "name": "signature", "type": "bytes", "internalType": "bytes" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "RelayedDeposit",
    "inputs": [
      { "name": "depositor", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "pool", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "fee", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "commitment", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RelayedWithdraw",
    "inputs": [
      { "name": "withdrawer", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "pool", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "fee", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "recipient", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  }
] as const;
