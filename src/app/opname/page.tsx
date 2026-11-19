"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, EyeOff, X } from "lucide-react";
import { AppShell, AuthUser } from "@/components/AppShell";
import { formatDateTime } from "@/lib/format";

interface OpnameItem {
  id: string;
  productId: string;
  systemStock: number;
  physicalStock: number | null;
  difference: number | null;
  notes: string | null;
  product: { name: string; category: string };
}

interface OpnameSession {
  id: string;
  opnameDate: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  notes: string | null;
  createdBy: { name: string };
  approvedBy: { name: string } | null;
  items: OpnameItem[];
}

export default function OpnamePage() {
  const [opnames, setOpnames] = useState<OpnameSession[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [blindCount, setBlindCount] = useState(true);
  const [inputs, setInputs] = useState<Record<string, { physical: string; notes: string }>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Kasir selalu dalam mode blind count, hanya owner yang bisa melihat stok sistem
  const isOwner = user?.role === "OWNER";
  // Efektif blind count: kasir = selalu true, owner = sesuai toggle
  const effectiveBlindCount = !isOwner || blindCount;

  const loadData = useCallback(async () => {
    const [opRes, meRes] = await Promise.all([
      fetch("/api/opname"),
      fetch("/api/auth/me"),
    ]);
    const opText = await opRes.text();
    const meText = await meRes.text();
    const opData = opText ? JSON.parse(opText) : {};
    const meData = meText ? JSON.parse(meText) : {};
    const list: OpnameSession[] = opData.opnames || [];
    setOpnames(list);
    setUser(meData.user || null);

    const active = list.find((o) => o.status !== "APPROVED");
    if (active) {
      const init: Record<string, { physical: string; notes: string }> = {};
      for (const item of active.items) {
        init[item.id] = {
          physical: item.physicalStock !== null ? String(item.physicalStock) : "",
          notes: item.notes || "",
        };
      }
      setInputs(init);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeOpname = opnames.find((o) => o.status !== "APPROVED");
  const pastOpnames = opnames.filter((o) => o.status === "APPROVED");

  async function handleStartOpname() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/opname", { method: "POST" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal memulai sesi opname.");
        setLoading(false);
        return;
      }
      setSuccessMsg("Sesi opname baru berhasil dimulai.");
    } catch {
      setErrorMsg("Terjadi kesalahan saat menghubungi server.");
    }
    await loadData();
    setLoading(false);
  }

  async function handleSave(submit: boolean) {
    if (!activeOpname) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    const items = activeOpname.items.map((item) => ({
      id: item.id,
      physicalStock:
        inputs[item.id]?.physical !== "" ? Number(inputs[item.id].physical) : null,
      notes: inputs[item.id]?.notes || null,
    }));

    try {
      const res = await fetch(`/api/opname/${activeOpname.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, submit }),
      });
      if (!res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        setErrorMsg(data.error || "Gagal menyimpan opname.");
      } else {
        setSuccessMsg(submit ? "Opname berhasil disubmit. Menunggu approval owner." : "Data opname berhasil disimpan.");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan saat menyimpan.");
    }
    await loadData();
    setLoading(false);
  }

  async function handleApprove() {
    if (!activeOpname) return;
    if (!confirm("Setujui opname dan sesuaikan stok sistem dengan hasil fisik?")) return;
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/opname/${activeOpname.id}/approve`, { method: "POST" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal approve opname.");
      } else {
        setSuccessMsg("Opname berhasil di-approve. Stok sistem sudah disesuaikan.");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan saat approve.");
    }
    await loadData();
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Stock Opname Sachet</h1>
            <p className="text-sm text-slate-500">
              Cocokkan stok fisik di rak dengan catatan sistem
            </p>
          </div>
          {!activeOpname && (
            <button
              onClick={handleStartOpname}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? "Memproses..." : "+ Mulai Sesi Opname Baru"}
            </button>
          )}
        </div>

        {/* Alert pesan sukses / error */}
        {successMsg && (
          <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {successMsg}
            </span>
            <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800 ml-4">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              {errorMsg}
            </span>
            <button onClick={() => setErrorMsg("")} className="text-red-500 hover:text-red-700 ml-4">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeOpname && (
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white mr-2">
                  {activeOpname.status}
                </span>
                <span className="text-sm font-semibold">
                  Sesi {formatDateTime(activeOpname.opnameDate)} • Oleh{" "}
                  {activeOpname.createdBy.name}
                </span>
              </div>
              {/* Toggle blind count hanya untuk owner */}
              {isOwner ? (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blindCount}
                    onChange={(e) => setBlindCount(e.target.checked)}
                  />
                  Sembunyikan Stok Sistem (Blind Count)
                </label>
              ) : (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5" />
                  Mode Blind Count — stok sistem disembunyikan
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Produk Sachet</th>
                    {!effectiveBlindCount && <th className="p-3">Stok Sistem</th>}
                    <th className="p-3">Stok Fisik</th>
                    {!effectiveBlindCount && <th className="p-3">Selisih</th>}
                    <th className="p-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeOpname.items.map((item) => {
                    const val = inputs[item.id]?.physical ?? "";
                    const diff = val !== "" ? Number(val) - item.systemStock : null;
                    return (
                      <tr key={item.id}>
                        <td className="p-3 font-medium">{item.product.name}</td>
                        {!effectiveBlindCount && <td className="p-3">{item.systemStock} pcs</td>}
                        <td className="p-3">
                          <input
                            type="number"
                            value={val}
                            onChange={(e) =>
                              setInputs((prev) => ({
                                ...prev,
                                [item.id]: {
                                  physical: e.target.value,
                                  notes: prev[item.id]?.notes || "",
                                },
                              }))
                            }
                            className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </td>
                        {!effectiveBlindCount && (
                          <td
                            className={`p-3 font-bold ${
                              diff === null
                                ? "text-slate-400"
                                : diff === 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {diff === null ? "-" : diff > 0 ? `+${diff}` : diff}
                          </td>
                        )}
                        <td className="p-3">
                          <input
                            type="text"
                            value={inputs[item.id]?.notes ?? ""}
                            onChange={(e) =>
                              setInputs((prev) => ({
                                ...prev,
                                [item.id]: {
                                  physical: prev[item.id]?.physical || "",
                                  notes: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Keterangan selisih (opsional)"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={loading}
                className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 transition"
              >
                Simpan Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
              >
                Submit ke Owner
              </button>
              {user?.role === "OWNER" && (
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
                >
                  Approve & Sesuaikan Stok
                </button>
              )}
            </div>
          </div>
        )}

        {/* Riwayat Opname Selesai */}
        <div className="bg-white rounded-md border border-slate-200 p-4 shadow-xs">
          <h2 className="font-bold mb-3 text-slate-900">Riwayat Stock Opname (Approved)</h2>
          {pastOpnames.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada riwayat opname.</p>
          ) : (
            <div className="space-y-3">
              {pastOpnames.map((op) => (
                <div
                  key={op.id}
                  className="p-3 rounded-md border border-slate-200 text-sm bg-slate-50/50"
                >
                  <div className="flex justify-between font-semibold mb-2">
                    <span>{formatDateTime(op.opnameDate)}</span>
                    <span className="text-emerald-600">
                      Approved by {op.approvedBy?.name}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2 text-xs text-slate-600">
                    {op.items.map((it) => (
                      <div key={it.id} className="bg-white p-2 rounded-md border border-slate-200">
                        <strong>{it.product.name}</strong>: Sistem {it.systemStock} → Fisik{" "}
                        {it.physicalStock} (Selisih:{" "}
                        <span
                          className={
                            it.difference === 0 ? "text-emerald-600" : "text-red-600 font-bold"
                          }
                        >
                          {it.difference}
                        </span>
                        )
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
