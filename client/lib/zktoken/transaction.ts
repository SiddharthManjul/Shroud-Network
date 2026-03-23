/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * transaction.ts — TransactionBuilder
 *
 * Orchestrates the full deposit → transfer → withdraw flow.
 *
 * Each function:
 *   1. Validates inputs
 *   2. Prepares cryptographic material (notes, Merkle paths, proofs)
 *   3. Encodes + submits the on-chain transaction
 *   4. Returns the transaction response and any new notes for local storage
 *
 * Callers are responsible for updating their NoteStore after a transaction
 * is confirmed (mark input note as spent, save output notes).
 */

import { Interface, getAddress } from "ethers";
import {
  type DepositParams,
  type TransferParams,
  type WithdrawParams,
  type RelayTransferParams,
  type RelayWithdrawParams,
  type RelayDepositParams,
  type RelayMetaWithdrawParams,
  type RelayResponse,
  type EthersTransactionResponse,
  type EthersTransactionRequest,
  type EthersSigner,
  type Note,
} from "./types";
import { SHIELDED_POOL_ABI } from "./abi/shielded-pool";
import { TEST_TOKEN_ABI } from "./abi/test-token";
import { createNote, finaliseNote } from "./note";
import { MerkleTreeSync } from "./merkle";
import {
  generateTransferProof,
  generateWithdrawProof,
} from "./prover";
import { encryptMemo, decryptMemo, type MemoEvent } from "./encryption";
import { noteFromMemoData } from "./note";
import { bytesToHex, hexToBytes } from "./utils";

// ─── Gas fee helper ──────────────────────────────────────────────────────────

/**
 * Avalanche C-Chain requires a minimum gas price. BrowserProvider sometimes
 * fails to auto-populate fee fields, resulting in maxFeePerGas: 0 which the
 * node rejects. This helper fetches fee data and merges it into the tx.
 */
