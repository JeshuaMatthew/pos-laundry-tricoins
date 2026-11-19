"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Droplets,
  Edit2,
  ImageIcon,
  MoreVertical,
  Package,
  Plus,
  Power,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatDateTime, formatRupiah } from "@/lib/format";

interface Product {
  id: string;
  name: string;
  category: "DETERGENT" | "SOFTENER" | "PERFUME";
  price: number;
  currentStock: number;
  minStockAlert: number;
  packName: string | null;
  packQty: number | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface Movement {
  id: string;
  type: string;
  qtyChange: number;
  stockBefore: number;
  stockAfter: number;
  notes: string | null;
  createdAt: string;
  createdBy: { name: string };
}

const CATEGORY_NAMES: Record<Product["category"], string> = {
  DETERGENT: "Deterjen",
  SOFTENER: "Pengharum",
  PERFUME: "Parfum",
};

async function parseJsonSafe(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Menu popup per baris
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields Modal
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<Product["category"]>("DETERGENT");
  const [formPrice, setFormPrice] = useState("1000");
  const [formInitialStock, setFormInitialStock] = useState("24");
  const [formMinStock, setFormMinStock] = useState("10");
  const [formPackName, setFormPackName] = useState("Renceng");
  const [formPackQty, setFormPackQty] = useState("12");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form Penyesuaian Stok (Sidebar Kanan)
  const [stockAction, setStockAction] = useState<"RESTOCK" | "DAMAGED">("RESTOCK");
  const [stockQty, setStockQty] = useState("");
  const [usePack, setUsePack] = useState(true);
  const [stockNotes, setStockNotes] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/products?all=true");
      const data = await parseJsonSafe(res);
      setProducts(data.products || []);
    } catch {
      setErrorMsg("Gagal memuat produk.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Tutup popup menu saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function openHistory(product: Product) {
    setSelected(product);
    try {
      const res = await fetch(`/api/products/${product.id}/stock`);
      const data = await parseJsonSafe(res);
      setMovements(data.movements || []);
    } catch {
      console.error("Gagal memuat riwayat stok");
    }
  }

  function openCreateModal() {
    setEditingProduct(null);
    setFormName("");
    setFormCategory("DETERGENT");
    setFormPrice("1000");
    setFormInitialStock("24");
    setFormMinStock("10");
    setFormPackName("Renceng");
    setFormPackQty("12");
    setFormImageUrl("");
    setFormSortOrder(String(products.length + 1));
    setFormIsActive(true);
    setIsModalOpen(true);
    setActiveMenuId(null);
  }

  function openEditModal(p: Product) {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormPrice(String(p.price));
    setFormMinStock(String(p.minStockAlert));
    setFormPackName(p.packName || "Renceng");
    setFormPackQty(p.packQty ? String(p.packQty) : "12");
    setFormImageUrl(p.imageUrl || "");
    setFormSortOrder(String(p.sortOrder || 0));
    setFormIsActive(p.isActive);
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

  async function handleMoveProduct(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const newProducts = [...products];
    const temp = newProducts[index];
    newProducts[index] = newProducts[targetIndex];
    newProducts[targetIndex] = temp;

    const updated = newProducts.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1,
    }));
    setProducts(updated);

