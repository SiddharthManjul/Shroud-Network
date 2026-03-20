"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Key, Plus, Copy, Trash2, Check, Loader2 } from "lucide-react";

interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  name: string;
  environment: string;
  scope: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Default");
  const [newKeyEnv, setNewKeyEnv] = useState("test");
  const [newKeyScope, setNewKeyScope] = useState("secret");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadKeys() {
    try {
      const data = await api.listApiKeys();
      setKeys(data.keys);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await api.createApiKey(newKeyName, newKeyEnv, newKeyScope);
      setRevealedKey(result.key);
      setShowCreate(false);
      await loadKeys();
    } catch {
      // handled
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await api.revokeApiKey(id);
    await loadKeys();
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#acf901]">API Keys</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-[#acf901] text-black px-4 py-2 text-sm font-semibold hover:bg-[#acf901]/90 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create Key
        </button>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="mb-6 rounded-lg border border-[#acf901]/30 bg-[#acf901]/5 p-4">
          <p className="text-xs text-[#acf901] font-semibold uppercase tracking-wider mb-2">
            Your new API key (shown once — copy it now)
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm font-mono text-[#acf901] bg-[#0d0d0d] rounded px-3 py-2 border border-[#2a2a2a] overflow-x-auto">
              {revealedKey}
            </code>
            <button
              onClick={() => handleCopy(revealedKey)}
              className="shrink-0 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-2 text-[#888888] hover:text-[#acf901] transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#acf901]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-xs text-[#888888] hover:text-[#acf901] transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5">
          <h3 className="text-sm font-bold text-white mb-4">New API Key</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-[#acf901] text-sm focus:border-[#acf901] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                Environment
              </label>
              <select
                value={newKeyEnv}
                onChange={(e) => setNewKeyEnv(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-[#acf901] text-sm focus:border-[#acf901] focus:outline-none"
              >
                <option value="test">Test (Fuji)</option>
                <option value="live">Live (Mainnet)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                Scope
              </label>
              <select
                value={newKeyScope}
                onChange={(e) => setNewKeyScope(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-[#acf901] text-sm focus:border-[#acf901] focus:outline-none"
              >
                <option value="secret">Secret (full access)</option>
                <option value="publishable">Publishable (read-only)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-[#acf901] text-black px-4 py-2 text-sm font-semibold hover:bg-[#acf901]/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {creating && <Loader2 className="h-3 w-3 animate-spin" />}
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] animate-pulse"
            />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-[#888888]">
          <Key className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No API keys yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-lg border bg-[#0d0d0d] p-4 flex items-center justify-between ${
                k.isActive
                  ? "border-[#2a2a2a]"
                  : "border-[#2a2a2a] opacity-50"
              }`}
            >
              <div className="flex items-center gap-4">
                <Key className="h-4 w-4 text-[#acf901]/40" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {k.name}
                    </span>
                    <code className="text-xs font-mono text-[#888888] bg-[#1a1a1a] rounded px-1.5 py-0.5">
                      {k.keyPrefix}
                    </code>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        k.environment === "live"
                          ? "bg-[#acf901]/10 text-[#acf901]"
                          : "bg-[#888888]/10 text-[#888888]"
                      }`}
                    >
                      {k.environment}
                    </span>
                    <span className="text-xs text-[#444444]">{k.scope}</span>
                  </div>
                  <p className="text-xs text-[#444444] mt-1">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt &&
                      ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                    {k.revokedAt && " · Revoked"}
                  </p>
                </div>
              </div>

              {k.isActive && (
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="rounded-lg p-2 text-[#888888] hover:text-[#ff4444] hover:bg-[#ff4444]/5 transition-colors cursor-pointer"
                  title="Revoke key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
