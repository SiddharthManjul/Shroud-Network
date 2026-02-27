import { TransferForm } from "@/components/transfer-form";

export default function TransferPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Private Transfer</h1>
        <p className="mt-1 text-zinc-400">
          Send tokens privately within the shielded pool. Amounts, senders, and
          receivers are hidden behind ZK proofs.
        </p>
      </div>
      <div className="max-w-md">
        <TransferForm />
      </div>
    </div>
  );
}
