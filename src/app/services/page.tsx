"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit2,
  ImageIcon,
  MoreVertical,
  Plus,
  Power,
  Shirt,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatRupiah } from "@/lib/format";

interface Service {
  id: string;
  name: string;
  price: number;
  washerCount: number;
  dryerCount: number;
  maxWeightKg: number | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
}

async function parseJsonSafe(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formWasher, setFormWasher] = useState("1");
  const [formDryer, setFormDryer] = useState("0");
  const [formMaxWeight, setFormMaxWeight] = useState("8");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/services?all=true");
      const data = await parseJsonSafe(res);
      setServices(data.services || []);
    } catch {
      setErrorMsg("Gagal memuat daftar layanan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/services?all=true")
      .then(parseJsonSafe)
      .then((data) => {
        if (active) setServices(data.services || []);
      })
      .catch(() => {
        if (active) setErrorMsg("Gagal memuat daftar layanan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openCreateModal() {
    setEditingService(null);
    setFormName("");
    setFormPrice("");
    setFormWasher("1");
    setFormDryer("1");
    setFormMaxWeight("8");
    setFormImageUrl("");
    setFormSortOrder(String(services.length + 1));
    setFormIsActive(true);
    setUploadError("");
    setIsModalOpen(true);
    setActiveMenuId(null);
  }

  function openEditModal(s: Service) {
    setEditingService(s);
    setFormName(s.name);
    setFormPrice(String(s.price));
    setFormWasher(String(s.washerCount));
    setFormDryer(String(s.dryerCount));
    setFormMaxWeight(s.maxWeightKg !== null ? String(s.maxWeightKg) : "");
    setFormImageUrl(s.imageUrl || "");
    setFormSortOrder(String(s.sortOrder || 0));
    setFormIsActive(s.isActive);
    setUploadError("");
    setIsModalOpen(true);
    setActiveMenuId(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setUploadError("");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "services");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengupload gambar");
      setFormImageUrl(data.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Gagal mengupload gambar");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleMoveService(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= services.length) return;

    const newServices = [...services];
    const temp = newServices[index];
    newServices[index] = newServices[targetIndex];
    newServices[targetIndex] = temp;

    const updated = newServices.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1,
    }));
    setServices(updated);

    try {
      await fetch("/api/services/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: updated.map((s) => ({ id: s.id, sortOrder: s.sortOrder })),
        }),
      });
    } catch (err) {
      console.error("Gagal menyimpan urutan:", err);
      loadServices();
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const payload = {
      name: formName.trim(),
      price: Number(formPrice),
      washerCount: Number(formWasher),
      dryerCount: Number(formDryer),
      maxWeightKg: formMaxWeight ? Number(formMaxWeight) : null,
      imageUrl: formImageUrl.trim() || null,
      sortOrder: Number(formSortOrder || 0),
      isActive: formIsActive,
    };

    try {
      if (editingService) {
        const res = await fetch(`/api/services/${editingService.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui layanan");
        setSuccessMsg(`Layanan "${formName}" berhasil diperbarui.`);
      } else {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal menambahkan layanan");
        setSuccessMsg(`Layanan "${formName}" berhasil ditambahkan.`);
      }

      setIsModalOpen(false);
      await loadServices();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(s: Service) {
    setActiveMenuId(null);
    if (!confirm(`Hapus layanan "${s.name}"?`)) return;

    try {
      const res = await fetch(`/api/services/${s.id}`, { method: "DELETE" });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus layanan");
      setSuccessMsg(data.message || `Layanan "${s.name}" berhasil dihapus.`);
      await loadServices();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus layanan.");
    }
  }

  async function toggleActive(s: Service) {
    setActiveMenuId(null);
    try {
      await fetch(`/api/services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      await loadServices();
    } catch {
      setErrorMsg("Gagal mengubah status layanan.");
    }
  }

  return (
    <AppShell ownerOnly>
      <div className="space-y-5">
        {successMsg && (
          <div className="px-4 py-3 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between animate-content-swap">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" /> {successMsg}
            </span>
            <button type="button" onClick={() => setSuccessMsg("")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="px-4 py-3 rounded-sm bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center justify-between animate-content-swap">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg("")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Layanan Mesin
          </h2>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-sm text-xs font-semibold shadow-sm shadow-blue-600/20 whitespace-nowrap shrink-0 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Layanan</span>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-sm border border-slate-200/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-[11px] font-semibold text-slate-500 border-b border-slate-200/80">
                  <th className="py-3 px-4 w-20 text-center">Urutan</th>
                  <th className="py-3 px-4">Layanan</th>
                  <th className="py-3 px-4 text-right">Tarif Harga</th>
                  <th className="py-3 px-4">Konfigurasi Mesin</th>
                  <th className="py-3 px-4">Kapasitas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {loading ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td className="py-3 px-4 text-center"><div className="h-4 w-5 bg-slate-100 rounded-sm mx-auto animate-pulse" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-sm bg-slate-100 animate-pulse shrink-0" />
                          <div className="h-3.5 w-32 bg-slate-100 rounded-sm animate-pulse" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right"><div className="h-3.5 w-16 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-24 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 w-10 bg-slate-100 rounded-sm animate-pulse" /></td>
                      <td className="py-3 px-5 text-right"><div className="h-6 w-6 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                    </tr>
                  ))
                ) : services.length === 0 ? (
                  <tr className="animate-content-swap">
                    <td colSpan={7} className="py-12 px-4 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        Belum ada data layanan
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Klik &quot;Tambah Layanan&quot; di kanan atas untuk membuat paket pertama.
                      </p>
                    </td>
                  </tr>
                ) : (
                  services.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        activeMenuId === s.id ? "relative z-30" : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-xs font-mono text-slate-500 tabular-nums">
                            {idx + 1}
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveService(idx, "up")}
                              className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                              title="Pindah ke Atas"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === services.length - 1}
                              onClick={() => handleMoveService(idx, "down")}
                              className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                              title="Pindah ke Bawah"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {s.imageUrl ? (
                            <img
                              src={s.imageUrl}
                              alt={s.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-sm bg-blue-50/80 flex items-center justify-center text-blue-600 shrink-0">
                              <Shirt className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900">{s.name}</div>
                            {s.imageUrl && (
                              <span className="text-[11px] text-blue-600 flex items-center gap-1 mt-0.5">
                                <ImageIcon className="w-3 h-3" /> Foto terpasang
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(s.price)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                        Washer: <strong className="text-slate-900">{s.washerCount}</strong>
                        <span className="mx-1.5 text-slate-300">·</span>
                        Dryer: <strong className="text-slate-900">{s.dryerCount}</strong>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                        {s.maxWeightKg ? `${s.maxWeightKg} kg / mesin` : "Per lembar / khusus"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            s.isActive ? "text-emerald-600" : "text-slate-400"
                          }`}
                        >
                          {s.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className={`py-3 px-5 text-right relative ${activeMenuId === s.id ? "z-30" : ""}`}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === s.id ? null : s.id)
                          }
                          className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                          title="Opsi Layanan"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMenuId === s.id && (
                          <div
                            ref={menuRef}
                            className={`absolute right-5 w-44 bg-white rounded-sm shadow-xl border border-slate-200 py-1.5 z-50 text-left ${
                              idx >= services.length - 2 && services.length > 2
                                ? "bottom-11"
                                : "top-11"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 text-left cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit Layanan
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActive(s)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                              {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 text-left cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus Layanan
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 animate-backdrop-enter">
            <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-modal-enter">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-base text-slate-900">
                  {editingService ? "Edit Layanan" : "Tambah Layanan Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Foto / Gambar Layanan
                  </label>
                  <div className="flex items-center gap-3">
                    {formImageUrl ? (
                      <div className="relative shrink-0">
                        <img
                          src={formImageUrl}
                          alt="Preview"
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-sm object-cover border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setFormImageUrl("")}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-sm p-1 hover:bg-red-700 cursor-pointer"
                          title="Hapus Gambar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-sm border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      </div>
                    )}

                    <div className="flex-1 space-y-1.5">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-sm cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingImage ? "Mengupload..." : "Upload File Gambar"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingImage}
                          onChange={handleFileUpload}
                        />
                      </label>
                      <input
                        type="text"
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        placeholder="Atau tempel URL gambar di sini"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-sm text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>
                  </div>
                  {uploadError && (
                    <p className="text-[11px] text-red-600 font-medium mt-1.5">
                      {uploadError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Layanan <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Paket Cuci + Kering"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tarif Harga (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="500"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="20000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Urutan Tampilan
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formSortOrder}
                      onChange={(e) => setFormSortOrder(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Washer (Mesin Cuci)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formWasher}
                      onChange={(e) => setFormWasher(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dryer (Mesin Kering)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formDryer}
                      onChange={(e) => setFormDryer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kapasitas Maksimal (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formMaxWeight}
                    onChange={(e) => setFormMaxWeight(e.target.value)}
                    placeholder="Contoh: 8 (kosongkan jika item khusus)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Kosongkan jika layanan khusus (sprei/selimut per lembar).
                  </p>
                </div>

                {editingService && (
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded-sm border-slate-300 text-blue-600"
                    />
                    Status Layanan Aktif
                  </label>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-sm text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingImage}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-sm text-xs font-semibold shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Menyimpan..." : "Simpan Layanan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
