"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { BrowserProvider, JsonRpcProvider, type JsonRpcSigner } from "ethers";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { useToken } from "@/providers/token-provider";
import { useZkToken } from "@/hooks/use-zktoken";
import type { Note, BabyJubKeyPair } from "@/lib/zktoken/types";
import { NoteCard } from "./note-card";
import { ProofStatus } from "./proof-status";

const btnPrimary =
  "rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnSecondary =
  "rounded-lg bg-transparent px-4 py-2.5 font-medium text-[#b0b0b0] hover:text-[#acf901] border border-[#2a2a2a] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnDanger =
  "rounded-lg border border-[#acf901]/30 px-3 py-1.5 text-sm text-[#acf901]/80 hover:bg-[#acf901]/10 transition-colors";

// ─── Old-key derivation (wallet-based, matches the old shielded-key-provider) ──

const SUBGROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

async function deriveOldKeypair(signer: JsonRpcSigner): Promise<BabyJubKeyPair> {
  const { keccak256, toUtf8Bytes } = await import("ethers");
  const { KeyManager } = await import("@/lib/zktoken/keys");

  const address = await signer.getAddress();
  const message = "zktoken-shielded-key-v1:" + address.toLowerCase();
  const signature = await signer.signMessage(message);

  const hash = keccak256(toUtf8Bytes(signature));
  let privKey = BigInt(hash) % SUBGROUP_ORDER;
  if (privKey === 0n) privKey = 1n;

  const privKeyHex = privKey.toString(16).padStart(64, "0");
  return KeyManager.fromPrivateKey(privKeyHex);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MigrateForm() {
  const { ready } = useZkToken();
  const { keypair: newKeypair } = useShieldedKey();
  const { activeToken } = useToken();

  const POOL_ADDRESS = activeToken?.pool ?? "";
  const tokenSymbol = activeToken?.symbol ?? "Token";

  // Wallet connection state (self-contained, not using global WalletProvider)
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletSigner, setWalletSigner] = useState<JsonRpcSigner | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);

  // Old key + notes
  const [oldKeypair, setOldKeypair] = useState<BabyJubKeyPair | null>(null);
  const [oldNotes, setOldNotes] = useState<Note[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  // Migration modal
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState<string | null>(null);
  const [migratedCount, setMigratedCount] = useState(0);

  // ─── Wallet connect ─────────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("No wallet found. Install MetaMask.");
      return;
    }
    setWalletConnecting(true);
    try {
      const bp = new BrowserProvider(window.ethereum);
      await bp.send("eth_requestAccounts", []);
      const s = await bp.getSigner();
      const addr = await s.getAddress();
      setWalletSigner(s);
      setWalletAddress(addr);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setWalletConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setWalletSigner(null);
    setOldKeypair(null);
    setOldNotes([]);
    setScanStatus(null);
  }, []);

  // ─── Derive old key from wallet ────────────────────────────────────────

  const deriveOldKey = useCallback(async () => {
    if (!walletSigner) return;
    try {
      setScanStatus("Sign the message to derive your old shielded key...");
      const kp = await deriveOldKeypair(walletSigner);
      setOldKeypair(kp);
      setScanStatus("Old shielded key derived. Click Scan to find your notes.");
    } catch (err) {
      setScanStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [walletSigner]);

  // Auto-derive old key when wallet connects
  useEffect(() => {
    if (walletSigner && !oldKeypair) {
      deriveOldKey();
    }
  }, [walletSigner, oldKeypair, deriveOldKey]);

  // ─── Scan for old notes ────────────────────────────────────────────────

  const scanOldNotes = useCallback(async () => {
    if (!oldKeypair || !POOL_ADDRESS) return;
    setScanning(true);
    setScanStatus("Scanning chain for notes...");

    try {
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const existingCommitments = new Set<string>();
      const foundNotes: Note[] = [];

      // Tier 1: Try indexer first
      try {
        const { scanNotesFromIndexer } = await import("@/lib/zktoken/transaction");
        const indexerNotes = await scanNotesFromIndexer({
          myPrivateKey: oldKeypair.privateKey,
          myPublicKey: oldKeypair.publicKey,
          tokenAddress: activeToken?.token ?? "",
          existingCommitments,
          afterBlock: 0,
        });
        for (const note of indexerNotes) {
          foundNotes.push(note);
          existingCommitments.add(note.noteCommitment.toString());
        }
      } catch (err) {
        console.warn("[migrate] Indexer scan failed, falling back to chain:", err);
      }

      // Tier 2: Chain scan fallback
      if (foundNotes.length === 0) {
        const { scanChainForNotes } = await import("@/lib/zktoken/transaction");
        const chainNotes = await scanChainForNotes({
          provider: provider as never,
          poolAddress: POOL_ADDRESS,
          myPrivateKey: oldKeypair.privateKey,
          myPublicKey: oldKeypair.publicKey,
          tokenAddress: activeToken?.token ?? "",
          existingNullifiers: new Set(),
        });
        for (const note of chainNotes) {
          foundNotes.push(note);
        }
      }

      // Check spent status
      if (foundNotes.length > 0) {
        const { Contract } = await import("ethers");
        const { SHIELDED_POOL_ABI } = await import("@/lib/zktoken/abi/shielded-pool");
        const pool = new Contract(POOL_ADDRESS, SHIELDED_POOL_ABI, provider);

        const checks = await Promise.all(
          foundNotes.map((n) =>
            n.nullifier !== 0n ? pool.isSpent(n.nullifier).catch(() => false) : false
          )
        );
        for (let i = 0; i < foundNotes.length; i++) {
          if (checks[i]) foundNotes[i] = { ...foundNotes[i], spent: true };
        }
      }

      setOldNotes(foundNotes);
      const unspentCount = foundNotes.filter((n) => !n.spent).length;
      setScanStatus(
        foundNotes.length === 0
          ? "No notes found for this wallet."
          : `Found ${foundNotes.length} notes (${unspentCount} unspent).`
      );
    } catch (err) {
      setScanStatus(`Scan error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  }, [oldKeypair, POOL_ADDRESS, activeToken?.token]);

  // ─── Migrate a single note ────────────────────────────────────────────

  const migrateNote = useCallback(
    async (note: Note) => {
      if (!oldKeypair || !newKeypair || !POOL_ADDRESS) return;

      setMigrating(true);
      setMigrateStatus(null);

      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);

        setMigrateStatus("Syncing Merkle tree...");
        const { relayTransfer } = await import("@/lib/zktoken/transaction");

        setMigrateStatus("Generating ZK proof (this may take a moment)...");
        const result = await relayTransfer({
          provider: provider as never,
          poolAddress: POOL_ADDRESS,
          inputNote: note,
          transferAmount: note.amount,
          recipientPublicKey: newKeypair.publicKey,
          senderPublicKey: oldKeypair.publicKey,
          senderPrivateKey: oldKeypair.privateKey,
          wasmPath: "/circuits/transfer.wasm",
          zkeyPath: "/circuits/transfer_final.zkey",
          paymasterAddress: activeToken?.paymaster,
        });

        setMigrateStatus(`Migration successful! Tx: ${result.relay.txHash}`);

        // Mark old note as spent in local state
        setOldNotes((prev) =>
          prev.map((n) =>
            n.noteCommitment === note.noteCommitment ? { ...n, spent: true } : n
          )
        );
        setMigratedCount((c) => c + 1);

        // Save the new note to the user's email-based note store
        const { NoteStore, encodeNote } = await import("@/lib/zktoken/note");
        const storageKey =
          "zktoken_notes_" +
          newKeypair.publicKey[0].toString(16).slice(0, 16) +
          "_" +
          (activeToken?.token ?? "").toLowerCase().slice(0, 10);

        // Load existing notes, add new one, persist
        const existing = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[];
        if (result.recipientNote && result.recipientNote.amount > 0n) {
          existing.push(encodeNote(result.recipientNote));
        }
        if (result.changeNote && result.changeNote.amount > 0n) {
          existing.push(encodeNote(result.changeNote));
        }
        localStorage.setItem(storageKey, JSON.stringify(existing));

        // Close modal after short delay
        setTimeout(() => setSelectedNote(null), 2000);
      } catch (err) {
        setMigrateStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setMigrating(false);
      }
    },
    [oldKeypair, newKeypair, POOL_ADDRESS, activeToken?.paymaster, activeToken?.token]
  );

  // ─── Render ────────────────────────────────────────────────────────────

  const unspentOldNotes = oldNotes.filter((n) => !n.spent);

  return (
    <div className="space-y-6">
      {/* Step 1: Connect wallet */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#acf901] text-sm font-bold">
            1
          </div>
          <h2 className="text-lg font-semibold text-[#e0e0e0]">Connect Old Wallet</h2>
        </div>
        <p className="text-sm text-[#888888]">
          Connect the MetaMask wallet you previously used to deposit and transfer tokens.
        </p>
        {walletAddress ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-[#acf901]">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            {oldKeypair && (
              <span className="rounded-full bg-[#acf901]/10 px-2 py-0.5 text-xs text-[#acf901]">
                Key derived
              </span>
            )}
            <button onClick={disconnectWallet} className={btnDanger}>
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={walletConnecting}
            className={btnPrimary}
            style={{ maxWidth: 280 }}
          >
            {walletConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      {/* Step 2: Scan for notes */}
      {oldKeypair && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#acf901] text-sm font-bold">
              2
            </div>
            <h2 className="text-lg font-semibold text-[#e0e0e0]">Scan for Notes</h2>
          </div>
          <p className="text-sm text-[#888888]">
            Scan the blockchain for shielded notes belonging to your old wallet key.
          </p>
          <button
            onClick={scanOldNotes}
            disabled={scanning}
            className={btnPrimary}
            style={{ maxWidth: 280 }}
          >
            {scanning ? "Scanning..." : "Scan for Notes"}
          </button>
          {scanStatus && (
            <p className="text-sm text-[#888888]">{scanStatus}</p>
          )}
        </div>
      )}

      {/* Step 3: Notes list + migration */}
      {oldNotes.length > 0 && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#acf901] text-sm font-bold">
                3
              </div>
              <h2 className="text-lg font-semibold text-[#e0e0e0]">Migrate Notes</h2>
            </div>
            {migratedCount > 0 && (
              <span className="text-sm text-[#acf901]">
                {migratedCount} migrated
              </span>
            )}
          </div>
          <p className="text-sm text-[#888888]">
            Click on an unspent note to migrate it to your email-based identity.
            {!newKeypair && " Unlock your shielded key first (via the vault)."}
          </p>

          {/* Unspent notes */}
          {unspentOldNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#acf901] mb-2">
                Unspent ({unspentOldNotes.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {unspentOldNotes.map((note, i) => (
                  <button
                    key={`${note.noteCommitment}-${i}`}
                    onClick={() => setSelectedNote(note)}
                    disabled={!newKeypair || !ready}
                    className="text-left disabled:opacity-40 transition-opacity"
                  >
                    <NoteCard note={note} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spent notes */}
          {oldNotes.some((n) => n.spent) && (
            <div>
              <h3 className="text-sm font-medium text-[#888888] mb-2">
                Spent / Migrated ({oldNotes.filter((n) => n.spent).length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {oldNotes
                  .filter((n) => n.spent)
                  .map((note, i) => (
                    <NoteCard key={`spent-${note.noteCommitment}-${i}`} note={note} />
                  ))}
              </div>
            </div>
          )}

          {unspentOldNotes.length === 0 && oldNotes.every((n) => n.spent) && (
            <div className="rounded-lg border border-[#acf901]/30 bg-[#acf901]/5 p-4 text-center">
              <p className="text-[#acf901] font-medium">All notes migrated!</p>
              <p className="text-sm text-[#888888] mt-1">
                Your funds are now accessible with your email account.
                Go to Notes to see them.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Migration Modal */}
      {selectedNote && newKeypair && (
        <MigrateModal
          note={selectedNote}
          newKeypair={newKeypair}
          tokenSymbol={tokenSymbol}
          migrating={migrating}
          status={migrateStatus}
          onMigrate={() => migrateNote(selectedNote)}
          onClose={() => {
            if (!migrating) {
              setSelectedNote(null);
              setMigrateStatus(null);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Migration Modal ───────────────────────────────────────────────────────

function MigrateModal({
  note,
  newKeypair,
  tokenSymbol,
  migrating,
  status,
  onMigrate,
  onClose,
}: {
  note: Note;
  newKeypair: BabyJubKeyPair;
  tokenSymbol: string;
  migrating: boolean;
  status: string | null;
  onMigrate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#acf901]">Migrate Note</h2>
          <button
            onClick={onClose}
            disabled={migrating}
            className="rounded-md p-1 text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/10 transition-colors disabled:opacity-40"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Note details */}
        <div className="rounded-lg border border-[#2a2a2a] bg-black p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#888888]">Amount</span>
            <span className="text-lg font-bold text-[#acf901]">
              {note.amount.toString()} {tokenSymbol}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#888888]">Leaf Index</span>
            <span className="text-sm font-mono text-[#e0e0e0]">
              #{note.leafIndex}
            </span>
          </div>
          <div>
            <span className="text-sm text-[#888888]">Commitment</span>
            <p className="text-xs font-mono text-[#444444] break-all mt-0.5">
              0x{note.noteCommitment.toString(16)}
            </p>
          </div>
        </div>

        {/* Destination (new email key) */}
        <div className="rounded-lg border border-[#2a2a2a] bg-black p-4 space-y-2">
          <p className="text-sm text-[#888888]">Destination (Email-based Key)</p>
          <div className="text-xs font-mono text-[#acf901] break-all">
            <p>X: {newKeypair.publicKey[0].toString()}</p>
            <p className="mt-1">Y: {newKeypair.publicKey[1].toString()}</p>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-lg border border-[#acf901]/20 bg-[#acf901]/5 p-3">
          <p className="text-xs text-[#888888]">
            This will generate a ZK proof and execute a private transfer from your old
            wallet-based key to your new email-based key. The full note amount will be
            transferred. Gas is paid by the relay.
          </p>
        </div>

        <ProofStatus generating={migrating} />

        {status && (
          <p className={`text-sm break-all ${status.startsWith("Error") ? "text-red-400" : "text-[#888888]"}`}>
            {status}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onMigrate}
            disabled={migrating}
            className={`flex-1 ${btnPrimary}`}
          >
            {migrating ? "Migrating..." : "Migrate Note"}
          </button>
          <button
            onClick={onClose}
            disabled={migrating}
            className={btnSecondary}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
