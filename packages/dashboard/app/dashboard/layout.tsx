"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  Key,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [developer, setDeveloper] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api.getMe().then((data) => setDeveloper(data.developer)).catch(() => {
      router.replace("/login");
    });
  }, [router]);

  function handleLogout() {
    api.logout();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-[#2a2a2a] bg-[#0d0d0d] flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-[#2a2a2a]">
          <h1 className="text-lg font-bold text-[#acf901] tracking-wide">
            Shroud
          </h1>
          <p className="text-xs text-[#888888] mt-0.5">Developer Dashboard</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                pathname === href
                  ? "bg-[#acf901]/10 text-[#acf901] border border-[#acf901]/30"
                  : "text-[#888888] hover:text-[#acf901] hover:bg-[#acf901]/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-[#2a2a2a]">
          {developer && (
            <div className="px-3 mb-3">
              <p className="text-xs text-[#acf901] font-medium truncate">
                {(developer.email as string) || ""}
              </p>
              <p className="text-xs text-[#444444] capitalize mt-0.5">
                {(developer.plan as string) || "free"} plan
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-[#888888] hover:text-[#ff4444] hover:bg-[#ff4444]/5 transition-colors duration-200"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
