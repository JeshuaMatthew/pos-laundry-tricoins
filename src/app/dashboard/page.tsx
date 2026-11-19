"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Cpu,
  Package,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatDateTime, formatRupiah } from "@/lib/format";

interface DashboardData {
  today: {
    orderCount: number;
    cashTotal: number;
    qrisTotal: number;
    grandTotal: number;
    washerTotal: number;
    dryerTotal: number;
  };
  lowStockProducts: {
    id: string;
    name: string;
    currentStock: number;
    minStockAlert: number;
  }[];
}

interface RecentOrder {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalWasher: number;
  totalDryer: number;
  totalAmount: number;
  paymentMethod: "CASH" | "QRIS";
  paymentStatus: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "VOID";
  createdAt: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/orders?limit=8").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([dashJson, ordersJson]) => {
        if (dashJson) setData(dashJson);
        if (ordersJson?.orders) setRecentOrders(ordersJson.orders);
      })
      .finally(() => setLoading(false));
  }, []);

  const grandTotal = data?.today.grandTotal || 0;
  const qrisShare = grandTotal > 0 ? Math.round(((data?.today.qrisTotal || 0) / grandTotal) * 100) : 0;
  const cashShare = grandTotal > 0 ? Math.round(((data?.today.cashTotal || 0) / grandTotal) * 100) : 0;
  const totalMachines = (data?.today.washerTotal || 0) + (data?.today.dryerTotal || 0);

  return (
    <AppShell ownerOnly>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Ringkasan Hari Ini
          </h2>
          <Link
            href="/pos"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium shadow-sm shadow-blue-600/20 whitespace-nowrap shrink-0 transition-all"
          >
            <span>Buka Kasir POS</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 4-Column KPI Strip */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white p-5 rounded-sm border border-slate-200/90 min-h-[116px] flex flex-col justify-between gap-3"
              >
                <div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" />
                <div className="space-y-2">
                  <div className="h-7 w-36 bg-slate-100 rounded-sm animate-pulse" />
                  <div className="h-2 w-full bg-slate-100 rounded-sm animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-content-swap">
            {/* KPI 1: Total Omzet */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-5 rounded-sm border border-blue-500/30 shadow-md shadow-blue-600/15 text-white min-h-[116px] flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-blue-100">
                <span>Total Omzet Hari Ini</span>
                <ShoppingBag className="w-4 h-4 text-blue-100" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-white tabular-nums">
                  {formatRupiah(data?.today.grandTotal || 0)}
                </div>
                <div className="text-xs text-blue-100/90 mt-1 tabular-nums">
                  {data?.today.orderCount || 0} transaksi lunas
                </div>
              </div>
            </div>

            {/* KPI 2: QRIS */}
            <div className="bg-white p-5 rounded-sm border border-slate-200/90 min-h-[116px] flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Pembayaran QRIS</span>
                <QrCode className="w-4 h-4 text-blue-600" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                    {formatRupiah(data?.today.qrisTotal || 0)}
                  </span>
                  <span className="text-xs font-mono text-blue-600 tabular-nums">
                    {qrisShare}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-blue-50 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-sky-400 rounded-sm transition-all duration-300"
                    style={{ width: `${qrisShare}%` }}
                  />
                </div>
              </div>
            </div>

            {/* KPI 3: Cash */}
            <div className="bg-white p-5 rounded-sm border border-slate-200/90 min-h-[116px] flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Pembayaran Tunai</span>
                <Banknote className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                    {formatRupiah(data?.today.cashTotal || 0)}
                  </span>
                  <span className="text-xs font-mono text-emerald-600 tabular-nums">
                    {cashShare}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-sm transition-all duration-300"
                    style={{ width: `${cashShare}%` }}
                  />
                </div>
              </div>
            </div>

            {/* KPI 4: Penggunaan Mesin */}
            <div className="bg-white p-5 rounded-sm border border-slate-200/90 min-h-[116px] flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Siklus Mesin</span>
                <Cpu className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {totalMachines} Siklus
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 tabular-nums">
                  <span>Washer: <strong className="text-slate-800">{data?.today.washerTotal || 0}x</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Dryer: <strong className="text-slate-800">{data?.today.dryerTotal || 0}x</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Analytical & Operational Grid */}
        <div className="grid lg:grid-cols-3 gap-5 items-start">
          {/* Recent Orders Table */}
          <div className="lg:col-span-2 bg-white rounded-sm border border-slate-200/90 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Transaksi Terbaru</h3>
              <Link
                href="/orders"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                Lihat Semua
              </Link>
            </div>

            {!loading && recentOrders.length === 0 ? (
              <div className="p-10 text-center space-y-3 animate-content-swap">
                <p className="text-sm font-medium text-slate-700">Belum ada transaksi tercatat</p>
                <p className="text-xs text-slate-500">
                  Pesanan yang diproses kasir melalui Point of Sales akan langsung muncul di sini.
                </p>
                <Link
                  href="/pos"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  Buat Transaksi Pertama
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-5">Invoice</th>
                      <th className="py-2.5 px-4">Pelanggan</th>
                      <th className="py-2.5 px-4">Mesin</th>
                      <th className="py-2.5 px-4">Metode</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-5 text-right">Total</th>
                    </tr>
                  </thead>
                  {loading ? (
                    <tbody className="divide-y divide-slate-100">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <tr key={i}>
                          <td className="py-3 px-5">
                            <div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" />
                            <div className="h-2.5 w-20 bg-slate-100 rounded-sm mt-1.5 animate-pulse" />
                          </td>
                          <td className="py-3 px-4"><div className="h-3.5 w-24 bg-slate-100 rounded-sm animate-pulse" /></td>
                          <td className="py-3 px-4"><div className="h-3.5 w-12 bg-slate-100 rounded-sm animate-pulse" /></td>
                          <td className="py-3 px-4"><div className="h-3.5 w-10 bg-slate-100 rounded-sm animate-pulse" /></td>
                          <td className="py-3 px-4"><div className="h-3.5 w-12 bg-slate-100 rounded-sm animate-pulse" /></td>
                          <td className="py-3 px-5 text-right"><div className="h-3.5 w-16 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                        </tr>
                      ))}
                    </tbody>
                  ) : (
                    <tbody className="divide-y divide-slate-100 text-[13px] animate-content-swap">
                      {recentOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3 px-5">
                            <div className="font-mono font-medium text-slate-900 text-xs tabular-nums">
                              {o.invoiceNumber}
                            </div>
                            <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                              {formatDateTime(o.createdAt)}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {o.customerName}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                            {o.totalWasher}W · {o.totalDryer}D
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-slate-700">
                            {o.paymentMethod}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-xs font-semibold ${
                                o.paymentStatus === "PAID"
                                  ? "text-emerald-600"
                                  : o.paymentStatus === "PENDING"
                                  ? "text-amber-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {formatRupiah(o.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Low Stock Monitor Panel */}
          <div className="bg-white rounded-sm border border-slate-200/90 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Stok Sachet Menipis</h3>
              <Link
                href="/products"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                Kelola
              </Link>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="divide-y divide-slate-100">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-slate-100 animate-pulse shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" />
                          <div className="h-3 w-16 bg-slate-100 rounded-sm animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-1.5 text-right">
                        <div className="h-3.5 w-12 bg-slate-100 rounded-sm ml-auto animate-pulse" />
                        <div className="h-3 w-10 bg-slate-100 rounded-sm ml-auto animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !data || data.lowStockProducts.length === 0 ? (
                <div className="py-8 text-center space-y-2 animate-content-swap">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto stroke-[1.5]" />
                  <p className="text-sm font-medium text-slate-900">Semua stok sachet aman</p>
                  <p className="text-xs text-slate-500">
                    Tidak ada item di bawah ambang minimum stok.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 animate-content-swap">
                  {data.lowStockProducts.map((p) => {
                    const isOut = p.currentStock <= 0;
                    return (
                      <div key={p.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${
                              isOut
                                ? "bg-red-50 text-red-600"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {isOut ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <Package className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums">
                              Min. {p.minStockAlert} pcs
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-sm font-mono font-semibold tabular-nums ${
                              isOut ? "text-red-600" : "text-amber-600"
                            }`}
                          >
                            {p.currentStock} pcs
                          </div>
                          <div className="text-[11px] font-medium text-slate-500">
                            {isOut ? "Stok Habis" : "Menipis"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
