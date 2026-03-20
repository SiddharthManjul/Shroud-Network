"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.register(email, password, name || undefined, company || undefined);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/schrodingerlabs.png"
              alt="Shroud"
              width={32}
              height={32}
              className="rounded-sm"
            />
            <span className="text-xl font-bold text-[#acf901] tracking-wide uppercase">
              Developer Portal
            </span>
          </Link>
          <p className="text-sm text-[#888888] mt-2">
            Create your developer account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/5 px-4 py-3">
              <p className="text-sm text-[#ff4444]">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-[#acf901] placeholder-[#444444] focus:border-[#acf901] focus:outline-none transition-colors"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-[#acf901] placeholder-[#444444] focus:border-[#acf901] focus:outline-none transition-colors"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
              Name <span className="text-[#444444]">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-[#acf901] placeholder-[#444444] focus:border-[#acf901] focus:outline-none transition-colors"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs text-[#888888] uppercase tracking-wider mb-1.5">
              Company <span className="text-[#444444]">(optional)</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-2.5 text-sm text-[#acf901] placeholder-[#444444] focus:border-[#acf901] focus:outline-none transition-colors"
              placeholder="Your company"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#acf901] text-black px-4 py-2.5 text-sm font-semibold hover:bg-[#acf901]/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <p className="text-center text-sm text-[#888888] mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#acf901] hover:underline"
          >
            Sign in
          </Link>
        </p>

        <p className="text-center mt-4">
          <Link
            href="/"
            className="text-xs text-[#444444] hover:text-[#888888] transition-colors"
          >
            Back to Developer Portal
          </Link>
        </p>
      </div>
    </div>
  );
}
