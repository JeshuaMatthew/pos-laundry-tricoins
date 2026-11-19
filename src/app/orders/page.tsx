"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadOrders = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
      <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h1 className="font-bold text-lg">Riwayat Transaksi</h1>
          <button
            onClick={loadOrders}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="p-3">Invoice / Waktu</th>
                <th className="p-3">Pelanggan</th>
                <th className="p-3">Layanan & Sachet</th>
                <th className="p-3">Mesin</th>
                <th className="p-3">Metode & Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-semibold">{o.invoiceNumber}</div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(o.createdAt)}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>{o.customerName}</div>
                    {o.weightKg && (
                      <div className="text-xs text-slate-500">{o.weightKg} kg</div>
                    )}
                  </td>
                  <td className="p-3 text-xs space-y-0.5">
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
                  <td className="p-3 text-xs">
                    W:{o.totalWasher} / D:{o.totalDryer}
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-bold mr-1.5">{o.paymentMethod}</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        o.paymentStatus === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : o.paymentStatus === "PENDING"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold">
                    {formatRupiah(o.totalAmount)}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {o.paymentStatus === "PENDING" && o.paymentMethod === "QRIS" && (
                      <button
                        onClick={() => handleCheckStatus(o.id)}
                        className="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition"
                      >
                        Cek Status
                      </button>
                    )}
                    {o.paymentStatus === "PAID" && user?.role === "OWNER" && (
                      <button
                        onClick={() => handleVoid(o.id, o.invoiceNumber)}
                        className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 font-medium hover:bg-red-100 transition"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
