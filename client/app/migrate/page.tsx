"use client";

import { MigrateForm } from "@/components/migrate-form";

export default function MigratePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#acf901]">Migrate Notes</h1>
        <p className="mt-1 text-[#888888]">
          Transfer your wallet-derived shielded notes to your new email-based identity.
          Connect the wallet you previously used to access your old notes.
        </p>
      </div>
      <MigrateForm />
    </div>
  );
}
