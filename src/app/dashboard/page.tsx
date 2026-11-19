"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, QrCode, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatRupiah } from "@/lib/format";

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData);
  }, []);

  return (
    <AppShell ownerOnly>
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Ringkasan Operasional Hari Ini</h1>

        {data && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" /> Total Omzet Hari Ini
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {formatRupiah(data.today.grandTotal)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {data.today.orderCount} transaksi lunas
                </div>
              </div>

              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-indigo-600" /> Pembayaran QRIS
                </div>
                <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                  {formatRupiah(data.today.qrisTotal)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" /> Pembayaran Cash
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {formatRupiah(data.today.cashTotal)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500">Penggunaan Mesin</div>
                <div className="text-lg font-bold mt-1">
                  Washer: {data.today.washerTotal}x • Dryer: {data.today.dryerTotal}x
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-md border border-slate-200 shadow-xs">
              <h2 className="font-bold flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Peringatan Stok Sachet Menipis / Minus
              </h2>
              {data.lowStockProducts.length === 0 ? (
                <p className="text-sm text-emerald-600">Semua stok sachet aman.</p>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  {data.lowStockProducts.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-md border ${
                        p.currentStock <= 0
                          ? "bg-red-50 border-red-200 text-red-800"
                          : "bg-amber-50 border-amber-200 text-amber-800"
                      }`}
                    >
                      <div className="font-semibold text-sm">{p.name}</div>
                      <div className="text-xs">Sisa Stok: {p.currentStock} pcs</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
