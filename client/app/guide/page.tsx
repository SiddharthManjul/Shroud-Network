export default function GuidePage() {
  return (
    <div className="space-y-12 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-[#acf901] tracking-tight">
          Usage Guide
        </h1>
        <p className="mt-2 text-[#888888] leading-relaxed">
          A step-by-step walkthrough of every feature in Shroud Network — from
          claiming test tokens to making fully private transfers on Avalanche.
        </p>
      </div>

      {/* ── Terminology ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#acf901]">Terminology</h2>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5 space-y-3 text-sm leading-relaxed">
          <Term
            name="Shielded Pool"
            desc="A smart contract that holds ERC20 tokens and tracks ownership via cryptographic commitments instead of public balances. Tokens enter the pool through deposits, move around privately, and exit through withdrawals."
          />
          <Term
            name="Note"
            desc="A private token holding inside the shielded pool. Each note contains an amount, random secrets, and the owner's public key — all hidden from the blockchain. Think of it like a sealed envelope of value that only you can open."
          />
          <Term
            name="Commitment"
            desc="A cryptographic fingerprint of a note that gets stored on-chain in the Merkle tree. It reveals nothing about the note's contents — not the amount, not the owner."
          />
          <Term
            name="Nullifier"
            desc="A unique tag revealed when a note is spent. The contract records it to prevent double-spending. It cannot be linked back to the original commitment."
          />
          <Term
            name="Shielded Key"
            desc="A Baby Jubjub keypair (X and Y coordinates) derived from your wallet signature. This is your identity inside the shielded pool — you share the public key with senders so they can create notes only you can spend."
          />
          <Term
            name="ZK Proof"
            desc="A zero-knowledge proof (Groth16) that proves a transaction is valid — correct balances, valid note ownership, proper Merkle inclusion — without revealing any private data."
          />
          <Term
            name="Merkle Tree"
            desc="An append-only data structure of all commitments ever created. The client rebuilds it locally to generate inclusion proofs for your notes."
          />
          <Term
            name="Encrypted Memo"
            desc="An ECDH-encrypted payload attached to transfers. It contains the note details (amount, secrets) so the recipient can discover and spend the note. Only the intended recipient can decrypt it."
          />
        </div>
      </section>

      {/* ── Flow Overview ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#acf901]">How It All Fits Together</h2>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5 text-sm text-[#888888] leading-relaxed font-mono whitespace-pre-line">
{`Faucet ──→ Get test tokens (ERC20)
   │
Pools ──→ Create a shielded pool for your token
   │
Deposit ──→ Lock tokens into the pool → receive a Note
   │
Notes ──→ View & manage your private notes
   │
Transfer ──→ Send privately (note → 2 new notes)
   │
Scan ──→ Discover notes sent to you
   │
Withdraw ──→ Exit tokens back to any EVM address`}
        </div>
      </section>

      <Hr />

      {/* ── 1. Faucet ── */}
      <GuideSection
        number={1}
        title="Faucet"
        what="The faucet mints free SRD test tokens to your wallet. These are standard ERC20 tokens on the Avalanche Fuji testnet — the same tokens you'll later deposit into the shielded pool."
        why="You need ERC20 tokens before you can deposit into a shielded pool. On testnet, the faucet gives you an unlimited supply so you can experiment freely without real funds."
        steps={[
          "Connect your wallet (MetaMask or any EVM wallet) to Avalanche Fuji.",
          "Navigate to the Faucet page.",
          "Enter the amount you want (leave blank for the default 1,000).",
          'Click "Claim Tokens" and confirm the transaction in your wallet.',
          "Wait for the transaction to confirm — your SRD balance will update.",
          'Optionally click "Add to MetaMask" to see the token balance in your wallet.',
        ]}
        tips={[
          "You can claim tokens multiple times — there is no cooldown.",
          "If you switch the active token in the navbar, the faucet will mint that token instead (if it has a faucet function).",
        ]}
      />

      <Hr />

      {/* ── 2. Pool Creation ── */}
      <GuideSection
        number={2}
        title="Pool Creation"
        what="Pool creation deploys a new shielded pool contract for any ERC20 token. Each token gets its own pool with its own Merkle tree and commitment set. Once created, anyone can deposit that token."
        why="Shroud Network supports privacy for any ERC20 token — not just predefined ones. If a pool doesn't exist for the token you want to use, you create one. The pool is shared by all users, which grows the anonymity set."
        steps={[
          "Navigate to the Pools page.",
          "Either use the Quick Select button (e.g. WAVAX) or paste any ERC20 token contract address.",
          'Click "Lookup" to fetch the token\'s name, symbol, and decimals from the chain.',
          "Verify the token metadata displayed is correct.",
          'Click "Create Pool" and confirm the transaction.',
          "Once confirmed, the token will appear in the token selector dropdown in the navbar.",
        ]}
        tips={[
          "For native AVAX: create a WAVAX pool. The deposit form will automatically wrap your AVAX before depositing.",
          "Each token can only have one pool — if it already exists, you'll see a message telling you to select it from the navbar.",
          "The Registered Pools section at the bottom shows all pools currently available.",
        ]}
      />

      <Hr />

      {/* ── 3. Deposit ── */}
      <GuideSection
        number={3}
        title="Deposit"
        what="Depositing locks your ERC20 tokens into the shielded pool contract and creates a private note in your local storage. The note is a cryptographic commitment added to the on-chain Merkle tree."
        why="Deposits are the entry point into the privacy system. Once deposited, your tokens exist as shielded notes — all subsequent transfers are completely private. The deposit amount is visible on-chain (the ERC20 transfer is public), but privacy begins immediately after."
        steps={[
          "Make sure you have the correct token selected in the navbar.",
          "Navigate to the Deposit page.",
          "If depositing into a WAVAX pool, choose between Native AVAX (auto-wraps) or WAVAX (ERC20).",
          "Enter the amount to deposit (whole numbers, no decimals).",
          'Click "Deposit" — your wallet will prompt for two approvals: one to approve the token transfer, one for the deposit transaction.',
          "Wait for the transaction to confirm. Your note will be stored locally with its leaf index.",
        ]}
        tips={[
          "Your shielded key is automatically derived the first time you deposit — you'll be asked to sign a message with your wallet.",
          "If a deposit confirms but the note shows as \"unfinalized\", use the recovery button to sync the Merkle tree and match your commitment.",
          "Deposit amounts are public. For better privacy, use round numbers (100, 500, 1000) to blend in with other depositors.",
        ]}
      />

      <Hr />

      {/* ── 4. Notes ── */}
      <GuideSection
        number={4}
        title="Notes"
        what="The Notes page is your private note inventory. It shows every note you own — both unspent (available to transfer or withdraw) and spent (already consumed). Notes are stored locally in your browser."
        why="Since all balances inside the shielded pool are hidden on-chain, your local note storage is the only record of what you own. The Notes page gives you visibility into your private holdings and their status."
        steps={[
          "Navigate to the Notes page.",
          "View your unspent notes — each shows the amount, token, and leaf index.",
          "Spent notes appear in a separate section below.",
          'Use "Scan" to check for notes sent to you by other users (see Scanning below).',
          'Use "Clear All" to wipe your local note storage (use with caution — this is irreversible).',
        ]}
        tips={[
          "Notes are stored in your browser's localStorage. Clearing browser data will delete them. Back up important note data.",
          "A note's leaf index is its position in the Merkle tree — you'll need it for proof generation, but the app handles this automatically.",
          "If you see notes stuck with a negative leaf index, go to Deposit and use the recovery button.",
        ]}
      />

      <Hr />

      {/* ── 5. Scanning ── */}
      <GuideSection
        number={5}
        title="Scanning for Incoming Notes"
        what="Scanning checks on-chain transfer events and attempts to decrypt the encrypted memos attached to each one using your shielded private key. If decryption succeeds, it means someone sent you a note — and it gets added to your local inventory."
        why="When someone sends you a private transfer, there is no notification — the blockchain only shows encrypted data. Your client must scan events and try decrypting each memo to discover notes addressed to you. This is the only way to receive private transfers."
        steps={[
          'Go to the Dashboard or Notes page and click "Scan" (or use the Scan tile in Quick Actions).',
          "The app will query on-chain events and attempt decryption with your key.",
          "Any discovered notes are automatically saved to your local storage.",
          'You\'ll see "Scan complete" when finished.',
        ]}
        tips={[
          "Scan regularly if you expect incoming transfers — there is no push notification system.",
          "Scanning is read-only and costs no gas. It only reads events from the chain.",
          "The more transfer events in the pool, the longer scanning takes. This is a known UX tradeoff of private systems.",
        ]}
      />

      <Hr />

      {/* ── 6. Transfer ── */}
      <GuideSection
        number={6}
        title="Private Transfer"
        what="A private transfer consumes one of your notes and creates two new notes — one for the recipient (the transfer amount) and one for yourself (the change). A ZK proof verifies everything is valid without revealing any details on-chain."
        why="This is the core privacy feature. On-chain observers see a nullifier (proving a note was spent), two new commitments, a ZK proof, and encrypted memos — but they cannot determine the amount, sender, or recipient. Transfers can be chained indefinitely for continuous privacy."
        steps={[
          "Navigate to the Transfer page.",
          "Select which note to spend from the dropdown.",
          "Copy the recipient's shielded public key (both X and Y coordinates) into the input fields. They can find these on their own Transfer page.",
          "Enter the transfer amount (must be less than or equal to the note's value).",
          'Click "Transfer" — the app will generate a ZK proof (takes a few seconds), encrypt the memo for the recipient, and submit via the relay.',
          "Once confirmed, your spent note is marked as used and a change note (if any) is saved automatically.",
        ]}
        tips={[
          "Your shielded public key is displayed at the top of the Transfer page — share both X and Y with anyone who wants to send you tokens.",
          "Use the copy buttons next to your keys for easy sharing.",
          "Change is handled automatically: if you spend a 1000-token note and transfer 300, you'll get an 700-token change note back.",
          "The recipient must scan to discover the transfer. Tell them to hit the Scan button.",
          "Transfers are relayed (gasless for you) — the relay submits the transaction on your behalf.",
        ]}
      />

      <Hr />

      {/* ── 7. Withdraw ── */}
      <GuideSection
        number={7}
        title="Withdraw"
        what="Withdrawing exits tokens from the shielded pool back to any public EVM address. It consumes a note (via nullifier + ZK proof) and releases the corresponding ERC20 tokens from the pool contract to the specified recipient."
        why="Withdrawals are how you move value back into the public world. The withdrawal amount is visible (the contract must release real ERC20 tokens), but the link between the original depositor and the withdrawer is broken by the privacy of intermediate transfers. You can withdraw to any address — it does not have to be the one that deposited."
        steps={[
          "Navigate to the Withdraw page.",
          "Select the note to spend from the dropdown.",
          "Enter the public EVM address that should receive the tokens (0x...).",
          "Enter the withdrawal amount (partial withdrawals create a change note for the remainder).",
          'Click "Withdraw via Relay" — a ZK proof is generated and submitted through the relay.',
          "Once confirmed, the ERC20 tokens arrive at the recipient address.",
        ]}
        tips={[
          "Withdraw to a fresh address for maximum privacy — withdrawing to the same address that deposited defeats the purpose.",
          "Partial withdrawals are supported. If your note holds 1000 tokens and you withdraw 400, you'll get a 600-token change note.",
          "Withdrawal amounts are public. Like deposits, use round numbers to minimize fingerprinting.",
          "The relay handles gas — you don't need AVAX in the withdrawing address.",
        ]}
      />

      {/* ── Footer ── */}
      <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5 text-sm text-[#888888] leading-relaxed space-y-2">
        <p className="text-[#acf901] font-semibold">Important Reminders</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Your notes are stored locally in your browser. If you clear browser
            data, your notes are gone. There is no recovery from the server.
          </li>
          <li>
            Your shielded key is derived from a wallet signature — same wallet =
            same key. But notes themselves are not recoverable without local
            storage or a full chain rescan.
          </li>
          <li>
            Privacy is proportional to the anonymity set. The more users in the
            pool, the stronger the privacy for everyone.
          </li>
          <li>
            This is testnet software. Do not use with real funds on mainnet
            until the system has been fully audited.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ── Helper Components ── */

function Term({ name, desc }: { name: string; desc: string }) {
  return (
    <div>
      <span className="font-semibold text-[#acf901]">{name}</span>
      <span className="text-[#666666]"> — </span>
      <span className="text-[#888888]">{desc}</span>
    </div>
  );
}

function Hr() {
  return <hr className="border-[#2a2a2a]" />;
}

function GuideSection({
  number,
  title,
  what,
  why,
  steps,
  tips,
}: {
  number: number;
  title: string;
  what: string;
  why: string;
  steps: string[];
  tips: string[];
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-[#acf901]">
        {number}. {title}
      </h2>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[#b0b0b0] uppercase tracking-wider mb-1">
            What
          </h3>
          <p className="text-sm text-[#888888] leading-relaxed">{what}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#b0b0b0] uppercase tracking-wider mb-1">
            Why
          </h3>
          <p className="text-sm text-[#888888] leading-relaxed">{why}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#b0b0b0] uppercase tracking-wider mb-1">
            How
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#888888] leading-relaxed">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        {tips.length > 0 && (
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-4">
            <p className="text-xs font-semibold text-[#b0b0b0] uppercase tracking-wider mb-2">
              Tips
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-[#666666]">
              {tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
