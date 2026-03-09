"use client";

import { useCallback, useEffect, useState } from "react";
import { useShieldedKey } from "@/hooks/use-shielded-key";
import { useWallet } from "@/hooks/use-wallet";
import { PinInput } from "./pin-input";
import type { VaultMethod } from "@/lib/zktoken/key-vault";

const btnPrimary =
  "w-full rounded-lg bg-[#b0b0b0] px-4 py-2.5 font-medium text-black hover:bg-[#acf901] hover:text-black border border-[#b0b0b0] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnSecondary =
  "w-full rounded-lg bg-transparent px-4 py-2.5 font-medium text-[#b0b0b0] hover:text-[#acf901] border border-[#2a2a2a] hover:border-[#acf901] disabled:opacity-40 transition-colors duration-200";

const btnDanger =
  "text-sm text-[#444444] hover:text-[#acf901] transition-colors duration-200";

/**
 * VaultGate — Renders either the unlock/setup flow or children (app content).
 *
 * States:
 *   1. No wallet → children (wallet connect handled elsewhere)
 *   2. Wallet connected, no vault, no pending key → "Derive Shielded Key" button
 *   3. Wallet connected, pending key (needsSetup) → choose passkey vs PIN → setup
 *   4. Wallet connected, vault exists (needsUnlock) → biometric prompt or PIN entry
 *   5. Vault unlocked → children
 */
export function VaultGate({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const {
    keypair,
    deriving,
    deriveKey,
    vaultStatus,
    needsSetup,
    needsUnlock,
    error,
    setupVault,
    unlockVault,
    resetVault,
    clearError,
  } = useShieldedKey();

  // If not connected or already unlocked, render children
  if (!address || keypair) {
    return <>{children}</>;
  }

  // Needs security setup (first time or migration)
  if (needsSetup) {
    return <SetupScreen setupVault={setupVault} error={error} clearError={clearError} />;
  }

  // Needs unlock (vault exists)
  if (needsUnlock) {
    return (
      <UnlockScreen
        method={vaultStatus.method!}
        unlockVault={unlockVault}
        resetVault={resetVault}
        error={error}
        clearError={clearError}
      />
    );
  }

  // No vault, no pending key — need to derive first
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#acf901" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-[#e0e0e0]">Shielded Key Required</h2>
        <p className="text-sm text-[#888888] max-w-sm">
          Sign a message with your wallet to derive your shielded key.
          You&apos;ll then secure it with biometrics or a PIN.
        </p>
      </div>
      <button onClick={deriveKey} disabled={deriving} className={btnPrimary} style={{ maxWidth: 320 }}>
        {deriving ? "Signing..." : "Derive Shielded Key"}
      </button>
      {error && <p className="text-sm text-[#acf901]">{error}</p>}
    </div>
  );
}

// ─── Setup Screen ───────────────────────────────────────────────────────────