async function sendWithGas(
  signer: EthersSigner,
  tx: EthersTransactionRequest
): Promise<EthersTransactionResponse> {
  // Try to get fee data from the provider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = signer.provider as any;
  if (provider?.getFeeData) {
    try {
      const feeData = await provider.getFeeData();
      if (feeData.maxFeePerGas) {
        tx = {
          ...tx,
          maxFeePerGas: BigInt(feeData.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(feeData.maxPriorityFeePerGas ?? 0n),
        };
      } else if (feeData.gasPrice) {
        tx = { ...tx, gasPrice: BigInt(feeData.gasPrice) };
      }
    } catch {
      // Fall through to hardcoded minimum
    }
  }

  // Ensure at least the Avalanche minimum (25 nAVAX base fee)
  if (!tx.maxFeePerGas && !tx.gasPrice) {
    tx = { ...tx, maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n };
  }

  return signer.sendTransaction(tx);
}

// ─── Deposit ──────────────────────────────────────────────────────────────────

/**
 * Deposit ERC20 tokens into the shielded pool.
 *
 * `amount` is in whole token units (e.g. 500 = 500 SRD). The note stores
 * this value directly (must fit in uint64 for circuit range proofs).
 * The ERC20 approve/transferFrom and contract deposit use the scaled
 * amount (amount * 10^18) since the token has 18 decimals.
 *
 * Steps:
 *   1. Create a new Note (amount in whole tokens)
 *   2. Approve the pool contract to spend the scaled ERC20 amount
 *   3. Call ShieldedPool.deposit(scaledAmount, noteCommitment)
 *   4. Return the pending note (leafIndex = -1 until tx confirmed)
 *
 * The caller should listen for the Deposit event to obtain the leafIndex
 * and then call finaliseNote() + NoteStore.save().
 */
export async function deposit(
  params: DepositParams
): Promise<{ tx: EthersTransactionResponse; pendingNote: Note }> {
  const { signer, poolAddress, tokenAddress, amount, ownerPublicKey } = params;

  if (amount <= 0n) throw new Error("deposit: amount must be > 0");
  if (!signer.provider) throw new Error("deposit: signer has no provider");

  // Note stores whole token amount (fits in uint64 for circuit range proofs)
  const pendingNote = await createNote(amount, ownerPublicKey, tokenAddress);

  // The ShieldedPool contract scales by AMOUNT_SCALE (1e18) internally.
  // Approve the scaled amount so the contract's transferFrom succeeds.
  const scaledAmount = amount * 10n ** 18n;

  // 2. Approve token transfer (must approve the scaled amount)
  const erc20Iface = new Interface(TEST_TOKEN_ABI);
  const approveData = erc20Iface.encodeFunctionData("approve", [
    poolAddress,
    scaledAmount,
  ]);
  const approveTx = await sendWithGas(signer, {
    to: tokenAddress,
    data: approveData,
  });
  await approveTx.wait();

  // 3. Deposit into pool — pass unscaled amount (contract scales internally)
  const poolIface = new Interface(SHIELDED_POOL_ABI);
  const depositData = poolIface.encodeFunctionData("deposit", [
    amount,
    pendingNote.noteCommitment,
  ]);
  const tx = await sendWithGas(signer, {
    to: poolAddress,
    data: depositData,
  });

  return { tx, pendingNote };
}

/**
 * Convenience: wait for a deposit to be confirmed and finalise the note
 * by reading the leafIndex from the Deposit event.
 */
export async function waitForDeposit(
  tx: EthersTransactionResponse,
  pendingNote: Note,
  provider: { getLogs: (f: { address?: string; topics?: (string | null | string[])[]; fromBlock?: number | string; toBlock?: number | string }) => Promise<{ topics: string[]; data: string; blockNumber: number; transactionHash: string }[]> },
  poolAddress: string
): Promise<Note> {
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("waitForDeposit: transaction reverted");

  const poolIface = new Interface(SHIELDED_POOL_ABI);
  const depositTopic = poolIface.getEvent("Deposit")!.topicHash;

  // Strategy 1: parse logs from the receipt directly (ethers v6 provider returns them).
  // This is more reliable than getLogs filtering on single-block ranges on public RPCs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receiptLogs: { topics: string[]; data: string }[] = (receipt as any).logs ?? [];
  let parsedFromReceipt = null;
  for (const log of receiptLogs) {
    if (
      log.topics[0]?.toLowerCase() === depositTopic.toLowerCase() &&
      log.topics[1] !== undefined
    ) {
      try {
        parsedFromReceipt = poolIface.parseLog(log);
        if (parsedFromReceipt) break;
      } catch {
        // Not a Deposit log, continue
      }
    }
  }

  if (parsedFromReceipt) {
    const leafIndex = Number(parsedFromReceipt.args["leafIndex"] as bigint);
    return finaliseNote({ ...pendingNote, createdAtBlock: receipt.blockNumber }, leafIndex);
  }

  // Strategy 2: fallback getLogs query (wider block range for safety)
  const logs = await provider.getLogs({
    address: poolAddress,
    topics: [depositTopic],
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });

  // Find the log whose commitment topic matches our note
  const noteCommitmentHex =
    "0x" + pendingNote.noteCommitment.toString(16).padStart(64, "0");
  const matchingLog = logs.find(
    (l) => l.topics[1]?.toLowerCase() === noteCommitmentHex.toLowerCase()
  );

  if (!matchingLog) {
    throw new Error(
      `waitForDeposit: Deposit event not found for commitment ${noteCommitmentHex}. ` +
        `TX ${tx.hash} was confirmed but no matching log was found.`
    );
  }

  const parsed = poolIface.parseLog(matchingLog);
  if (!parsed) throw new Error("waitForDeposit: failed to parse Deposit event");

  const leafIndex = Number(parsed.args["leafIndex"] as bigint);
  return finaliseNote({ ...pendingNote, createdAtBlock: receipt.blockNumber }, leafIndex);
}


// ─── Relayed Deposit (MetaTxRelayer — gasless via EIP-712) ────────────────────

/**
 * Deposit ERC20 tokens into the shielded pool via the MetaTxRelayer.
 *
 * The user signs an EIP-712 message authorizing the deposit + fee. The relay
 * wallet submits the transaction and receives the fee in ERC20 tokens.
 * The user needs zero AVAX (except for the one-time token approval).
 *
 * Steps:
 *   1. Create a new note
 *   2. Check token allowance for MetaTxRelayer, prompt approval if needed
 *   3. Get nonce from MetaTxRelayer contract
 *   4. Build EIP-712 typed data and request wallet signature
 *   5. POST to relay API with type "deposit"
 *   6. Wait for confirmation and finalize note
 */
export async function relayDeposit(
  params: RelayDepositParams
): Promise<{ relay: RelayResponse; pendingNote: Note }> {
  const {
    signer,
    provider,
    poolAddress,
    tokenAddress,
    amount,
    ownerPublicKey,
    fee,
    metaTxRelayerAddress,
    relayUrl = "/api/relay",
  } = params;

  if (amount <= 0n) throw new Error("relayDeposit: amount must be > 0");
  if (!signer.provider) throw new Error("relayDeposit: signer has no provider");

  const pendingNote = await createNote(amount, ownerPublicKey, tokenAddress);

  const signerAddress = await signer.getAddress();

  // Check + set token approval for MetaTxRelayer (one-time, costs gas)
  const erc20Iface = new Interface(TEST_TOKEN_ABI);

  // Read amountScale from the pool to know the actual scaled total
  const { Contract } = await import("ethers");
  const { SHIELDED_POOL_ABI } = await import("./abi/shielded-pool");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poolContract = new Contract(poolAddress, SHIELDED_POOL_ABI, provider as any);
  const amountScale: bigint = await poolContract.amountScale();
  const scaledTotal = (amount + fee) * amountScale;

  // Read current allowance
  const allowanceData = erc20Iface.encodeFunctionData("allowance", [
    signerAddress,
    metaTxRelayerAddress,
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allowanceResult = await (provider as any).call({
    to: tokenAddress,
    data: allowanceData,
  });
  const currentAllowance = BigInt(allowanceResult);

  if (currentAllowance < scaledTotal) {
    // Check if user has AVAX to pay gas for the one-time approval
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avaxBalance = await (provider as any).getBalance(signerAddress);
    if (BigInt(avaxBalance) === 0n) {
      throw new Error(
        "You need a small amount of AVAX for a one-time token approval. " +
        "After approval, all future deposits will be gasless. " +
        "Send ~0.01 AVAX to your wallet and try again."
      );
    }

    // Approve max uint256 (one-time gas cost)
    const approveData = erc20Iface.encodeFunctionData("approve", [
      metaTxRelayerAddress,
      BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
    ]);
    try {
      const approveTx = await sendWithGas(signer, {
        to: tokenAddress,
        data: approveData,
      });
      await approveTx.wait();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Token approval failed: ${msg}. ` +
        "Ensure you have AVAX for gas and that your wallet is connected to Avalanche Fuji."
      );
    }
  }

  // Get chain ID (stable, fetch once)
  const network = await provider.getNetwork();
  const chainId = network.chainId;

  const { META_TX_RELAYER_ABI } = await import("./abi/meta-tx-relayer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relayerContract = new Contract(metaTxRelayerAddress, META_TX_RELAYER_ABI, provider as any);

  const domain = {
    name: "ShroudMetaTxRelayer",
    version: "1",
    chainId: Number(chainId),
    verifyingContract: metaTxRelayerAddress,
  };

  const types = {
    RelayDeposit: [
      { name: "depositor", type: "address" },
      { name: "pool", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "commitment", type: "uint256" },
      { name: "fee", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  };

  // Sign-and-submit helper (supports one retry on stale nonce)
  const signAndSubmit = async (): Promise<RelayResponse> => {
    // Read nonce fresh each attempt (bypass any provider cache)
    const nonce: bigint = await relayerContract.nonces(signerAddress);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const value = {
      depositor: signerAddress,
      pool: poolAddress,
      amount: amount,
      commitment: pendingNote.noteCommitment,
      fee: fee,
      deadline: deadline,
      nonce: nonce,
    };

    // Request EIP-712 signature from wallet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signature = await (signer as any).signTypedData(domain, types, value);

    const body = {
      type: "deposit" as const,
      depositor: signerAddress,
      pool: poolAddress,
      amount: amount.toString(),
      commitment: pendingNote.noteCommitment.toString(),
      fee: fee.toString(),
      deadline: deadline.toString(),
      nonce: nonce.toString(),
      signature,
      metaTxRelayerAddress,
    };

    const res = await fetch(relayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`relayDeposit: relay returned ${res.status}: ${errText}`);
    }

    return res.json();
  };

  // First attempt — if nonce is stale, retry once with fresh nonce
  let relay: RelayResponse;
  try {
    relay = await signAndSubmit();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("nonce") || msg.includes("replayed")) {
      // Nonce was stale (previous tx may have landed). Retry with fresh nonce.
      relay = await signAndSubmit();
    } else {
      throw err;
    }
  }

  return { relay, pendingNote };
}

/**
 * Finalize a relayed deposit by finding the leaf index from chain events.
 */
export async function waitForRelayDeposit(
  relay: RelayResponse,
  pendingNote: Note,
  provider: { getLogs: (f: { address?: string; topics?: (string | null | string[])[]; fromBlock?: number | string; toBlock?: number | string }) => Promise<{ topics: string[]; data: string; blockNumber: number; transactionHash: string }[]> },
  poolAddress: string
): Promise<Note> {
  const poolIface = new Interface(SHIELDED_POOL_ABI);
  const depositTopic = poolIface.getEvent("Deposit")!.topicHash;

  const noteCommitmentHex =
    "0x" + pendingNote.noteCommitment.toString(16).padStart(64, "0");

  const logs = await provider.getLogs({
    address: poolAddress,
    topics: [depositTopic, noteCommitmentHex],
    fromBlock: relay.blockNumber,
    toBlock: relay.blockNumber,
  });

  if (logs.length === 0) {
    throw new Error(
      `waitForRelayDeposit: Deposit event not found for commitment. TX may be in a different block.`
    );
  }

  const parsed = poolIface.parseLog(logs[0]);
  if (!parsed) throw new Error("waitForRelayDeposit: failed to parse Deposit event");

  const leafIndex = Number(parsed.args["leafIndex"] as bigint);
  return finaliseNote({ ...pendingNote, createdAtBlock: relay.blockNumber }, leafIndex);
}

// ─── Relayed Withdraw (MetaTxRelayer — fee in ERC20, gasless) ────────────────

/**
 * Withdraw tokens from the shielded pool via the MetaTxRelayer.
 *
 * The user generates the ZK proof, signs an EIP-712 message authorizing the
 * withdrawal + fee, and the relay submits it. The fee is deducted from the
 * withdrawn amount in ERC20 tokens — zero AVAX needed.
 */
export async function relayMetaWithdraw(
  params: RelayMetaWithdrawParams
): Promise<{
  relay: RelayResponse;
  changeNote: Note | undefined;
}> {
  const {
    signer,
    provider,
    poolAddress,
    inputNote,
    withdrawAmount,
    recipient,
    senderPublicKey,
    senderPrivateKey,
    wasmPath,
    zkeyPath,
    fee,
    metaTxRelayerAddress,
    relayUrl = "/api/relay",
  } = params;

  if (inputNote.spent) throw new Error("relayMetaWithdraw: inputNote is already spent");
  if (inputNote.leafIndex < 0) throw new Error("relayMetaWithdraw: inputNote not yet finalised");
  if (withdrawAmount <= 0n || withdrawAmount > inputNote.amount) {
    throw new Error(`relayMetaWithdraw: invalid withdrawAmount ${withdrawAmount}`);
  }
  if (fee >= withdrawAmount) {
    throw new Error(`relayMetaWithdraw: fee (${fee}) must be less than withdrawAmount (${withdrawAmount})`);
  }

  const { getAddress } = await import("ethers");
  getAddress(recipient);

  const signerAddress = await signer.getAddress();

  // 1. Sync Merkle tree
  const tree = new MerkleTreeSync();
  await tree.syncFromChain(provider, poolAddress);

  const treeLeaves = tree.getLeaves();
  if (inputNote.leafIndex >= treeLeaves.length) {
    throw new Error(
      `relayMetaWithdraw: note leafIndex ${inputNote.leafIndex} is beyond tree size ${treeLeaves.length}.`
    );
  }
  const onChainLeaf = treeLeaves[inputNote.leafIndex];
  if (onChainLeaf !== inputNote.noteCommitment) {
    throw new Error(
      `relayMetaWithdraw: Merkle tree leaf mismatch at index ${inputNote.leafIndex}.`
    );
  }

  const merklePath = await tree.getMerklePath(inputNote.leafIndex);

  // 2. Generate proof
  const proofResult = await generateWithdrawProof({
    inputNote,
    withdrawAmount,
    recipient, // Note: proof doesn't bind recipient in public signals
    senderPublicKey,
    senderPrivateKey,
    merklePath,
    wasmPath,
    zkeyPath,
  });

  const [merkleRoot, nullifierHash, amount, changeCommitment] = proofResult.publicSignals;

  // 3. Encrypt change memo (if partial)
  let encryptedMemoHex = "0x";
  if (proofResult.changeNote) {
    const changeMemoData = {
      amount: proofResult.changeNote.amount,
      blinding: proofResult.changeNote.blinding,
      secret: proofResult.changeNote.secret,
      nullifierPreimage: proofResult.changeNote.nullifierPreimage,
    };
    const encryptedMemo = await encryptMemo(changeMemoData, senderPublicKey);
    encryptedMemoHex = "0x" + bytesToHex(encryptedMemo);
  }

  // 4. Get nonce from MetaTxRelayer
  const { Contract } = await import("ethers");
  const { META_TX_RELAYER_ABI } = await import("./abi/meta-tx-relayer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relayerContract = new Contract(metaTxRelayerAddress, META_TX_RELAYER_ABI, provider as any);
  const nonce: bigint = await relayerContract.nonces(signerAddress);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const network = await provider.getNetwork();
  const chainId = network.chainId;

  // 5. Build EIP-712 typed data and sign
  const proofHex = "0x" + bytesToHex(proofResult.proofBytes);

  // The contract hashes the proof, so we need to compute keccak256(proof) for the typed data
  const { keccak256: ethersKeccak256 } = await import("ethers");
  const proofHash = ethersKeccak256(proofHex);

  const domain = {
    name: "ShroudMetaTxRelayer",
    version: "1",
    chainId: Number(chainId),
    verifyingContract: metaTxRelayerAddress,
  };

  const types = {
    RelayWithdraw: [
      { name: "withdrawer", type: "address" },
      { name: "pool", type: "address" },
      { name: "proofHash", type: "bytes32" },
      { name: "merkleRoot", type: "uint256" },
      { name: "nullifierHash", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "changeCommitment", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "fee", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  };

  const value = {
    withdrawer: signerAddress,
    pool: poolAddress,
    proofHash: proofHash,
    merkleRoot: merkleRoot,
    nullifierHash: nullifierHash,
    amount: amount,
    changeCommitment: changeCommitment,
    recipient: recipient,
    fee: fee,
    deadline: deadline,
    nonce: nonce,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signature = await (signer as any).signTypedData(domain, types, value);

  // 6. POST to relay API
  const body = {
    type: "meta-withdraw" as const,
    withdrawer: signerAddress,
    pool: poolAddress,
    proof: proofHex,
    merkleRoot: merkleRoot.toString(),
    nullifierHash: nullifierHash.toString(),
    amount: amount.toString(),
    changeCommitment: changeCommitment.toString(),
    recipient,
    encryptedMemo: encryptedMemoHex,
    fee: fee.toString(),
    deadline: deadline.toString(),
    nonce: nonce.toString(),
    signature,
    metaTxRelayerAddress,
  };

  const res = await fetch(relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`relayMetaWithdraw: relay returned ${res.status}: ${errText}`);
  }

  const relay: RelayResponse = await res.json();

  // 7. Finalize change note
  let finalizedChange = proofResult.changeNote;
  if (finalizedChange) {
    const postTree = new MerkleTreeSync();
    await postTree.syncFromChain(provider, poolAddress);
    const changeIdx = postTree.findLeafIndex(finalizedChange.noteCommitment);
    if (changeIdx >= 0) {
      finalizedChange = await finaliseNote(
        { ...finalizedChange, createdAtBlock: relay.blockNumber },
        changeIdx
      );
    }
  }

  return { relay, changeNote: finalizedChange };
}

// ─── Private Transfer ─────────────────────────────────────────────────────────

/**
 * Execute a private transfer inside the pool.
 *
 * Steps:
 *   1. Sync Merkle tree to get a fresh root + Merkle path
 *   2. Generate Groth16 proof (transfer circuit)
 *   3. Encrypt memos for recipient and sender (change note)
 *   4. Submit ShieldedPool.transfer(...)
 *   5. Return tx + output notes
 */
export async function transfer(
  params: TransferParams
): Promise<{
  tx: EthersTransactionResponse;
  recipientNote: Note;
  changeNote: Note;
}> {
  const {
    signer,
    provider,
    poolAddress,
    inputNote,
    transferAmount,
    recipientPublicKey,
    senderPublicKey,
    senderPrivateKey,
    wasmPath,
    zkeyPath,
  } = params;

  if (!signer.provider) throw new Error("transfer: signer has no provider");
  if (inputNote.spent) throw new Error("transfer: inputNote is already spent");
  if (inputNote.leafIndex < 0) throw new Error("transfer: inputNote not yet finalised (no leafIndex)");
  if (transferAmount <= 0n || transferAmount > inputNote.amount) {
    throw new Error(`transfer: invalid transferAmount ${transferAmount}`);
  }

  // 1. Sync Merkle tree
  const tree = new MerkleTreeSync();
  await tree.syncFromChain(provider, poolAddress);
  const merklePath = await tree.getMerklePath(inputNote.leafIndex);

  // 2. Generate proof
  const proofResult = await generateTransferProof({
    inputNote,
    transferAmount,
    recipientPublicKey,
    senderPublicKey,
    senderPrivateKey,
    merklePath,
    wasmPath,
    zkeyPath,
  });

  // 3. Encrypt memos
  const recipientMemoData = {
    amount: proofResult.recipientNote.amount,
    blinding: proofResult.recipientNote.blinding,
    secret: proofResult.recipientNote.secret,
    nullifierPreimage: proofResult.recipientNote.nullifierPreimage,
  };
  const senderMemoData = {
    amount: proofResult.changeNote.amount,
    blinding: proofResult.changeNote.blinding,
    secret: proofResult.changeNote.secret,
    nullifierPreimage: proofResult.changeNote.nullifierPreimage,
  };

  const encryptedMemo1 = await encryptMemo(recipientMemoData, recipientPublicKey);
  const encryptedMemo2 = await encryptMemo(senderMemoData, senderPublicKey);

  // 4. Submit transaction
  const [merkleRoot, nullifierHash, newCommitment1, newCommitment2] =
    proofResult.publicSignals;

  const poolIface = new Interface(SHIELDED_POOL_ABI);
  const data = poolIface.encodeFunctionData("transfer", [
    "0x" + bytesToHex(proofResult.proofBytes),
    merkleRoot,
    nullifierHash,
    newCommitment1,
    newCommitment2,
    "0x" + bytesToHex(encryptedMemo1),
    "0x" + bytesToHex(encryptedMemo2),
  ]);

  const tx = await sendWithGas(signer, { to: poolAddress, data });

  return {
    tx,
    recipientNote: proofResult.recipientNote,
    changeNote: proofResult.changeNote,
  };
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

/**
 * Withdraw tokens from the shielded pool to a public EVM address.
 *
 * Steps:
 *   1. Sync Merkle tree
 *   2. Generate Groth16 proof (withdraw circuit)
 *   3. Encrypt change memo (if partial withdrawal)
 *   4. Submit ShieldedPool.withdraw(...)
 *   5. Return tx + optional change note
 */
export async function withdraw(
  params: WithdrawParams
): Promise<{
  tx: EthersTransactionResponse;
  changeNote: Note | undefined;
}> {
  const {
    signer,
    provider,
    poolAddress,
    inputNote,
    withdrawAmount,
    recipient,
    senderPublicKey,
    senderPrivateKey,
    wasmPath,
    zkeyPath,
  } = params;

  if (!signer.provider) throw new Error("withdraw: signer has no provider");
  if (inputNote.spent) throw new Error("withdraw: inputNote is already spent");
  if (inputNote.leafIndex < 0) throw new Error("withdraw: inputNote not yet finalised");
  if (withdrawAmount <= 0n || withdrawAmount > inputNote.amount) {
    throw new Error(`withdraw: invalid withdrawAmount ${withdrawAmount}`);
  }

  // Validate recipient address
  getAddress(recipient); // throws if invalid

  // 1. Sync Merkle tree
  const tree = new MerkleTreeSync();
  await tree.syncFromChain(provider, poolAddress);

  // Verify the tree leaf matches the note's commitment before generating proof
  const treeLeaves = tree.getLeaves();
  if (inputNote.leafIndex >= treeLeaves.length) {
    throw new Error(
      `withdraw: note leafIndex ${inputNote.leafIndex} is beyond tree size ${treeLeaves.length}.`
    );
  }
  const onChainLeaf = treeLeaves[inputNote.leafIndex];
  if (onChainLeaf !== inputNote.noteCommitment) {
    console.error("[withdraw] MERKLE LEAF MISMATCH!");
    console.error("  tree leaf at index", inputNote.leafIndex, ":", onChainLeaf?.toString());
    console.error("  note commitment:", inputNote.noteCommitment.toString());
    throw new Error(
      `withdraw: Merkle tree leaf at index ${inputNote.leafIndex} doesn't match note commitment.`
    );
  }

  const merklePath = await tree.getMerklePath(inputNote.leafIndex);

  // 2. Generate proof
  const proofResult = await generateWithdrawProof({
    inputNote,
    withdrawAmount,
    recipient,
    senderPublicKey,
    senderPrivateKey,
    merklePath,
    wasmPath,
    zkeyPath,
  });

  const [merkleRoot, nullifierHash, amount, changeCommitment] = proofResult.publicSignals;

  // 3. Encrypt change memo (if partial)
  let encryptedMemo: Uint8Array = new Uint8Array(0);
  if (proofResult.changeNote) {
    const changeMemoData = {
      amount: proofResult.changeNote.amount,
      blinding: proofResult.changeNote.blinding,
      secret: proofResult.changeNote.secret,
      nullifierPreimage: proofResult.changeNote.nullifierPreimage,
    };
    encryptedMemo = await encryptMemo(changeMemoData, senderPublicKey);
  }

  // 4. Submit transaction
  const poolIface = new Interface(SHIELDED_POOL_ABI);
  const data = poolIface.encodeFunctionData("withdraw", [
    "0x" + bytesToHex(proofResult.proofBytes),
    merkleRoot,
    nullifierHash,
    amount,
    changeCommitment,
    recipient,
    "0x" + bytesToHex(encryptedMemo),
  ]);

  const tx = await sendWithGas(signer, { to: poolAddress, data });

  return { tx, changeNote: proofResult.changeNote };
}

// ─── Relayed Private Transfer ────────────────────────────────────────────────

/**
 * Execute a private transfer via the relay API (no wallet signature needed).
 *
 * The user generates the ZK proof and encrypted memos locally, then POSTs
 * them to the relay server which submits the transaction through the
 * Paymaster contract. The user's EVM address never appears on-chain.
 */
export async function relayTransfer(
  params: RelayTransferParams
): Promise<{
  relay: RelayResponse;
  recipientNote: Note;
  changeNote: Note;
}> {
  const {
    provider,
    poolAddress,
    inputNote,
    transferAmount,
    recipientPublicKey,
    senderPublicKey,
    senderPrivateKey,
    wasmPath,
    zkeyPath,
    relayUrl = "/api/relay",
    paymasterAddress,
  } = params;

  if (inputNote.spent) throw new Error("relayTransfer: inputNote is already spent");
  if (inputNote.leafIndex < 0) throw new Error("relayTransfer: inputNote not yet finalised");
  if (transferAmount <= 0n || transferAmount > inputNote.amount) {
    throw new Error(`relayTransfer: invalid transferAmount ${transferAmount}`);
  }

  // 1. Sync Merkle tree
  const tree = new MerkleTreeSync();
  await tree.syncFromChain(provider, poolAddress);
  const merklePath = await tree.getMerklePath(inputNote.leafIndex);

  // 2. Generate proof
  const proofResult = await generateTransferProof({
    inputNote,
    transferAmount,
    recipientPublicKey,
    senderPublicKey,
    senderPrivateKey,
    merklePath,
    wasmPath,
    zkeyPath,
  });

  // 3. Encrypt memos
  const recipientMemoData = {
    amount: proofResult.recipientNote.amount,
    blinding: proofResult.recipientNote.blinding,
    secret: proofResult.recipientNote.secret,
    nullifierPreimage: proofResult.recipientNote.nullifierPreimage,
  };
  const senderMemoData = {
    amount: proofResult.changeNote.amount,
    blinding: proofResult.changeNote.blinding,
    secret: proofResult.changeNote.secret,
    nullifierPreimage: proofResult.changeNote.nullifierPreimage,
  };

  const encryptedMemo1 = await encryptMemo(recipientMemoData, recipientPublicKey);
  const encryptedMemo2 = await encryptMemo(senderMemoData, senderPublicKey);

  const [merkleRoot, nullifierHash, newCommitment1, newCommitment2] =
    proofResult.publicSignals;

  // 4. POST to relay API
  const body = {
    type: "transfer" as const,
    proof: "0x" + bytesToHex(proofResult.proofBytes),
    merkleRoot: merkleRoot.toString(),
    nullifierHash: nullifierHash.toString(),
    newCommitment1: newCommitment1.toString(),
    newCommitment2: newCommitment2.toString(),
    encryptedMemo1: "0x" + bytesToHex(encryptedMemo1),
    encryptedMemo2: "0x" + bytesToHex(encryptedMemo2),
    ...(paymasterAddress ? { paymasterAddress } : {}),
  };

  const res = await fetch(relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`relayTransfer: relay returned ${res.status}: ${errText}`);
  }

  const relay: RelayResponse = await res.json();

  // 5. Finalize notes — re-sync tree to find the leaf indices assigned on-chain
  const finalizedNotes = await _finalizeTransferNotes(
    provider,
    poolAddress,
    proofResult.recipientNote,
    proofResult.changeNote,
    relay.blockNumber
  );

  // 6. Post notifications for recipient and self (fire-and-forget)
  _postTransferNotifications({
    recipientPubKey: recipientPublicKey,
    senderPubKey: senderPublicKey,
    txHash: relay.txHash,
    blockNumber: relay.blockNumber,
    recipientNote: finalizedNotes.recipientNote,
    changeNote: finalizedNotes.changeNote,
    encryptedMemo1Hex: "0x" + bytesToHex(encryptedMemo1),
    encryptedMemo2Hex: "0x" + bytesToHex(encryptedMemo2),
  }).catch(() => {}); // Non-critical

  return {
    relay,
    recipientNote: finalizedNotes.recipientNote,
    changeNote: finalizedNotes.changeNote,
  };
}

// ─── Relayed Withdraw ────────────────────────────────────────────────────────

/**
 * Execute a withdrawal via the relay API (no wallet signature needed).
 */
export async function relayWithdraw(
  params: RelayWithdrawParams
): Promise<{
  relay: RelayResponse;
  changeNote: Note | undefined;
}> {
  const {
    provider,
    poolAddress,
    inputNote,
    withdrawAmount,
    recipient,
    senderPublicKey,
    senderPrivateKey,
    wasmPath,
    zkeyPath,
    relayUrl = "/api/relay",
    paymasterAddress,
  } = params;

  if (inputNote.spent) throw new Error("relayWithdraw: inputNote is already spent");
  if (inputNote.leafIndex < 0) throw new Error("relayWithdraw: inputNote not yet finalised");
  if (withdrawAmount <= 0n || withdrawAmount > inputNote.amount) {
    throw new Error(`relayWithdraw: invalid withdrawAmount ${withdrawAmount}`);
  }

  getAddress(recipient);

  // 1. Sync Merkle tree
  const tree = new MerkleTreeSync();
  await tree.syncFromChain(provider, poolAddress);

  // Verify the tree leaf matches the note's commitment before generating proof
  const treeLeaves = tree.getLeaves();
  if (inputNote.leafIndex >= treeLeaves.length) {
    throw new Error(
      `relayWithdraw: note leafIndex ${inputNote.leafIndex} is beyond tree size ${treeLeaves.length}. ` +
      `The Merkle tree may not be fully synced.`
    );
  }
  const onChainLeaf = treeLeaves[inputNote.leafIndex];
  if (onChainLeaf !== inputNote.noteCommitment) {
    console.error("[relayWithdraw] MERKLE LEAF MISMATCH!");
    console.error("  tree leaf at index", inputNote.leafIndex, ":", onChainLeaf?.toString());
    console.error("  note commitment:", inputNote.noteCommitment.toString());
    throw new Error(
      `relayWithdraw: Merkle tree leaf at index ${inputNote.leafIndex} doesn't match ` +
      `note commitment. The note may have been finalized with the wrong leafIndex.`
    );
  }

  const merklePath = await tree.getMerklePath(inputNote.leafIndex);

  // 2. Generate proof
  const proofResult = await generateWithdrawProof({
    inputNote,
    withdrawAmount,
    recipient,
    senderPublicKey,
    senderPrivateKey,
    merklePath,
    wasmPath,
    zkeyPath,
  });

  const [merkleRoot, nullifierHash, amount, changeCommitment] = proofResult.publicSignals;

  // 3. Encrypt change memo (if partial)
  let encryptedMemoHex = "0x";
  if (proofResult.changeNote) {
    const changeMemoData = {
      amount: proofResult.changeNote.amount,
      blinding: proofResult.changeNote.blinding,
      secret: proofResult.changeNote.secret,
      nullifierPreimage: proofResult.changeNote.nullifierPreimage,
    };
    const encryptedMemo = await encryptMemo(changeMemoData, senderPublicKey);
    encryptedMemoHex = "0x" + bytesToHex(encryptedMemo);
  }

  // 4. POST to relay API
  const body = {
    type: "withdraw" as const,
    proof: "0x" + bytesToHex(proofResult.proofBytes),
    merkleRoot: merkleRoot.toString(),
    nullifierHash: nullifierHash.toString(),
    amount: amount.toString(),
    changeCommitment: changeCommitment.toString(),
    recipient,
    encryptedMemo: encryptedMemoHex,
    ...(paymasterAddress ? { paymasterAddress } : {}),
  };

  const res = await fetch(relayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`relayWithdraw: relay returned ${res.status}: ${errText}`);
  }

  const relay: RelayResponse = await res.json();

  // 5. Finalize change note — re-sync tree to find the leaf index assigned on-chain
  let finalizedChange = proofResult.changeNote;
  if (finalizedChange) {
    const postTree = new MerkleTreeSync();
    await postTree.syncFromChain(provider, poolAddress);
    const changeIdx = postTree.findLeafIndex(finalizedChange.noteCommitment);
    if (changeIdx >= 0) {
      finalizedChange = await finaliseNote(
        { ...finalizedChange, createdAtBlock: relay.blockNumber },
        changeIdx
      );
    }
  }

  // 6. Self-notify for change note recovery on other devices (fire-and-forget)
  if (finalizedChange) {
    import("./relay-notify").then(({ postSelfNotification }) => {
      postSelfNotification({
        myPubKey: senderPublicKey,
        txHash: relay.txHash,
        leafIndex: finalizedChange!.leafIndex,
        blockNumber: relay.blockNumber,
        eventType: "withdrawal",
        memoHex: encryptedMemoHex,
        commitment: finalizedChange!.noteCommitment.toString(),
      }).catch(() => {});
    });
  }

  return { relay, changeNote: finalizedChange };
}

// ─── Internal: post notifications after transfer ─────────────────────────────

async function _postTransferNotifications(params: {
  recipientPubKey: import("./types").BabyJubPoint;
  senderPubKey: import("./types").BabyJubPoint;
  txHash: string;
  blockNumber: number;
  recipientNote: Note;
  changeNote: Note;
  encryptedMemo1Hex: string;
  encryptedMemo2Hex: string;
}): Promise<void> {
  const { postNotification, postSelfNotification } = await import("./relay-notify");

  // Notify recipient
  await postNotification({
    recipientPubKey: params.recipientPubKey,
    txHash: params.txHash,
    leafIndex: params.recipientNote.leafIndex,
    blockNumber: params.blockNumber,
    eventType: "transfer",
    memoHex: params.encryptedMemo1Hex,
    commitment: params.recipientNote.noteCommitment.toString(),
  });

  // Self-notify for change note recovery
  await postSelfNotification({
    myPubKey: params.senderPubKey,
    txHash: params.txHash,
    leafIndex: params.changeNote.leafIndex,
    blockNumber: params.blockNumber,
    eventType: "transfer",
    memoHex: params.encryptedMemo2Hex,
    commitment: params.changeNote.noteCommitment.toString(),
  });
}

// ─── Internal: finalize transfer output notes ────────────────────────────────

/**
 * After a transfer is confirmed on-chain, re-sync the Merkle tree and
 * look up the leaf indices for the two output notes, then finalize them
 * (compute nullifiers so they can be spent later).
 */
async function _finalizeTransferNotes(
  provider: import("./types").EthersProvider,
  poolAddress: string,
  recipientNote: Note,
  changeNote: Note,
  blockNumber: number
): Promise<{ recipientNote: Note; changeNote: Note }> {
  const postTree = new MerkleTreeSync();
  await postTree.syncFromChain(provider, poolAddress);

  const recipientIdx = postTree.findLeafIndex(recipientNote.noteCommitment);
  const changeIdx = postTree.findLeafIndex(changeNote.noteCommitment);

  const finalRecipient =
    recipientIdx >= 0
      ? await finaliseNote({ ...recipientNote, createdAtBlock: blockNumber }, recipientIdx)
      : recipientNote;

  const finalChange =
    changeIdx >= 0
      ? await finaliseNote({ ...changeNote, createdAtBlock: blockNumber }, changeIdx)
      : changeNote;

  return { recipientNote: finalRecipient, changeNote: finalChange };
}

// ─── Scan chain for incoming notes (memo trial decryption) ────────────────

/** Default deploy block for chain scanning. Updated to match current pool deployment. */
const SCAN_DEPLOY_BLOCK = 53105800;
const SCAN_CHUNK_SIZE = 2048;

/**
 * Scan on-chain events for notes addressed to the given private key.
 *
 * Replays PrivateTransfer and Withdrawal events, extracts encrypted memos,
 * and attempts trial decryption with the user's Baby Jubjub private key.
 * Successfully decrypted memos are reconstructed into full Note objects.
 *
 * @returns Array of discovered notes (already finalized with leafIndex + nullifier).
 */
export async function scanChainForNotes(params: {
  provider: import("./types").EthersProvider;
  poolAddress: string;
  myPrivateKey: bigint;
  myPublicKey: import("./types").BabyJubPoint;
  tokenAddress: string;
  existingNullifiers?: Set<string>;
  fromBlock?: number;
}): Promise<Note[]> {
  const { provider, poolAddress, myPrivateKey, myPublicKey, tokenAddress, existingNullifiers } = params;
  const startBlock = params.fromBlock ?? SCAN_DEPLOY_BLOCK;

  const iface = new Interface(SHIELDED_POOL_ABI);
  const depositTopic = iface.getEvent("Deposit")!.topicHash;
  const transferTopic = iface.getEvent("PrivateTransfer")!.topicHash;
  const withdrawalTopic = iface.getEvent("Withdrawal")!.topicHash;
  const topics = [[depositTopic, transferTopic, withdrawalTopic]];

  const latestBlock = await provider.getBlockNumber();
  const allLogs: { topics: string[]; data: string; blockNumber: number; logIndex?: number }[] = [];

  for (let start = startBlock; start <= latestBlock; start += SCAN_CHUNK_SIZE) {
    const end = Math.min(start + SCAN_CHUNK_SIZE - 1, latestBlock);
    const chunk = await provider.getLogs({
      address: poolAddress,
      topics,
      fromBlock: start,
      toBlock: end,
    });
    allLogs.push(...chunk);
  }

  allLogs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return (a.logIndex ?? 0) - (b.logIndex ?? 0);
  });

  // Replay events to track leaf indices AND collect memo events
  let leafIndex = 0;
  const memoEvents: Array<{
    memoBytes: Uint8Array;
    commitment: bigint;
    leafIndex: number;
    blockNumber: number;
  }> = [];

  for (const log of allLogs) {
    const topic = log.topics[0];
    if (topic === depositTopic) {
      // Deposit inserts 1 leaf, no encrypted memo
      leafIndex++;
    } else if (topic === transferTopic) {
      const parsed = iface.parseLog(log);
      if (parsed) {
        const commitment1 = parsed.args["commitment1"] as bigint;
        const commitment2 = parsed.args["commitment2"] as bigint;
        const memo1Hex = parsed.args["encryptedMemo1"] as string;
        const memo2Hex = parsed.args["encryptedMemo2"] as string;

        // commitment1 gets leafIndex, commitment2 gets leafIndex+1
        if (memo1Hex && memo1Hex.length > 2) {
          memoEvents.push({
            memoBytes: hexToBytes(memo1Hex.slice(2)),
            commitment: commitment1,
            leafIndex: leafIndex,
            blockNumber: log.blockNumber,
          });
        }
        if (memo2Hex && memo2Hex.length > 2) {
          memoEvents.push({
            memoBytes: hexToBytes(memo2Hex.slice(2)),
            commitment: commitment2,
            leafIndex: leafIndex + 1,
            blockNumber: log.blockNumber,
          });
        }
        leafIndex += 2;
      }
    } else if (topic === withdrawalTopic) {
      const parsed = iface.parseLog(log);
      if (parsed) {
        const changeCommitment = parsed.args["changeCommitment"] as bigint;
        const memoHex = parsed.args["encryptedMemo"] as string;

        if (changeCommitment !== 0n) {
          if (memoHex && memoHex.length > 2) {
            memoEvents.push({
              memoBytes: hexToBytes(memoHex.slice(2)),
              commitment: changeCommitment,
              leafIndex: leafIndex,
              blockNumber: log.blockNumber,
            });
          }
          leafIndex++;
        }
      }
    }
  }

  // Trial-decrypt all memos
  const discoveredNotes: Note[] = [];

  for (const event of memoEvents) {
    const memoData = await decryptMemo(event.memoBytes, myPrivateKey);
    if (memoData === null) continue;

    // Skip if we already have this note
    const note = await noteFromMemoData(
      memoData,
      myPublicKey,
      tokenAddress,
      event.leafIndex,
      event.blockNumber
    );

    // Skip notes we already know about
    if (existingNullifiers?.has(note.nullifier.toString())) continue;

    discoveredNotes.push(note);
  }

  return discoveredNotes;
}

