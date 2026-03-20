"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface HourlyData {
  hour: string;
  endpoint: string;
  requestCount: number;
  errorCount: number;
  totalLatencyMs: number;
}

interface DailyAggregate {
  date: string;
  requests: number;
  errors: number;
}

export default function UsagePage() {
  const [history, setHistory] = useState<HourlyData[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getUsageHistory(days)
      .then((data) => setHistory(data.history))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  // Aggregate by day
  const dailyMap = new Map<string, DailyAggregate>();
  for (const h of history) {
    const date = new Date(h.hour).toLocaleDateString();
    const existing = dailyMap.get(date) || { date, requests: 0, errors: 0 };
    existing.requests += h.requestCount;
    existing.errors += h.errorCount;
    dailyMap.set(date, existing);
  }
  const daily = Array.from(dailyMap.values()).reverse();

  // Aggregate by endpoint
  const endpointMap = new Map<string, number>();
  for (const h of history) {
    endpointMap.set(h.endpoint, (endpointMap.get(h.endpoint) || 0) + h.requestCount);
  }
  const topEndpoints = Array.from(endpointMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const maxRequests = Math.max(...daily.map((d) => d.requests), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#acf901]">Usage Analytics</h2>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                days === d
                  ? "bg-[#acf901]/10 text-[#acf901] border border-[#acf901]/30"
                  : "text-[#888888] border border-[#2a2a2a] hover:text-[#acf901]"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] animate-pulse" />
      ) : (
        <>
          {/* Bar chart (CSS-only) */}
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-6 mb-6">
            <h3 className="text-sm font-bold text-white mb-4">
              Daily Requests
            </h3>
            {daily.length === 0 ? (
              <p className="text-sm text-[#888888] py-8 text-center">
                No usage data yet
              </p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {daily.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-xs text-[#888888]">
                      {d.requests}
                    </span>
                    <div
                      className="w-full bg-[#acf901]/20 rounded-t relative group"
                      style={{
                        height: `${(d.requests / maxRequests) * 100}%`,
                        minHeight: d.requests > 0 ? "4px" : "0px",
                      }}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-[#acf901] rounded-t"
                        style={{
                          height: `${
                            d.errors > 0
                              ? 100 - (d.errors / d.requests) * 100
                              : 100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-[#444444] truncate w-full text-center">
                      {d.date.split("/").slice(0, 2).join("/")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top endpoints */}
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-6">
            <h3 className="text-sm font-bold text-white mb-4">
              Top Endpoints
            </h3>
            {topEndpoints.length === 0 ? (
              <p className="text-sm text-[#888888] py-4 text-center">
                No data
              </p>
            ) : (
              <div className="space-y-2">
                {topEndpoints.map(([endpoint, count]) => (
                  <div
                    key={endpoint}
                    className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0"
                  >
                    <code className="text-xs font-mono text-[#b0b0b0]">
                      {endpoint}
                    </code>
                    <span className="text-xs font-mono text-[#acf901]">
                      {count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
