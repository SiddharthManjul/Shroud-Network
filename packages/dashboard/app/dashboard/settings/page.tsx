"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [developer, setDeveloper] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMe()
      .then((data) => setDeveloper(data.developer))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-[#acf901] animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#acf901] mb-6">Settings</h2>

      <div className="max-w-lg space-y-6">
        {/* Account info */}
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-6">
          <h3 className="text-sm font-bold text-white mb-4">Account</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1">
                Email
              </label>
              <p className="text-sm text-[#acf901]">
                {(developer?.email as string) || "—"}
              </p>
            </div>
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1">
                Name
              </label>
              <p className="text-sm text-[#b0b0b0]">
                {(developer?.name as string) || "—"}
              </p>
            </div>
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1">
                Company
              </label>
              <p className="text-sm text-[#b0b0b0]">
                {(developer?.company as string) || "—"}
              </p>
            </div>
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1">
                Member since
              </label>
              <p className="text-sm text-[#b0b0b0]">
                {developer?.createdAt
                  ? new Date(developer.createdAt as string).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-6">
          <h3 className="text-sm font-bold text-white mb-4">Plan</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-[#acf901] capitalize">
                {(developer?.plan as string) || "free"}
              </p>
              <p className="text-xs text-[#888888] mt-1">
                {(developer?.plan as string) === "free"
                  ? "60 req/min · 10 relay/hr · 5 proofs/hr"
                  : "Custom limits"}
              </p>
            </div>
            <button
              disabled
              className="rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm text-[#888888] cursor-not-allowed"
            >
              Upgrade (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
