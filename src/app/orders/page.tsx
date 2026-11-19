"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { AppShell, AuthUser } from "@/components/AppShell";
import { formatDateTime, formatRupiah } from "@/lib/format";

interface OrderRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  weightKg: number | null;
  totalWasher: number;
  totalDryer: number;
  totalAmount: number;
  paymentMethod: "CASH" | "QRIS";
  paymentStatus: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "VOID";
  createdAt: string;
  services: { id: string; serviceName: string; qty: number }[];
  products: { id: string; productName: string; qty: number }[];
}

type StatusFilter = "ALL" | "PAID" | "PENDING" | "OTHER";

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, meRes] = await Promise.all([
        fetch("/api/orders?limit=100"),
        fetch("/api/auth/me"),
      ]);
      if (ordRes.ok) {
        const text = await ordRes.text();
        const ordData = text ? JSON.parse(text) : {};
        setOrders(ordData.orders || []);
      }
      if (meRes.ok) {
        const text = await meRes.text();
        const meData = text ? JSON.parse(text) : {};
        setUser(meData.user || null);
      }
    } catch (err) {
      console.error("Gagal memuat order:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/orders?limit=100"), fetch("/api/auth/me")])
      .then(async ([ordRes, meRes]) => {
        if (!active) return;
        if (ordRes.ok) {
          const text = await ordRes.text();
          const ordData = text ? JSON.parse(text) : {};
          setOrders(ordData.orders || []);
        }
        if (meRes.ok) {
          const text = await meRes.text();
          const meData = text ? JSON.parse(text) : {};
          setUser(meData.user || null);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat order:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === "PAID" && o.paymentStatus !== "PAID") return false;
      if (statusFilter === "PENDING" && o.paymentStatus !== "PENDING") return false;
      if (
        statusFilter === "OTHER" &&
        (o.paymentStatus === "PAID" || o.paymentStatus === "PENDING")
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.invoiceNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  async function handleCheckStatus(id: string) {
    await fetch(`/api/orders/${id}/check-status`);
    loadOrders();
  }

  async function handleVoid(id: string, invoice: string) {
    if (!confirm(`Void transaksi ${invoice}? Stok sachet akan dikembalikan.`)) return;
    const res = await fetch(`/api/orders/${id}/void`, { method: "POST" });
    if (!res.ok) {
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      alert(data.error || "Gagal void");
    }
    loadOrders();
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Riwayat Transaksi
          </h2>
          <button
            type="button"
            onClick={loadOrders}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-sm border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Muat Ulang</span>
          </button>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-sm border border-slate-200/90 overflow-hidden">
          {/* Toolbar: Search + Segmented Filter */}
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari invoice atau pelanggan..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-sm text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-sm border border-slate-200/70">
              {(
                [
                  { id: "ALL", label: "Semua" },
                  { id: "PAID", label: "Lunas" },
                  { id: "PENDING", label: "Pending" },
                  { id: "OTHER", label: "Void / Batal" },
                ] as { id: StatusFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm whitespace-nowrap transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-blue-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Invoice & Waktu</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Layanan & Sachet</th>
                  <th className="py-3 px-4">Mesin</th>
                  <th className="py-3 px-4">Metode & Status</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody
                key={statusFilter}
                className="divide-y divide-slate-100 text-[13px]"
              >
                {loading ? (
                  [0, 1, 2, 3, 4].map((idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-5">
                        <div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" />
                        <div className="h-2.5 w-20 bg-slate-100 rounded-sm mt-1.5 animate-pulse" />
                      </td>
                      <td className="py-3 px-4"><div className="h-3.5 w-24 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-32 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-14 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-20 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4 text-right"><div className="h-3.5 w-16 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                      <td className="py-3 px-5 text-right"><div className="h-6 w-14 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr className="animate-content-swap">
                    <td colSpan={7} className="py-12 px-5 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        Tidak ada transaksi yang sesuai
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Coba ubah filter status atau kata kunci pencarian.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-blue-50/40 transition-colors animate-content-swap">
                      <td className="py-3 px-5">
                        <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {o.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                          {formatDateTime(o.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{o.customerName}</div>
                        {o.weightKg && (
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {o.weightKg} kg
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs space-y-0.5 text-slate-700">
                        {o.services.map((s) => (
                          <div key={s.id}>
                            {s.serviceName} × {s.qty}
                          </div>
                        ))}
                        {o.products.map((p) => (
                          <div key={p.id} className="text-blue-700">
                            + {p.productName} × {p.qty}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-mono tabular-nums">
                        W:{o.totalWasher} · D:{o.totalDryer}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-700">{o.paymentMethod}</span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`font-semibold ${
                              o.paymentStatus === "PAID"
                                ? "text-emerald-600"
                                : o.paymentStatus === "PENDING"
                                ? "text-amber-600"
                                : "text-slate-500"
                            }`}
                          >
                            {o.paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(o.totalAmount)}
                      </td>
                      <td className="py-3 px-5 text-right space-x-2">
                        {o.paymentStatus === "PENDING" && o.paymentMethod === "QRIS" && (
                          <button
                            type="button"
                            onClick={() => handleCheckStatus(o.id)}
                            className="text-xs px-2.5 py-1.5 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 shadow-xs transition-all cursor-pointer"
                          >
                            Cek Status
                          </button>
                        )}
                        {o.paymentStatus === "PAID" && user?.role === "OWNER" && (
                          <button
                            type="button"
                            onClick={() => handleVoid(o.id, o.invoiceNumber)}
                            className="text-xs px-2.5 py-1.5 rounded-sm border border-red-200 bg-white text-red-600 font-medium hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
