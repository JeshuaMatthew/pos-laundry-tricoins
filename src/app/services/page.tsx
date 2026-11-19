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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Menu popup per baris
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form Fields
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
    loadServices();
  }, [loadServices]);

  // Tutup menu popup saat klik di luar
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
    setIsModalOpen(true);
    setActiveMenuId(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengupload gambar");
      setFormImageUrl(data.url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengupload gambar");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleMoveService(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= services.length) return;

    const newServices = [...services];
    const temp = newServices[index];
    newServices[index] = newServices[targetIndex];
    newServices[targetIndex] = temp;

    // Recalculate sortOrder sequentially
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
        // Update (Edit)
        const res = await fetch(`/api/services/${editingService.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui layanan");
        setSuccessMsg(`Layanan "${formName}" berhasil diperbarui.`);
      } else {
        // Create (Tambah)
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
      <div className="space-y-6">
        {/* Pesan Sukses / Error */}
        {successMsg && (
          <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" /> {successMsg}
            </span>
            <button onClick={() => setSuccessMsg("")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header & Tombol Tambah di Atas Tabel */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kelola Layanan Mesin</h1>
            <p className="text-xs text-slate-500">
              Atur daftar paket cuci, gambar, pengeringan, tarif harga, dan urutan tampilan kasir
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Tambah Layanan
          </button>
        </div>

        {/* Tabel Layanan */}
        <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-20 text-center">Urutan</th>
                  <th className="p-3">Layanan</th>
                  <th className="p-3">Tarif Harga</th>
                  <th className="p-3">Mesin (Washer / Dryer)</th>
                  <th className="p-3">Batas Berat</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 mr-1">
                          #{idx + 1}
                        </span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveService(idx, "up")}
                            className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Pindah ke Atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === services.length - 1}
                            onClick={() => handleMoveService(idx, "down")}
                            className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Pindah ke Bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {s.imageUrl ? (
                          <img
                            src={s.imageUrl}
                            alt={s.name}
                            className="w-10 h-10 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Shirt className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          {s.imageUrl && (
                            <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                              <ImageIcon className="w-2.5 h-2.5" /> Ada Gambar
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-bold text-blue-600">{formatRupiah(s.price)}</td>
                    <td className="p-3 text-xs text-slate-600">
                      Washer: <strong>{s.washerCount}</strong> • Dryer: <strong>{s.dryerCount}</strong>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {s.maxWeightKg ? `${s.maxWeightKg} kg / mesin` : "Item Khusus / Fleksibel"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold ${
                          s.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {s.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-3 text-right relative">
                      {/* Tombol ... untuk Aksi */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(activeMenuId === s.id ? null : s.id)
                        }
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                        title="Opsi Layanan"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Popup Dropdown Aksi */}
                      {activeMenuId === s.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-3 top-10 w-44 bg-white rounded-md shadow-lg border border-slate-200 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit Layanan
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(s)}
                            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left"
                          >
                            <Power className="w-3.5 h-3.5" />
                            {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="w-full px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus Layanan
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {services.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">
                      Belum ada data layanan. Klik "+ Tambah Layanan" di atas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL TAMBAH / EDIT LAYANAN */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-md max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-slate-900">
                  {editingService ? "Edit Layanan" : "Tambah Layanan Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5">
                {/* Upload Gambar Layanan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Foto / Gambar Layanan
                  </label>
                  <div className="flex items-center gap-3">
                    {formImageUrl ? (
                      <div className="relative group shrink-0">
                        <img
                          src={formImageUrl}
                          alt="Preview"
                          className="w-16 h-16 rounded-md object-cover border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setFormImageUrl("")}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-md p-1 shadow-xs hover:bg-red-700"
                          title="Hapus Gambar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-md border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      </div>
                    )}

                    <div className="flex-1 space-y-1.5">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md cursor-pointer transition">
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
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Layanan <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Paket Cuci + Kering"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tarif Harga (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="500"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="Contoh: 20000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor Urutan Tampilan
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formSortOrder}
                      onChange={(e) => setFormSortOrder(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Washer (Mesin Cuci)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formWasher}
                      onChange={(e) => setFormWasher(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Dryer (Mesin Kering)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formDryer}
                      onChange={(e) => setFormDryer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kapasitas Maksimal (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formMaxWeight}
                    onChange={(e) => setFormMaxWeight(e.target.value)}
                    placeholder="Contoh: 8 (kosongkan jika item khusus)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Kosongkan jika layanan khusus (sprei/selimut per lembar).
                  </p>
                </div>

                {editingService && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded-sm text-blue-600 focus:ring-blue-500"
                    />
                    Status Layanan Aktif
                  </label>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingImage}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-xs transition disabled:opacity-50"
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
