"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#acf901]">Shroud Dashboard</h1>
          <p className="text-[#888888] mt-2">Sign in to manage your API keys</p>
        </div>

        <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors text-sm"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 text-[#acf901] placeholder:text-[#444444] focus:border-[#acf901] focus:outline-none transition-colors text-sm"
                placeholder="Your password"
              />
            </div>

            {error && <p className="text-sm text-[#ff4444]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-[#acf901] text-black font-semibold text-sm hover:bg-[#acf901]/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#888888]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#acf901] hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
