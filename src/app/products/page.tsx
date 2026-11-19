"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Search,
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

type CategoryFilter = "ALL" | Product["category"];

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
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
  const [uploadError, setUploadError] = useState("");

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
    let active = true;
    fetch("/api/products?all=true")
      .then(parseJsonSafe)
      .then((data) => {
        if (active) setProducts(data.products || []);
      })
      .catch(() => {
        if (active) setErrorMsg("Gagal memuat produk.");
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

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
      if (searchQuery.trim() && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [products, categoryFilter, searchQuery]);

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
    setUploadError("");
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
      formData.append("folder", "products");

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
      const updatedSelected = data.product || selected;
      await openHistory(updatedSelected);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengubah stok.");
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
            Stok Sachet
          </h2>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-sm text-xs font-semibold shadow-sm shadow-blue-600/20 whitespace-nowrap shrink-0 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Sachet</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-5 items-start">
          {/* Left 8 Cols: Table */}
          <div className="lg:col-span-8 bg-white rounded-sm border border-slate-200/90 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama sachet..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-sm text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-sm border border-slate-200/70">
                {(
                  [
                    { id: "ALL", label: "Semua" },
                    { id: "DETERGENT", label: "Deterjen" },
                    { id: "SOFTENER", label: "Pengharum" },
                    { id: "PERFUME", label: "Parfum" },
                  ] as { id: CategoryFilter; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm whitespace-nowrap transition-all cursor-pointer ${
                      categoryFilter === tab.id
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
                  <tr className="bg-slate-50/70 text-[11px] font-semibold text-slate-500 border-b border-slate-200/80">
                    <th className="py-3 px-4 w-20 text-center">Urutan</th>
                    <th className="py-3 px-4">Produk Sachet</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-right">Harga</th>
                    <th className="py-3 px-4 text-right">Sisa Stok</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody
                  key={categoryFilter}
                  className="divide-y divide-slate-100 text-[13px]"
                >
                  {loading ? (
                    [0, 1, 2, 3, 4].map((i) => (
                      <tr key={i}>
                        <td className="py-3 px-4 text-center"><div className="h-4 w-5 bg-slate-100 rounded-sm mx-auto animate-pulse" /></td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-sm bg-slate-100 animate-pulse shrink-0" />
                            <div className="space-y-1.5">
                              <div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" />
                              <div className="h-2.5 w-20 bg-slate-100 rounded-sm animate-pulse" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4"><div className="h-3.5 w-16 bg-slate-100 rounded-sm animate-pulse" /></td>
                        <td className="py-3 px-4 text-right"><div className="h-3.5 w-14 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                        <td className="py-3 px-4 text-right"><div className="h-3.5 w-12 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 w-10 bg-slate-100 rounded-sm animate-pulse" /></td>
                        <td className="py-3 px-4 text-right"><div className="h-7 w-14 bg-slate-100 rounded-sm ml-auto animate-pulse" /></td>
                      </tr>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <tr className="animate-content-swap">
                      <td colSpan={7} className="py-12 px-4 text-center">
                        <p className="text-sm font-medium text-slate-700">
                          Belum ada produk sachet yang sesuai
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Klik &quot;Tambah Sachet&quot; untuk menambahkan item baru.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const isLow = p.currentStock <= p.minStockAlert;
                      const isSelected = selected?.id === p.id;
                      const showReorder = categoryFilter === "ALL" && !searchQuery.trim();

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            activeMenuId === p.id ? "relative z-30" : ""
                          } ${
                            isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/80"
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs font-mono text-slate-500 tabular-nums">
                                {idx + 1}
                              </span>
                              {showReorder && (
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveProduct(idx, "up")}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                    title="Pindah ke Atas"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === products.length - 1}
                                    onClick={() => handleMoveProduct(idx, "down")}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                    title="Pindah ke Bawah"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-sm object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-sm bg-slate-100 flex items-center justify-center shrink-0">
                                  {p.category === "DETERGENT" ? (
                                    <Droplets className="w-4 h-4 text-blue-600" />
                                  ) : p.category === "SOFTENER" ? (
                                    <Sparkles className="w-4 h-4 text-pink-500" />
                                  ) : (
                                    <Package className="w-4 h-4 text-indigo-600" />
                                  )}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-slate-900">{p.name}</div>
                                {p.packQty && (
                                  <div className="text-[11px] text-slate-500 tabular-nums">
                                    1 {p.packName || "Pack"} = {p.packQty} pcs
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {CATEGORY_NAMES[p.category]}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                            {formatRupiah(p.price)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div
                              className={`font-mono font-semibold tabular-nums ${
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
                              <div className="text-[11px] text-amber-600 font-medium">
                                {p.currentStock <= 0 ? "Habis" : "Menipis"}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-xs font-semibold ${
                                p.isActive ? "text-emerald-600" : "text-slate-400"
                              }`}
                            >
                              {p.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right relative ${activeMenuId === p.id ? "z-30" : ""}`}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openHistory(p)}
                                className={`text-xs px-2.5 py-1.5 rounded-sm font-medium transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs"
                                    : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
                                }`}
                              >
                                Stok
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setActiveMenuId(activeMenuId === p.id ? null : p.id)
                                }
                                className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                                title="Opsi Sachet"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            {activeMenuId === p.id && (
                              <div
                                ref={menuRef}
                                className={`absolute right-4 w-44 bg-white rounded-sm shadow-xl border border-slate-200 py-1.5 z-50 text-left ${
                                  idx >= filteredProducts.length - 2 && filteredProducts.length > 2
                                    ? "bottom-11"
                                    : "top-11"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    openEditModal(p);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 text-left cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  Edit Sachet
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleActiveProduct(p)}
                                  className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-left cursor-pointer"
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                                <div className="h-px bg-slate-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p)}
                                  className="w-full px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 text-left cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Hapus Sachet
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 4 Cols: Stock Inspector */}
          <aside className="lg:col-span-4 bg-white rounded-sm border border-slate-200/90 overflow-hidden lg:sticky lg:top-20">
            <div key={selected?.id || "empty"} className="animate-content-swap">
            {!selected ? (
              <div className="text-center py-14 px-6 space-y-2">
                <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-medium text-slate-700">Pilih produk</p>
                <p className="text-xs text-slate-500">
                  Klik <strong>Stok</strong> di tabel untuk mutasi stok.
                </p>
              </div>
            ) : (
              <div>
                <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900">{selected.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      Sisa Stok:{" "}
                      <strong className="font-mono text-slate-900">
                        {selected.currentStock} pcs
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-400 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  <form onSubmit={handleStockSubmit} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-sm">
                      <button
                        type="button"
                        onClick={() => setStockAction("RESTOCK")}
                        className={`py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer ${
                          stockAction === "RESTOCK"
                            ? "bg-white text-emerald-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        + Restock Masuk
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockAction("DAMAGED")}
                        className={`py-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer ${
                          stockAction === "DAMAGED"
                            ? "bg-white text-red-600 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        - Rusak / Bocor
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jumlah {stockAction === "RESTOCK" ? "Masuk" : "Rusak"}
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={stockQty}
                        onChange={(e) => setStockQty(e.target.value)}
                        placeholder="Contoh: 2"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-sm text-sm font-mono font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>

                    {stockAction === "RESTOCK" && selected.packQty && (
                      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={usePack}
                          onChange={(e) => setUsePack(e.target.checked)}
                          className="rounded-sm border-slate-300 text-blue-600"
                        />
                        <span>
                          Hitung per <strong>{selected.packName || "Pack"}</strong> ({selected.packQty} pcs)
                        </span>
                      </label>
                    )}

                    {stockQty && Number(stockQty) > 0 && (() => {
                      const inputNum = Number(stockQty);
                      const pcsChange =
                        stockAction === "RESTOCK" && usePack && selected.packQty
                          ? inputNum * selected.packQty
                          : inputNum;
                      const qtyChange = stockAction === "RESTOCK" ? pcsChange : -pcsChange;
                      const newStock = selected.currentStock + qtyChange;
                      const isRestock = stockAction === "RESTOCK";
                      return (
                        <div
                          key={`${stockAction}-${pcsChange}`}
                          className={`rounded-sm px-3.5 py-2.5 text-xs border flex items-center justify-between gap-2 animate-content-swap ${
                            isRestock
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-red-50 border-red-200 text-red-800"
                          }`}
                        >
                          <div>
                            <div className="font-semibold">Preview Mutasi</div>
                            {stockAction === "RESTOCK" && usePack && selected.packQty ? (
                              <div className="text-[11px] opacity-80 tabular-nums">
                                {inputNum} {selected.packName || "pack"} × {selected.packQty} pcs
                              </div>
                            ) : null}
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <div className="text-sm font-semibold">
                              {isRestock ? `+${pcsChange}` : `-${pcsChange}`} pcs
                            </div>
                            <div className="text-[11px] opacity-75">
                              {selected.currentStock} → {Math.max(0, newStock)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Catatan (opsional)
                      </label>
                      <input
                        type="text"
                        value={stockNotes}
                        onChange={(e) => setStockNotes(e.target.value)}
                        placeholder="Contoh: Beli dari agen / bocor di rak"
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-sm text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
                    >
                      Simpan Perubahan Stok
                    </button>
                  </form>

                  <div className="pt-4 border-t border-slate-200/80">
                    <h4 className="text-xs font-semibold text-slate-700 mb-3">
                      Riwayat Mutasi Terakhir
                    </h4>
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1 text-xs">
                      {movements.map((m) => (
                        <div key={m.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900">{m.type}</div>
                            <div className="text-slate-500 truncate">{m.notes || "-"}</div>
                            <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                              {formatDateTime(m.createdAt)} · {m.createdBy.name}
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums shrink-0">
                            <span
                              className={`font-semibold ${
                                m.qtyChange > 0 ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                            </span>
                            <div className="text-[11px] text-slate-500">Sisa: {m.stockAfter}</div>
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
                </div>
              </div>
            )}
            </div>
          </aside>
        </div>

        {/* Create / Edit Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 animate-backdrop-enter">
            <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-modal-enter">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-semibold text-base text-slate-900">
                  {editingProduct ? "Edit Sachet" : "Tambah Sachet Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Foto / Gambar Sachet
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
                    Nama Sachet <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Soklin Liquid 1K"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) =>
                        setFormCategory(e.target.value as Product["category"])
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    >
                      <option value="DETERGENT">Deterjen</option>
                      <option value="SOFTENER">Pengharum</option>
                      <option value="PERFUME">Parfum</option>
                    </select>
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
                      Harga Satuan (Rp) <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="500"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="1000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Batas Min. Alert (pcs)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Stok Awal (pcs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formInitialStock}
                      onChange={(e) => setFormInitialStock(e.target.value)}
                      placeholder="24"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Satuan Pack
                    </label>
                    <input
                      type="text"
                      value={formPackName}
                      onChange={(e) => setFormPackName(e.target.value)}
                      placeholder="Renceng"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Isi per Pack (pcs)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formPackQty}
                      onChange={(e) => setFormPackQty(e.target.value)}
                      placeholder="12"
                      className="w-full px-3 py-2 border border-slate-200 rounded-sm text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                {editingProduct && (
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded-sm border-slate-300 text-blue-600"
                    />
                    Status Sachet Aktif (Tampil di Kasir POS)
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