    try {
      await fetch("/api/products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: updated.map((p) => ({ id: p.id, sortOrder: p.sortOrder })),
        }),
      });
    } catch (err) {
      console.error("Gagal menyimpan urutan sachet:", err);
      loadProducts();
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (editingProduct) {
        // Edit produk
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
            price: Number(formPrice),
            minStockAlert: Number(formMinStock),
            packName: formPackName.trim() || null,
            packQty: formPackQty ? Number(formPackQty) : null,
            imageUrl: formImageUrl.trim() || null,
            sortOrder: Number(formSortOrder || 0),
            isActive: formIsActive,
          }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui sachet");
        setSuccessMsg(`Sachet "${formName}" berhasil diperbarui.`);
      } else {
        // Tambah produk baru
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
            price: Number(formPrice),
            currentStock: Number(formInitialStock || 0),
            minStockAlert: Number(formMinStock || 10),
            packName: formPackName.trim() || null,
            packQty: formPackQty ? Number(formPackQty) : null,
            imageUrl: formImageUrl.trim() || null,
            sortOrder: Number(formSortOrder || 0),
          }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) throw new Error(data.error || "Gagal membuat sachet");
        setSuccessMsg(`Sachet "${formName}" berhasil ditambahkan.`);
      }

      setIsModalOpen(false);
      await loadProducts();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProduct(p: Product) {
    setActiveMenuId(null);
    if (!confirm(`Hapus sachet "${p.name}"?`)) return;

    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus sachet");
      setSuccessMsg(data.message || `Sachet "${p.name}" berhasil dihapus.`);
      if (selected?.id === p.id) setSelected(null);
      await loadProducts();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus sachet.");
    }
  }

  async function toggleActiveProduct(p: Product) {
    setActiveMenuId(null);
    try {
      await fetch(`/api/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      await loadProducts();
    } catch {
      setErrorMsg("Gagal mengubah status produk.");
    }
  }

  async function handleStockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    try {
      const res = await fetch(`/api/products/${selected.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: stockAction,
          qty: Number(stockQty),
          usePack: stockAction === "RESTOCK" && usePack,
          notes: stockNotes,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || "Gagal memproses stok");

      setStockQty("");
      setStockNotes("");
      setSuccessMsg(`Stok ${selected.name} berhasil diperbarui.`);
      await loadProducts();
      await openHistory(selected);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengubah stok.");
    }
  }

  return (
    <AppShell ownerOnly>
      <div className="space-y-6">
        {/* Pesan Alert */}
        {successMsg && (
          <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" /> {successMsg}
            </span>
            <button onClick={() => setSuccessMsg("")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Tabel Sachet */}
          <div className="lg:col-span-2 space-y-4">
            {/* Header & Tombol Tambah di Atas Tabel */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-md border border-slate-200 shadow-xs">
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Stok Sachet & Add-On
                </h1>
                <p className="text-xs text-slate-500">
                  Kelola master deterjen, foto produk, pengharum, parfum, dan urutan kartu kasir
                </p>
              </div>

              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Tambah Sachet
              </button>
            </div>

            <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 w-24 text-center">Urutan</th>
                      <th className="p-3.5">Produk Sachet</th>
                      <th className="p-3.5">Kategori</th>
                      <th className="p-3.5">Harga</th>
                      <th className="p-3.5">Sisa Stok</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p, idx) => {
                      const isLow = p.currentStock <= p.minStockAlert;
                      const isSelected = selected?.id === p.id;

                      return (
                        <tr
                          key={p.id}
                          className={`transition ${
                            isSelected
                              ? "bg-blue-50/70"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 mr-1">
                                #{idx + 1}
                              </span>
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveProduct(idx, "up")}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                  title="Pindah ke Atas"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === products.length - 1}
                                  onClick={() => handleMoveProduct(idx, "down")}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                  title="Pindah ke Bawah"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-10 h-10 rounded-md object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 text-sm">
                                  {p.category === "DETERGENT" ? (
                                    <Droplets className="w-5 h-5 text-blue-600" />
                                  ) : p.category === "SOFTENER" ? (
                                    <Sparkles className="w-5 h-5 text-pink-500" />
                                  ) : (
                                    <Package className="w-5 h-5 text-purple-600" />
                                  )}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-slate-900">{p.name}</div>
                                {p.packQty && (
                                  <div className="text-[11px] text-slate-400">
                                    1 {p.packName || "Pack"} = {p.packQty} pcs
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {CATEGORY_NAMES[p.category]}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-slate-800">
                            {formatRupiah(p.price)}
                          </td>
                          <td className="p-3.5">
                            <div
                              className={`font-black text-sm ${
                                p.currentStock <= 0
                                  ? "text-red-600"
                                  : isLow
                                  ? "text-amber-600"
                                  : "text-slate-900"
                              }`}
                            >
                              {p.currentStock} pcs
                            </div>
                            {isLow && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Menipis
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                                p.isActive
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {p.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="p-3.5 text-right relative">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openHistory(p)}
                                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                                  isSelected
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                }`}
                                title="Lihat Kartu Stok & Restock"
                              >
                                Stok
                              </button>

                              {/* Tombol ... untuk Menu Aksi */}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMenuId(activeMenuId === p.id ? null : p.id)
                                }
                                className="p-1 rounded-md hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                                title="Opsi Sachet"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Dropdown Menu Aksi */}
                            {activeMenuId === p.id && (
                              <div
                                ref={menuRef}
                                className="absolute right-3 top-10 w-44 bg-white rounded-md shadow-xl border border-slate-200 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    openEditModal(p);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 text-left"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  Edit Sachet
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleActiveProduct(p)}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left"
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                                <div className="h-px bg-slate-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p)}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Hapus Sachet
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {products.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">
                          Belum ada produk sachet. Klik "+ Tambah Sachet" di atas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Panel Penyesuaian Stok & History */}
          <div className="bg-white p-5 rounded-md border border-slate-200 shadow-xs space-y-4 h-fit">
            {!selected ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <p className="text-sm font-medium text-slate-600">Pilih Produk di Tabel</p>
                <p className="text-xs">
                  Klik tombol <strong>"Stok"</strong> pada baris tabel untuk menambah restock masuk, mencatat barang rusak, atau melihat kartu mutasi stok.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <h2 className="font-bold text-sm text-slate-900">{selected.name}</h2>
                    <span className="text-xs text-slate-500">
                      Sisa Stok: <strong className="text-blue-600">{selected.currentStock} pcs</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleStockSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStockAction("RESTOCK")}
                      className={`py-2 rounded-md text-xs font-bold border transition ${
                        stockAction === "RESTOCK"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      + Restock Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockAction("DAMAGED")}
                      className={`py-2 rounded-md text-xs font-bold border transition ${
                        stockAction === "DAMAGED"
                          ? "bg-red-600 text-white border-red-600 shadow-xs"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      - Rusak / Bocor
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Jumlah {stockAction === "RESTOCK" ? "Masuk" : "Rusak"}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                      placeholder="Contoh: 2"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {stockAction === "RESTOCK" && selected.packQty && (
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-slate-50 p-2.5 rounded-md border border-slate-200">
                      <input
                        type="checkbox"
                        checked={usePack}
                        onChange={(e) => setUsePack(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>
                        Hitung per <strong>{selected.packName || "Pack"}</strong> ({selected.packQty} pcs / pack)
                      </span>
                    </label>
                  )}

                  {/* Preview perubahan stok */}
                  {stockQty && Number(stockQty) > 0 && (() => {
                    const inputNum = Number(stockQty);
                    const pcsChange = stockAction === "RESTOCK" && usePack && selected.packQty
                      ? inputNum * selected.packQty
                      : inputNum;
                    const qtyChange = stockAction === "RESTOCK" ? pcsChange : -pcsChange;
                    const newStock = selected.currentStock + qtyChange;
                    const isRestock = stockAction === "RESTOCK";
                    return (
                      <div className={`rounded-md px-3 py-2.5 text-xs border flex items-center justify-between gap-2 ${
                        isRestock
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-red-50 border-red-200 text-red-800"
                      }`}>
                        <div className="space-y-0.5">
                          <div className="font-semibold">Preview Perubahan</div>
                          {stockAction === "RESTOCK" && usePack && selected.packQty ? (
                            <div className="text-[11px] opacity-75">
                              {inputNum} {selected.packName || "pack"} × {selected.packQty} pcs = <strong>{pcsChange} pcs</strong>
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-black ${isRestock ? "text-emerald-700" : "text-red-700"}`}>
                            {isRestock ? `+${pcsChange}` : `-${pcsChange}`} pcs
                          </div>
                          <div className="text-[11px] opacity-70">
                            {selected.currentStock} → <strong>{Math.max(0, newStock)}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Catatan (opsional)
                    </label>
                    <input
                      type="text"
                      value={stockNotes}
                      onChange={(e) => setStockNotes(e.target.value)}
                      placeholder="Contoh: Beli dari agen / bocor di rak"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <button className="w-full py-2.5 rounded-md bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-sm transition">
                    Simpan Perubahan Stok
                  </button>
                </form>

                <div className="pt-3 border-t">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Kartu Stok Terakhir
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto text-xs pr-1">
                    {movements.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-md bg-slate-50 border border-slate-100 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{m.type}</div>
                          <div className="text-slate-500">{m.notes || "-"}</div>
                          <div className="text-[10px] text-slate-400">
                            {formatDateTime(m.createdAt)} • {m.createdBy.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-black text-xs ${
                              m.qtyChange > 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                          </span>
                          <div className="text-[10px] text-slate-500">Sisa: {m.stockAfter}</div>
                        </div>
                      </div>
                    ))}
                    {movements.length === 0 && (
                      <p className="text-center text-slate-400 py-4 text-xs">
                        Belum ada riwayat pergerakan stok.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* MODAL TAMBAH / EDIT SACHET */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-md max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-slate-900">
                  {editingProduct ? "Edit Sachet" : "Tambah Sachet Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-3.5">
                {/* Upload Gambar Sachet */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Foto / Gambar Sachet
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
                          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 shadow-sm hover:bg-red-700"
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
                    Nama Sachet <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Soklin Liquid 1K"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) =>
                        setFormCategory(e.target.value as Product["category"])
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="DETERGENT">Deterjen</option>
                      <option value="SOFTENER">Pengharum</option>
                      <option value="PERFUME">Parfum</option>
                    </select>
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
                      Harga Satuan (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="500"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="Contoh: 1000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Batas Min. Alert (pcs)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      placeholder="Contoh: 10"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Stok Awal (pcs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formInitialStock}
                      onChange={(e) => setFormInitialStock(e.target.value)}
                      placeholder="Contoh: 24"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Satuan Grosir / Pack
                    </label>
                    <input
                      type="text"
                      value={formPackName}
                      onChange={(e) => setFormPackName(e.target.value)}
                      placeholder="Contoh: Renceng"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Isi per Pack (pcs)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formPackQty}
                      onChange={(e) => setFormPackQty(e.target.value)}
                      placeholder="Contoh: 12"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {editingProduct && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Status Sachet Aktif (Tampil di Kasir POS)
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
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {submitting ? "Menyimpan..." : "Simpan Sachet"}
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
