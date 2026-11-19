"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Coins,
  DollarSign,
  HandCoins,
  HandFistIcon,
  History,
  LayoutDashboard,
  LogOut,
  Monitor,
  Package,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { HandCoinsIcon } from "lucide-react/dist/lucide-react.suffixed.js";

export interface AuthUser {
  userId: string;
  name: string;
  username: string;
  role: "OWNER" | "CASHIER";
}

interface AppShellProps {
  children: React.ReactNode;
  ownerOnly?: boolean;
}

export function AppShell({ children, ownerOnly = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("Unauthorized");
        const text = await res.text();
        if (!text || text.trim() === "") throw new Error("Empty response");
        return JSON.parse(text);
      })
      .then((data) => {
        if (!data?.user) {
          router.replace("/login");
          return;
        }
        if (ownerOnly && data.user.role !== "OWNER") {
          router.replace("/pos");
          return;
        }
        setUser(data.user);
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [ownerOnly, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Memuat aplikasi...
      </div>
    );
  }

  const navItems = [
    { href: "/pos", label: "Point of Sales", icon: ShoppingCart, ownerOnly: false },
    { href: "/orders", label: "Riwayat Order", icon: History, ownerOnly: false },
    { href: "/opname", label: "Stock Opname", icon: ClipboardCheck, ownerOnly: false },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
    { href: "/products", label: "Stok Sachet", icon: Package, ownerOnly: true },
    { href: "/services", label: "Layanan", icon: Settings, ownerOnly: true },
  ].filter((item) => !item.ownerOnly || user.role === "OWNER");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white shadow-2xs border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 overflow-x-auto">
            <span className="font-bold text-blue-600 whitespace-nowrap">
            Laundry Tricoins
            </span>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition ${
                      active
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>

            <Link
              href="/customer-display"
              target="_blank"
              title="Layar Pelanggan"
              className="hidden sm:flex px-2.5 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 transition"
            >
              <Coins size={20}/>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">{children}</main>
    </div>
  );
}
