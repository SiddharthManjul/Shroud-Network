import { FaucetForm } from "@/components/faucet-form";

export default function FaucetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Faucet</h1>
        <p className="mt-1 text-zinc-400">
          Claim free SRD test tokens for the shielded pool
        </p>
      </div>
      <div className="max-w-md">
        <FaucetForm />
      </div>
    </div>
  );
}
