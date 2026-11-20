"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EyeOff, Plus } from "lucide-react";
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
  const [initialLoading, setInitialLoading] = useState(true);

  const isOwner = user?.role === "OWNER";
  const effectiveBlindCount = !isOwner || blindCount;

  const applyOpnameResponse = useCallback(
    (opData: { opnames?: OpnameSession[] }, meData: { user?: AuthUser | null }) => {
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
    },
    []
  );

  const loadData = useCallback(async () => {
    const [opRes, meRes] = await Promise.all([
      fetch("/api/opname"),
      fetch("/api/auth/me"),
    ]);
    const opText = await opRes.text();
    const meText = await meRes.text();
    const opData = opText ? JSON.parse(opText) : {};
    const meData = meText ? JSON.parse(meText) : {};
    applyOpnameResponse(opData, meData);
  }, [applyOpnameResponse]);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/opname"), fetch("/api/auth/me")])
      .then(async ([opRes, meRes]) => {
        if (!active) return;
        const opText = await opRes.text();
        const meText = await meRes.text();
        applyOpnameResponse(
          opText ? JSON.parse(opText) : {},
          meText ? JSON.parse(meText) : {}
        );
      })
      .finally(() => {
        if (active) setInitialLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyOpnameResponse]);

  const activeOpname = opnames.find((o) => o.status !== "APPROVED");
  const pastOpnames = opnames.filter((o) => o.status === "APPROVED");

  async function handleStartOpname() {
    setLoading(true);
    try {
      const res = await fetch("/api/opname", { method: "POST" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        toast.error(data.error || "Gagal memulai sesi opname.");
        setLoading(false);
        return;
      }
      toast.success("Sesi opname baru berhasil dimulai.");
    } catch {
      toast.error("Terjadi kesalahan saat menghubungi server.");
    }
    await loadData();
    setLoading(false);
  }

  async function handleSave(submit: boolean) {
    if (!activeOpname) return;
    setLoading(true);
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
        toast.error(data.error || "Gagal menyimpan opname.");
      } else {
        toast.success(
          submit
            ? "Opname berhasil disubmit. Menunggu approval owner."
            : "Data opname berhasil disimpan."
        );
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan.");
    }
    await loadData();
    setLoading(false);
  }

  async function handleApprove() {
    if (!activeOpname) return;
    if (!confirm("Setujui opname dan sesuaikan stok sistem dengan hasil fisik?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/opname/${activeOpname.id}/approve`, { method: "POST" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        toast.error(data.error || "Gagal approve opname.");
      } else {
        toast.success("Opname berhasil di-approve. Stok sistem sudah disesuaikan.");
      }
    } catch {
      toast.error("Terjadi kesalahan saat approve.");
    }
    await loadData();
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Stock Opname Sachet
          </h2>
          {!activeOpname && !initialLoading && (
            <button
              type="button"
              onClick={handleStartOpname}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm shadow-blue-600/20 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? "Memproses..." : "Mulai Sesi Opname"}</span>
            </button>
          )}
        </div>

        {activeOpname && (
          <div className="bg-white rounded-sm border border-slate-200/90 overflow-hidden animate-content-swap">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-blue-600">{activeOpname.status}</span>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {formatDateTime(activeOpname.opnameDate)}
                </span>
                <span className="text-slate-300">·</span>
                <span>Oleh {activeOpname.createdBy.name}</span>
              </div>

              {isOwner ? (
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blindCount}
                    onChange={(e) => setBlindCount(e.target.checked)}
                    className="rounded-sm border-slate-300 text-blue-600"
                  />
                  <span>Sembunyikan Stok Sistem (Blind Count)</span>
                </label>
              ) : (
                <span className="text-xs text-amber-700 flex items-center gap-1.5 font-medium">
                  <EyeOff className="w-3.5 h-3.5" />
                  Mode Blind Count aktif
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 text-[11px] font-semibold text-slate-500 border-b border-slate-200/80">
                    <th className="py-3 px-5">Produk Sachet</th>
                    {!effectiveBlindCount && <th className="py-3 px-4">Stok Sistem</th>}
                    <th className="py-3 px-4">Stok Fisik</th>
                    {!effectiveBlindCount && <th className="py-3 px-4">Selisih</th>}
                    <th className="py-3 px-5">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[13px]">
                  {activeOpname.items.map((item) => {
                    const val = inputs[item.id]?.physical ?? "";
                    const diff = val !== "" ? Number(val) - item.systemStock : null;
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-5 font-medium text-slate-900">{item.product.name}</td>
                        {!effectiveBlindCount && (
                          <td className="py-3 px-4 font-mono text-slate-600 tabular-nums animate-content-swap">
                            {item.systemStock} pcs
                          </td>
                        )}
                        <td className="py-3 px-4">
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
                            className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                            placeholder="0"
                          />
                        </td>
                        {!effectiveBlindCount && (
                          <td
                            key={`diff-${diff}`}
                            className={`py-3 px-4 font-mono font-semibold tabular-nums animate-content-swap ${
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
                        <td className="py-3 px-5">
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
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-sm text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                            placeholder="Keterangan selisih (opsional)"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/80 flex flex-wrap justify-end gap-2.5 bg-slate-50/40">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={loading}
                className="px-4 py-2 rounded-sm border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Simpan Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={loading}
                className="px-4 py-2 rounded-sm bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors cursor-pointer"
              >
                Submit ke Owner
              </button>
              {user?.role === "OWNER" && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-4 py-2 rounded-sm bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Approve & Sesuaikan Stok
                </button>
              )}
            </div>
          </div>
        )}

        {/* Approved History */}
        <div className="bg-white rounded-sm border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80">
            <h3 className="text-sm font-semibold text-slate-900">
              Riwayat Stock Opname (Approved)
            </h3>
          </div>

          <div className="p-5">
            {initialLoading ? (
              <div className="divide-y divide-slate-100">
                {[0, 1].map((i) => (
                  <div key={i} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                    <div className="flex justify-between">
                      <div className="h-3.5 w-32 bg-slate-100 rounded-sm animate-pulse" />
                      <div className="h-3.5 w-24 bg-slate-100 rounded-sm animate-pulse" />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-x-6 gap-y-2">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className="h-5 bg-slate-100 rounded-sm animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : pastOpnames.length === 0 ? (
              <div className="py-8 text-center animate-content-swap">
                <p className="text-sm font-medium text-slate-700">Belum ada riwayat opname</p>
                <p className="text-xs text-slate-500 mt-1">
                  Sesi stock opname yang sudah disetujui owner akan muncul di sini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 animate-content-swap">
                {pastOpnames.map((op) => (
                  <div key={op.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatDateTime(op.opnameDate)}
                      </span>
                      <span className="font-medium text-emerald-600">
                        Approved oleh {op.approvedBy?.name || "-"}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-x-6 gap-y-2 text-xs text-slate-600">
                      {op.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between py-1 border-b border-slate-100/80">
                          <span className="font-medium text-slate-800 truncate pr-2">
                            {it.product.name}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {it.systemStock} → {it.physicalStock ?? "-"}{" "}
                            <span
                              className={
                                it.difference === 0
                                  ? "text-emerald-600 font-semibold"
                                  : "text-red-600 font-semibold"
                              }
                            >
                              ({it.difference !== null && it.difference > 0 ? `+${it.difference}` : it.difference})
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