// ─── Scan via notification relay (instant, no chain scanning) ───────────────

/**
 * Discover notes via the notification relay.
 * The sender posted encrypted notifications after each transfer.
 * This is O(1) per notification — no full chain scan needed.
 *
 * Falls back gracefully: returns empty array if relay is unreachable.
 */
export async function scanNotesFromRelay(params: {
  myPrivateKey: bigint;
  myPublicKey: import("./types").BabyJubPoint;
  tokenAddress: string;
  existingCommitments?: Set<string>;
}): Promise<Note[]> {
  const { fetchNotifications, deleteNotification } = await import("./relay-notify");

  const notifications = await fetchNotifications(
    params.myPublicKey,
    params.myPrivateKey
  );

  const discoveredNotes: Note[] = [];

  for (const notif of notifications) {
    // Skip notes we already have
    if (params.existingCommitments?.has(notif.data.commitment)) {
      // Clean up processed notification
      deleteNotification(params.myPublicKey, notif.id).catch(() => {});
      continue;
    }

    // The notification contains the on-chain memo — decrypt it for note data
    const memoBytes = hexToBytes(
      notif.data.memoHex.startsWith("0x")
        ? notif.data.memoHex.slice(2)
        : notif.data.memoHex
    );
    const memoData = await decryptMemo(memoBytes, params.myPrivateKey);
    if (memoData === null) continue;

    const note = await noteFromMemoData(
      memoData,
      params.myPublicKey,
      params.tokenAddress,
      notif.data.leafIndex,
      notif.data.blockNumber
    );

    discoveredNotes.push(note);

    // Clean up processed notification
    deleteNotification(params.myPublicKey, notif.id).catch(() => {});
  }

  return discoveredNotes;
}

// ─── Scan via indexer (fast, replaces full chain scanning) ──────────────────

/**
 * Discover notes via the Envio indexer.
 * Similar to scanChainForNotes but queries indexed data instead of RPC chunks.
 */
export async function scanNotesFromIndexer(params: {
  myPrivateKey: bigint;
  myPublicKey: import("./types").BabyJubPoint;
  tokenAddress: string;
  existingCommitments?: Set<string>;
  afterBlock?: number;
}): Promise<Note[]> {
  const { fetchMemoEvents } = await import("./indexer");
  const memoEvents = await fetchMemoEvents(params.afterBlock);

  const discoveredNotes: Note[] = [];
  for (const event of memoEvents) {
    if (params.existingCommitments?.has(event.commitment.toString())) continue;

    const memoBytes = hexToBytes(
      event.memoHex.startsWith("0x") ? event.memoHex.slice(2) : event.memoHex
    );
    const memoData = await decryptMemo(memoBytes, params.myPrivateKey);
    if (memoData === null) continue;

    const note = await noteFromMemoData(
      memoData,
      params.myPublicKey,
      params.tokenAddress,
      event.leafIndex,
      event.blockNumber
    );

    discoveredNotes.push(note);
  }

  return discoveredNotes;
}