function SetupScreen({
  setupVault,
  error,
  clearError,
}: {
  setupVault: (method: VaultMethod, pin?: string) => Promise<import("@/lib/zktoken/types").BabyJubKeyPair | null | undefined>;
  error: string | null;
  clearError: () => void;
}) {
  const [step, setStep] = useState<"choose" | "pin-create" | "pin-confirm" | "passkey-loading">("choose");
  const [pin, setPin] = useState("");
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Check passkey support on mount
  useEffect(() => {
    (async () => {
      const { isPasskeySupported } = await import("@/lib/zktoken/key-vault");
      setPasskeySupported(await isPasskeySupported());
    })();
  }, []);

  const handlePasskey = useCallback(async () => {
    setStep("passkey-loading");
    setLoading(true);
    clearError();
    await setupVault("passkey");
    setLoading(false);
  }, [setupVault, clearError]);

  const handlePinCreate = useCallback((enteredPin: string) => {
    setPin(enteredPin);
    setStep("pin-confirm");
    clearError();
  }, [clearError]);

  const handlePinConfirm = useCallback(
    async (confirmPin: string) => {
      if (confirmPin !== pin) {
        clearError();
        // Trigger a brief error
        setPin("");
        setStep("pin-create");
        // Show error via the setupVault error channel
        return;
      }
      setLoading(true);
      clearError();
      const result = await setupVault("pin", confirmPin);
      setLoading(false);
      if (!result) {
        setPin("");
        setStep("pin-create");
      }
    },
    [pin, setupVault, clearError]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#acf901" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-[#e0e0e0]">Secure Your Shielded Key</h2>
        <p className="text-sm text-[#888888] max-w-sm">
          Your private key will be encrypted and stored securely.
          Choose how you want to protect it.
        </p>
      </div>

      {step === "choose" && (
        <div className="w-full max-w-xs space-y-3">
          {passkeySupported && (
            <button onClick={handlePasskey} className={btnPrimary}>
              Use Biometrics / Passkey
            </button>
          )}
          <button
            onClick={() => { clearError(); setStep("pin-create"); }}
            className={passkeySupported ? btnSecondary : btnPrimary}
          >
            Use 6-Digit PIN
          </button>
          {passkeySupported === false && (
            <p className="text-xs text-[#444444] text-center">
              Biometrics not available on this device
            </p>
          )}
        </div>
      )}

      {step === "pin-create" && (
        <div className="w-full max-w-xs space-y-4">
          <p className="text-sm text-[#888888] text-center">Create a 6-digit PIN</p>
          <PinInput onComplete={handlePinCreate} error={error} disabled={loading} />
          <button onClick={() => setStep("choose")} className={btnDanger}>
            Back
          </button>
        </div>
      )}

      {step === "pin-confirm" && (
        <div className="w-full max-w-xs space-y-4">
          <p className="text-sm text-[#888888] text-center">Confirm your PIN</p>
          <PinInput
            onComplete={handlePinConfirm}
            error={error}
            disabled={loading}
          />
          <button onClick={() => { setPin(""); setStep("pin-create"); }} className={btnDanger}>
            Back
          </button>
        </div>
      )}

      {step === "passkey-loading" && (
        <div className="w-full max-w-xs space-y-4 text-center">
          <p className="text-sm text-[#888888]">
            {loading ? "Complete the biometric prompt..." : "Setting up passkey..."}
          </p>
          {error && (
            <div className="space-y-3">
              <p className="text-sm text-[#acf901]">{error}</p>
              <button onClick={() => { clearError(); setStep("choose"); }} className={btnSecondary}>
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Unlock Screen ──────────────────────────────────────────────────────────

function UnlockScreen({
  method,
  unlockVault,
  resetVault,
  error,
  clearError,
}: {
  method: VaultMethod;
  unlockVault: (pin?: string) => Promise<import("@/lib/zktoken/types").BabyJubKeyPair | null | undefined>;
  resetVault: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleBiometricUnlock = useCallback(async () => {
    setLoading(true);
    clearError();
    await unlockVault();
    setLoading(false);
  }, [unlockVault, clearError]);

  const handlePinUnlock = useCallback(
    async (pin: string) => {
      setLoading(true);
      clearError();
      await unlockVault(pin);
      setLoading(false);
    },
    [unlockVault, clearError]
  );

  const handleReset = useCallback(async () => {
    await resetVault();
    setShowReset(false);
  }, [resetVault]);

  // Auto-trigger biometric prompt on mount for passkey vaults
  useEffect(() => {
    if (method === "passkey") {
      handleBiometricUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#acf901" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-[#e0e0e0]">Unlock Shielded Key</h2>
        <p className="text-sm text-[#888888]">
          {method === "passkey"
            ? "Verify your identity to unlock"
            : "Enter your 6-digit PIN to unlock"}
        </p>
      </div>

      {method === "passkey" ? (
        <div className="w-full max-w-xs space-y-4">
          <button
            onClick={handleBiometricUnlock}
            disabled={loading}
            className={btnPrimary}
          >
            {loading ? "Verifying..." : "Unlock with Biometrics"}
          </button>
          {error && <p className="text-sm text-[#acf901] text-center">{error}</p>}
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-4">
          <PinInput onComplete={handlePinUnlock} error={error} disabled={loading} />
        </div>
      )}

      {/* Reset option */}
      <div className="text-center space-y-2">
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className={btnDanger}>
            Forgot PIN / Reset vault
          </button>
        ) : (
          <div className="space-y-3 max-w-xs">
            <p className="text-sm text-[#888888]">
              This will delete the encrypted key. You can re-derive it by signing
              with your wallet again.
            </p>
            <div className="flex gap-2">
              <button onClick={handleReset} className={btnPrimary}>
                Reset Vault
              </button>
              <button onClick={() => setShowReset(false)} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
