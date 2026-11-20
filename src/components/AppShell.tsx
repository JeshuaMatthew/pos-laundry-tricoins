"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";

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

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Ringkasan Operasional",
  "/pos": "Point of Sales",
  "/orders": "Riwayat Transaksi",
  "/opname": "Stock Opname",
  "/products": "Inventaris Sachet",
  "/services": "Layanan Mesin",
  "/users": "Manajemen Pengguna",
};

let cachedDesktopSidebarOpen: boolean | null = null;

export function AppShell({ children, ownerOnly = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState<boolean>(
    () => cachedDesktopSidebarOpen ?? true
  );

  useEffect(() => {
    if (cachedDesktopSidebarOpen !== null) return;
    const timer = setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("tricoins_sidebar_open");
        if (saved !== null) {
          const parsed = saved === "true";
          cachedDesktopSidebarOpen = parsed;
          setDesktopSidebarOpen(parsed);
        } else {
          cachedDesktopSidebarOpen = true;
        }
      } catch {
        cachedDesktopSidebarOpen = true;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function toggleDesktopSidebar() {
    setDesktopSidebarOpen((prev) => {
      const next = !prev;
      cachedDesktopSidebarOpen = next;
      try {
        window.localStorage.setItem("tricoins_sidebar_open", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        if (!text || text.trim() === "") return null;
        return JSON.parse(text);
      })
      .then((data) => {
        if (!active) return;
        if (!data?.user) {
          router.replace("/login");
          return;
        }
        if (ownerOnly && data.user.role !== "OWNER") {
          router.replace("/pos");
          return;
        }
        setUser(data.user);
        setAuthLoading(false);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [ownerOnly, router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-sm animate-spin" />
      </div>
    );
  }

  const operationalNav = [
    { href: "/pos", label: "Point of Sales", icon: ShoppingCart },
    { href: "/orders", label: "Riwayat Order", icon: History },
    { href: "/opname", label: "Stock Opname", icon: ClipboardCheck },
  ];

  const managementNav =
    user.role === "OWNER"
      ? [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/products", label: "Stok Sachet", icon: Package },
          { href: "/services", label: "Layanan Mesin", icon: Settings },
          { href: "/users", label: "Pengguna", icon: Users },
        ]
      : [];

  const pageTitle = ROUTE_TITLES[pathname] || "Workspace";

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/90">
      {/* Brand Lockup */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200/80 shrink-0">
        <Link
          href={user.role === "OWNER" ? "/dashboard" : "/pos"}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
        >
          <img
            src="/favicon.webp"
            alt="Laundry Tricoins"
            className="w-8 h-8 max-w-fit object-contain shrink-0"
          />
          <span className="font-semibold text-[15px] tracking-tight text-slate-900">
            Laundry Tricoins
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label="Tutup menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {managementNav.length > 0 && (
          <div className="space-y-1">
            <p className="px-3 text-[11px] font-semibold text-slate-400 tracking-wide mb-2">
              Manajemen
            </p>
            {managementNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13.5px] font-medium whitespace-nowrap transition-all duration-150 ${
                    active
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20"
                      : "text-slate-600 hover:bg-blue-50/70 hover:text-blue-700"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold text-slate-400 tracking-wide mb-2">
            Operasional
          </p>
          {operationalNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13.5px] font-medium whitespace-nowrap transition-all duration-150 ${
                  active
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20"
                    : "text-slate-600 hover:bg-blue-50/70 hover:text-blue-700"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Account Footer */}
      <div className="p-3 border-t border-slate-200/80 shrink-0">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-xs">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-slate-900 truncate">
                {user.name}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {user.role === "OWNER" ? "Owner" : "Kasir"} · @{user.username}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Keluar"
            className="p-2 rounded-sm text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F4F7FB] text-slate-900">
      {/* Desktop Fixed Sidebar (Collapsible) */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen z-30 overflow-hidden transition-[width,opacity] duration-200 ease-out ${
          desktopSidebarOpen
            ? "w-64 opacity-100"
            : "w-0 opacity-0 pointer-events-none"
        }`}
        aria-hidden={!desktopSidebarOpen}
      >
        <div className="w-64 h-full">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex animate-backdrop-enter">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb left — Primary Action right */}
        <header className="h-14 bg-white border-b border-slate-200/90 sticky top-0 z-20 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Buka menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={toggleDesktopSidebar}
              className="hidden lg:inline-flex p-1.5 -ml-1.5 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title={desktopSidebarOpen ? "Sembunyikan sidebar" : "Tampilkan sidebar"}
              aria-label={desktopSidebarOpen ? "Sembunyikan sidebar" : "Tampilkan sidebar"}
            >
              {desktopSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">

              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                Laundry Tricoins
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/customer-display"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 whitespace-nowrap shrink-0 transition-all"
            >
              <span>Layar Pelanggan</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-100" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          <div key={pathname} className="animate-page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
