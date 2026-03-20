"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Activity, Zap, AlertTriangle, Clock } from "lucide-react";

interface UsageStats {
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  relayTransactions: number;
  period: string;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getUsage()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: "Total Requests",
      value: stats?.totalRequests.toLocaleString() || "0",
      icon: Activity,
    },
    {
      label: "Relay Transactions",
      value: stats?.relayTransactions.toLocaleString() || "0",
      icon: Zap,
    },
    {
      label: "Error Rate",
      value: stats
        ? stats.totalRequests > 0
          ? `${((stats.totalErrors / stats.totalRequests) * 100).toFixed(1)}%`
          : "0%"
        : "0%",
      icon: AlertTriangle,
    },
    {
      label: "Avg Latency",
      value: stats ? `${stats.avgLatencyMs}ms` : "0ms",
      icon: Clock,
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#acf901] mb-6">Overview</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[#888888] uppercase tracking-wider">
                {label}
              </span>
              <Icon className="h-4 w-4 text-[#acf901]/40" />
            </div>
            <p className="text-2xl font-bold text-[#acf901]">
              {loading ? (
                <span className="inline-block w-16 h-7 bg-[#1a1a1a] rounded animate-pulse" />
              ) : (
                value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Period note */}
      <p className="text-xs text-[#444444]">
        Showing data for the last {stats?.period || "30d"}
      </p>
    </div>
  );
}
