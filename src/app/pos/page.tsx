"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  Droplets,
  Minus,
  Package,
  Plus,
  QrCode,
  Scale,
  Shirt,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatRupiah } from "@/lib/format";
import {
  getPusherClient,
  PUSHER_CHANNEL,
  PUSHER_EVENT_DISPLAY_UPDATE,
} from "@/lib/pusher-client";

interface Service {
  id: string;
  name: string;
  price: number;
  washerCount: number;
  dryerCount: number;
  maxWeightKg: number | null;
  imageUrl?: string | null;
  sortOrder?: number;
}

interface Product {
  id: string;
  name: string;
  category: "DETERGENT" | "SOFTENER" | "PERFUME";
  price: number;
  currentStock: number;
  imageUrl?: string | null;
  sortOrder?: number;
}

interface PendingQrisOrder {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
}

interface ServiceConfig {
  selected: boolean;
  value: string;
}

type ProductFilter = "ALL" | Product["category"];

const CATEGORY_LABEL: Record<Product["category"], string> = {
  DETERGENT: "Deterjen",
  SOFTENER: "Pengharum",
  PERFUME: "Parfum",
};

function getServiceCategory(
  name: string
): "WEIGHT_BASED" | "SPREI" | "SELIMUT_BESAR" | "SELIMUT_KECIL" {
  const lower = name.toLowerCase();
  if (lower.includes("sprei")) return "SPREI";
  if (lower.includes("selimut besar") || lower.includes("bedcover")) return "SELIMUT_BESAR";
  if (lower.includes("selimut kecil")) return "SELIMUT_KECIL";
  return "WEIGHT_BASED";
}

function formatMachineLabel(washer: number, dryer: number) {
  const parts: string[] = [];
  if (washer > 0) parts.push(`${washer} Washer`);
  if (dryer > 0) parts.push(`${dryer} Dryer`);
  return parts.length > 0 ? parts.join(" · ") : "Mesin";
}

function calculateServiceMetrics(s: Service, config: ServiceConfig | undefined) {
  if (!config || !config.selected) {
    return {
      isSelected: false,
      multiplier: 0,
      subtotal: 0,
      washerCount: 0,
      dryerCount: 0,
      displayUnits: "",
      explanation: "",
    };
  }

  const category = getServiceCategory(s.name);
  const rawNum = parseFloat(config.value || "0") || 0;
  const maxKg = s.maxWeightKg && s.maxWeightKg > 0 ? s.maxWeightKg : 8;

  let multiplier = 0;
  let displayUnits = "";
  let explanation = "";

  if (category === "WEIGHT_BASED") {
    displayUnits = `${rawNum} kg`;
    if (rawNum <= 0) {
      multiplier = 0;
      explanation = "Timbang & masukkan berat kain";
    } else {
      multiplier = Math.ceil(Number((rawNum / maxKg).toFixed(4)));
      const machineText = formatMachineLabel(
        s.washerCount * multiplier,
        s.dryerCount * multiplier
      );
      if (multiplier === 1) {
        explanation = `${rawNum} kg (≤ ${maxKg} kg) · 1x (${machineText})`;
      } else {
        explanation = `${rawNum} kg (> ${(multiplier - 1) * maxKg} kg) · ${multiplier}x (${machineText})`;
      }
    }
  } else if (category === "SPREI") {
    const pcs = Math.floor(rawNum);
    displayUnits = `${pcs} sprei`;
    if (pcs <= 0) {
      multiplier = 0;
      explanation = "Masukkan jumlah lembar sprei";
    } else {
      multiplier = pcs;
      const machineText = formatMachineLabel(
        s.washerCount * multiplier,
        s.dryerCount * multiplier
      );
      explanation = `${pcs} sprei · ${multiplier}x (${machineText})`;
    }
  } else if (category === "SELIMUT_BESAR") {
    const pcs = Math.floor(rawNum);
    displayUnits = `${pcs} selimut besar`;
    if (pcs <= 0) {
      multiplier = 0;
      explanation = "Masukkan jumlah lembar selimut besar";
    } else {
      multiplier = pcs;
      const machineText = formatMachineLabel(
        s.washerCount * multiplier,
        s.dryerCount * multiplier
      );
      explanation = `${pcs} selimut besar · ${multiplier}x (${machineText})`;
    }
  } else {
    const pcs = Math.floor(rawNum);
    displayUnits = `${pcs} selimut kecil`;
    if (pcs <= 0) {
      multiplier = 0;
      explanation = "Masukkan jumlah lembar selimut kecil";
    } else {
      multiplier = Math.ceil(pcs / 2);
      const machineText = formatMachineLabel(
        s.washerCount * multiplier,
        s.dryerCount * multiplier
      );
      explanation = `${pcs} selimut kecil · ${multiplier}x (${machineText}, maks 2/mesin)`;
    }
  }

  return {
    isSelected: true,
    multiplier,
    subtotal: s.price * multiplier,
    washerCount: s.washerCount * multiplier,
    dryerCount: s.dryerCount * multiplier,
    displayUnits,
    explanation,
  };
}

async function safeJsonParse(res: Response) {
  try {
    const text = await res.text();
    if (!text || text.trim() === "") return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function PosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productFilter, setProductFilter] = useState<ProductFilter>("ALL");
  const [customerName, setCustomerName] = useState("");

  const [serviceConfigs, setServiceConfigs] = useState<Record<string, ServiceConfig>>({});
  const [productCart, setProductCart] = useState<Record<string, number>>({});

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("QRIS");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pendingQris, setPendingQris] = useState<PendingQrisOrder | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadMasterData = useCallback(async () => {
    try {
      const [svcRes, prodRes] = await Promise.all([
        fetch("/api/services"),
        fetch("/api/products"),
      ]);
      const svcData = await safeJsonParse(svcRes);
      const prodData = await safeJsonParse(prodRes);
      const svcList = Array.isArray(svcData.services) ? svcData.services : [];
      const prodList = Array.isArray(prodData.products) ? prodData.products : [];
      setServices(svcList.sort((a: Service, b: Service) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
      setProducts(prodList.sort((a: Product, b: Product) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    } catch (err) {
      console.error("Gagal memuat master data POS:", err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/services"), fetch("/api/products")])
      .then(async ([svcRes, prodRes]) => {
        if (!active) return;
        const svcData = await safeJsonParse(svcRes);
        const prodData = await safeJsonParse(prodRes);
        const svcList = Array.isArray(svcData.services) ? svcData.services : [];
        const prodList = Array.isArray(prodData.products) ? prodData.products : [];
        setServices(svcList.sort((a: Service, b: Service) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
        setProducts(prodList.sort((a: Product, b: Product) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
      })
      .catch((err) => console.error("Gagal memuat master data POS:", err))
      .finally(() => {
        if (active) setInitialLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resetCart = useCallback(() => {
    setCustomerName("");
    setServiceConfigs({});
    setProductCart({});
    setCashReceived("");
  }, []);

  useEffect(() => {
    if (!pendingQris) return;

    const pusher = getPusherClient();
    const channel = pusher.subscribe(PUSHER_CHANNEL);

    channel.bind(
      PUSHER_EVENT_DISPLAY_UPDATE,
      (payload: { type: string; orderId?: string }) => {
        if (payload.type === "ORDER_PAID" && payload.orderId === pendingQris.id) {
          setSuccessMsg(
            `Pembayaran QRIS ${pendingQris.invoiceNumber} (${pendingQris.customerName}) LUNAS!`
          );
          setPendingQris(null);
          resetCart();
          loadMasterData();
        }
      }
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(PUSHER_CHANNEL);
    };
  }, [pendingQris, loadMasterData, resetCart]);

  function toggleService(s: Service) {
    setServiceConfigs((prev) => {
      const existing = prev[s.id];
      if (existing?.selected) {
        const copy = { ...prev };
        delete copy[s.id];
        return copy;
      }
      const cat = getServiceCategory(s.name);
      const defaultValue =
        cat === "WEIGHT_BASED"
          ? String(s.maxWeightKg && s.maxWeightKg > 0 ? s.maxWeightKg : 8)
          : "1";
      return {
        ...prev,
        [s.id]: { selected: true, value: defaultValue },
      };
    });
  }

  function updateServiceValue(serviceId: string, value: string) {
    setServiceConfigs((prev) => ({
      ...prev,
      [serviceId]: { selected: true, value },
    }));
  }

  function updateProductQty(id: string, delta: number) {
    setProductCart((prev) => {
      const next = (prev[id] || 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  const filteredProducts = useMemo(() => {
    if (productFilter === "ALL") return products;
    return products.filter((p) => p.category === productFilter);
  }, [products, productFilter]);

  const summary = useMemo(() => {
    let totalAmount = 0;
    let totalWasher = 0;
    let totalDryer = 0;
    let totalWeight = 0;
    const activeServiceLines: {
      service: Service;
      multiplier: number;
      subtotal: number;
      explanation: string;
      displayUnits: string;
    }[] = [];

    for (const s of services) {
      const config = serviceConfigs[s.id];
      const metrics = calculateServiceMetrics(s, config);

      if (metrics.isSelected && metrics.multiplier > 0) {
        totalAmount += metrics.subtotal;
        totalWasher += metrics.washerCount;
        totalDryer += metrics.dryerCount;

        if (getServiceCategory(s.name) === "WEIGHT_BASED") {
          const w = parseFloat(config?.value || "0") || 0;
          totalWeight = Math.max(totalWeight, w);
        }

        activeServiceLines.push({
          service: s,
          multiplier: metrics.multiplier,
          subtotal: metrics.subtotal,
          explanation: metrics.explanation,
          displayUnits: metrics.displayUnits,
        });
      }
    }

    for (const p of products) {
      const qty = productCart[p.id] || 0;
      if (qty > 0) {
        totalAmount += p.price * qty;
      }
    }

    return {
      totalAmount,
      totalWasher,
      totalDryer,
      totalWeight,
      activeServiceLines,
    };
  }, [services, serviceConfigs, products, productCart]);

  const cashNum = Number(cashReceived || 0);
  const cashChange = cashNum - summary.totalAmount;

  useEffect(() => {
    const hasItems = summary.totalAmount > 0 || customerName.trim().length > 0;
    const cartPayload = hasItems
      ? {
          customerName: customerName.trim(),
          totalAmount: summary.totalAmount,
          totalWasher: summary.totalWasher,
          totalDryer: summary.totalDryer,
          totalWeight: summary.totalWeight,
          services: summary.activeServiceLines.map((l) => ({
            id: l.service.id,
            name: l.service.name,
            qty: l.multiplier,
            subtotal: l.subtotal,
            explanation: l.explanation,
          })),
          products: products
            .filter((p) => (productCart[p.id] || 0) > 0)
            .map((p) => ({
              id: p.id,
              name: p.name,
              qty: productCart[p.id],
              price: p.price,
              subtotal: p.price * productCart[p.id],
              category: p.category,
            })),
        }
      : null;

    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const bc = new BroadcastChannel("tricoins-pos-sync");
        bc.postMessage({ type: "CART_SYNC", cart: cartPayload });
        bc.close();
      }
    } catch {
      // Ignore if unsupported
    }

    const timer = setTimeout(() => {
      fetch("/api/customer-display/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: cartPayload }),
      }).catch(() => {});
    }, 250);

    return () => clearTimeout(timer);
  }, [summary, customerName, productCart, products]);

  async function handleCheckout() {
    setErrorMsg("");
    setSuccessMsg("");

    if (!customerName.trim()) {
      setErrorMsg("Nama pelanggan wajib diisi.");
      return;
    }

    const hasIncompleteService = services.some((s) => {
      const cfg = serviceConfigs[s.id];
      if (!cfg?.selected) return false;
      return calculateServiceMetrics(s, cfg).multiplier <= 0;
    });

    if (hasIncompleteService) {
      setErrorMsg("Lengkapi berat (kg) atau jumlah lembar pada layanan yang dipilih.");
      return;
    }

    const serviceItems = summary.activeServiceLines.map((line) => ({
      serviceId: line.service.id,
      qty: line.multiplier,
    }));

    const productItems = Object.entries(productCart).map(([productId, qty]) => ({
      productId,
      qty,
    }));

    if (serviceItems.length === 0 && productItems.length === 0) {
      setErrorMsg("Pilih minimal 1 layanan atau sachet.");
      return;
    }

    if (paymentMethod === "CASH" && cashNum < summary.totalAmount) {
      setErrorMsg("Uang tunai yang diterima kurang.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          weightKg: summary.totalWeight > 0 ? summary.totalWeight : null,
          paymentMethod,
          cashReceived: paymentMethod === "CASH" ? cashNum : null,
          services: serviceItems,
          products: productItems,
        }),
      });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        setErrorMsg(data.error || "Gagal memproses transaksi");
        return;
      }

      if (paymentMethod === "CASH") {
        setSuccessMsg(
          `Transaksi ${data.order?.invoiceNumber || ""} LUNAS (Cash). Kembalian: ${formatRupiah(
            data.order?.cashChange || 0
          )}`
        );
        resetCart();
        loadMasterData();
      } else {
        if (!data.order) {
          setErrorMsg("Gagal membuat data pembayaran QRIS.");
          return;
        }
        setPendingQris({
          id: data.order.id,
          invoiceNumber: data.order.invoiceNumber,
          customerName: data.order.customerName,
          totalAmount: data.order.totalAmount,
        });
      }
    } catch {
      setErrorMsg("Terjadi kesalahan saat menghubungi server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckStatus() {
    if (!pendingQris) return;
    try {
      const res = await fetch(`/api/orders/${pendingQris.id}/check-status`);
      const data = await safeJsonParse(res);
      if (data.order?.paymentStatus === "PAID") {
        setSuccessMsg(`Pembayaran QRIS ${pendingQris.invoiceNumber} LUNAS!`);
        setPendingQris(null);
        resetCart();
        loadMasterData();
      } else if (
        data.order?.paymentStatus === "EXPIRED" ||
        data.order?.paymentStatus === "CANCELLED"
      ) {
        setErrorMsg("QRIS kedaluwarsa/dibatalkan.");
        setPendingQris(null);
      } else {
        setErrorMsg("Belum ada pembayaran masuk dari Midtrans.");
      }
    } catch {
      setErrorMsg("Gagal memeriksa status pembayaran.");
    }
  }

  async function handleCancelQris() {
    if (!pendingQris) return;
    try {
      await fetch(`/api/orders/${pendingQris.id}/cancel`, { method: "POST" });
    } catch {
      // Ignore network error
    }
    setPendingQris(null);
    setErrorMsg("QRIS dibatalkan. Anda bisa ganti ke Cash atau buat ulang.");
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {successMsg && (
          <div className="px-4 py-3 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm font-medium animate-content-swap">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              {successMsg}
            </span>
            <button type="button" onClick={() => setSuccessMsg("")} className="p-1 text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="px-4 py-3 rounded-sm bg-red-50 border border-red-200 text-red-700 flex items-center justify-between text-sm font-medium animate-content-swap">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              {errorMsg}
            </span>
            <button type="button" onClick={() => setErrorMsg("")} className="p-1 text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {pendingQris && (
          <div className="p-4 rounded-sm bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200 flex flex-wrap items-center justify-between gap-4 animate-content-swap">
            <div>
              <p className="font-semibold text-sm text-slate-900">
                Menunggu Pembayaran QRIS ·{" "}
                <span className="font-mono text-blue-600">{pendingQris.invoiceNumber}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {pendingQris.customerName} · Total{" "}
                <strong className="text-slate-900">{formatRupiah(pendingQris.totalAmount)}</strong> · Ditampilkan di Layar Pelanggan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCheckStatus}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-sm text-xs font-semibold shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
              >
                Cek Status Midtrans
              </button>
              <button
                type="button"
                onClick={handleCancelQris}
                className="px-3.5 py-2 bg-white border border-slate-200 text-red-600 rounded-sm text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer"
              >
                Batalkan / Ganti Cash
              </button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Services + Add-On Products */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section 1: Services */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  1. Layanan Mesin
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {services.length} layanan
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3.5">
                {initialLoading ? (
                  [0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="rounded-sm border border-slate-200/90 bg-white p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-sm bg-slate-100 animate-pulse shrink-0" />
                        <div className="space-y-2">
                          <div className="h-3.5 w-32 bg-slate-100 rounded-sm animate-pulse" />
                          <div className="h-3 w-24 bg-slate-100 rounded-sm animate-pulse" />
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-sm bg-slate-100 animate-pulse shrink-0" />
                    </div>
                  ))
                ) : (
                  services.map((s) => {
                  const config = serviceConfigs[s.id];
                  const metrics = calculateServiceMetrics(s, config);
                  const category = getServiceCategory(s.name);
                  const maxKg = s.maxWeightKg && s.maxWeightKg > 0 ? s.maxWeightKg : 8;

                  return (
                    <div
                      key={s.id}
                      className={`rounded-sm border bg-white overflow-hidden transition-colors duration-150 ${
                        metrics.isSelected
                          ? "border-blue-600 ring-2 ring-blue-600/15"
                          : "border-slate-200/90 hover:border-slate-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleService(s)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {s.imageUrl ? (
                            <img
                              src={s.imageUrl}
                              alt={s.name}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-sm object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 transition-all ${
                                metrics.isSelected
                                  ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs"
                                  : "bg-blue-50/70 text-blue-600"
                              }`}
                            >
                              <Shirt className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate">
                              {s.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate tabular-nums">
                              <span className="font-mono font-semibold text-slate-800">
                                {formatRupiah(s.price)}
                              </span>
                              <span className="mx-1.5 text-slate-300">·</span>
                              {category === "WEIGHT_BASED"
                                ? `Maks ${maxKg} kg`
                                : formatMachineLabel(s.washerCount, s.dryerCount)}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all ${
                            metrics.isSelected
                              ? "bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {metrics.isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>

                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                          metrics.isSelected
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0 pointer-events-none"
                        }`}
                        aria-hidden={!metrics.isSelected}
                      >
                        <div className="overflow-hidden">
                          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 space-y-3">
                            {category === "WEIGHT_BASED" ? (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                    <Scale className="w-3.5 h-3.5 text-blue-600" />
                                    Berat kain (kg)
                                  </label>
                                  <button
                                    type="button"
                                    tabIndex={metrics.isSelected ? 0 : -1}
                                    onClick={() => toggleService(s)}
                                    className="text-xs text-red-600 hover:underline font-medium cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    tabIndex={metrics.isSelected ? 0 : -1}
                                    onFocus={(e) => e.target.select()}
                                    value={config?.value || ""}
                                    onChange={(e) => updateServiceValue(s.id, e.target.value)}
                                    placeholder="Contoh: 10.5"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-sm text-sm font-mono font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                                  />
                                  <span className="text-xs font-semibold text-slate-500 px-2">
                                    kg
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {[5, 8, 10, 12, 16, 20].map((kg) => (
                                    <button
                                      key={kg}
                                      type="button"
                                      tabIndex={metrics.isSelected ? 0 : -1}
                                      onClick={() => updateServiceValue(s.id, String(kg))}
                                      className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-sm border transition-all cursor-pointer tabular-nums ${
                                        Number(config?.value) === kg
                                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-xs"
                                          : "bg-white hover:bg-blue-50/70 border-slate-200 text-slate-700"
                                      }`}
                                    >
                                      {kg} kg
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-slate-700">
                                    {category === "SPREI"
                                      ? "Jumlah lembar sprei (1 mesin / sprei)"
                                      : category === "SELIMUT_BESAR"
                                      ? "Jumlah selimut besar (1 mesin / selimut)"
                                      : "Jumlah selimut kecil (maks 2 / mesin)"}
                                  </label>
                                  <button
                                    type="button"
                                    tabIndex={metrics.isSelected ? 0 : -1}
                                    onClick={() => toggleService(s)}
                                    className="text-xs text-red-600 hover:underline font-medium cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    tabIndex={metrics.isSelected ? 0 : -1}
                                    onClick={() =>
                                      updateServiceValue(
                                        s.id,
                                        String(Math.max(1, Number(config?.value || 1) - 1))
                                      )
                                    }
                                    className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    tabIndex={metrics.isSelected ? 0 : -1}
                                    value={config?.value || ""}
                                    onChange={(e) => updateServiceValue(s.id, e.target.value)}
                                    className="w-20 text-center px-2 py-1.5 bg-white border border-slate-200 rounded-sm text-sm font-mono font-semibold text-slate-900 tabular-nums transition"
                                  />
                                  <button
                                    type="button"
                                    tabIndex={metrics.isSelected ? 0 : -1}
                                    onClick={() =>
                                      updateServiceValue(
                                        s.id,
                                        String(Number(config?.value || 0) + 1)
                                      )
                                    }
                                    className="p-2 rounded-sm bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-xs text-slate-500">lembar</span>
                                </div>
                              </div>
                            )}

                            <div
                              key={`${metrics.explanation}-${metrics.subtotal}`}
                              className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2 text-xs animate-content-swap"
                            >
                              <span className="text-slate-600">{metrics.explanation}</span>
                              <span className="font-mono font-semibold text-blue-600 tabular-nums shrink-0">
                                {formatRupiah(metrics.subtotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </section>

            {/* Section 2: Add-On Products */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">
                  2. Add-On Sachet
                </h2>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-sm border border-slate-200/70">
                  {(
                    [
                      { id: "ALL", label: "Semua" },
                      { id: "DETERGENT", label: "Deterjen" },
                      { id: "SOFTENER", label: "Pengharum" },
                      { id: "PERFUME", label: "Parfum" },
                    ] as { id: ProductFilter; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setProductFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-sm whitespace-nowrap transition-all cursor-pointer ${
                        productFilter === tab.id
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-blue-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                key={productFilter}
                className="grid sm:grid-cols-2 md:grid-cols-3 gap-3.5 animate-content-swap"
              >
                {initialLoading ? (
                  [0, 1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-sm border border-slate-200/90 bg-white flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-sm bg-slate-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 w-20 bg-slate-100 rounded-sm animate-pulse" />
                          <div className="h-3.5 w-28 bg-slate-100 rounded-sm animate-pulse" />
                          <div className="h-3 w-16 bg-slate-100 rounded-sm animate-pulse" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="h-3 w-12 bg-slate-100 rounded-sm animate-pulse" />
                        <div className="w-7 h-7 rounded-sm bg-slate-100 animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : (
                  filteredProducts.map((p) => {
                  const qty = productCart[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-sm border bg-white flex flex-col justify-between gap-3 transition-all duration-150 ${
                        qty > 0
                          ? "border-blue-600 ring-2 ring-blue-600/15"
                          : "border-slate-200/90 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-sm object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-sm bg-slate-100 flex items-center justify-center shrink-0">
                            {p.category === "DETERGENT" ? (
                              <Droplets className="w-5 h-5 text-blue-600" />
                            ) : p.category === "SOFTENER" ? (
                              <Sparkles className="w-5 h-5 text-pink-500" />
                            ) : (
                              <Package className="w-5 h-5 text-indigo-600" />
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {CATEGORY_LABEL[p.category]}
                            <span className="mx-1 text-slate-300">·</span>
                            <span className={p.currentStock <= 0 ? "text-red-600 font-medium" : ""}>
                              {p.currentStock} pcs
                            </span>
                          </div>
                          <p className="font-semibold text-sm text-slate-900 truncate mt-0.5" title={p.name}>
                            {p.name}
                          </p>
                          <p className="text-xs font-mono font-semibold text-blue-600 tabular-nums mt-0.5">
                            {formatRupiah(p.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span
                          key={qty}
                          className="text-xs font-mono text-slate-500 tabular-nums animate-content-swap"
                        >
                          {qty > 0 ? formatRupiah(p.price * qty) : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {qty > 0 && (
                            <div className="flex items-center gap-1.5 animate-content-swap">
                              <button
                                type="button"
                                onClick={() => updateProductQty(p.id, -1)}
                                className="w-7 h-7 rounded-sm border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 cursor-pointer transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                key={`qty-${qty}`}
                                className="w-6 text-center font-mono font-semibold text-sm tabular-nums animate-content-swap"
                              >
                                {qty}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => updateProductQty(p.id, 1)}
                            className="w-7 h-7 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center cursor-pointer shadow-xs transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Right 4 Columns: Checkout Panel */}
          <aside className="lg:col-span-4 bg-white rounded-sm border border-slate-200/90 shadow-xs lg:sticky lg:top-20 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <h2 className="font-semibold text-sm text-white">Ringkasan Transaksi</h2>
              <span className="text-xs font-mono text-blue-100 tabular-nums">
                {summary.totalWasher}W · {summary.totalDryer}D
              </span>
            </div>

            <div className="p-5 space-y-5">
              {/* Machine Summary Strip */}
              <div className="grid grid-cols-2 divide-x divide-blue-100 py-2.5 bg-blue-50/60 rounded-sm border border-blue-100 text-center">
                <div>
                  <span className="text-[11px] text-slate-500 block">Mesin Cuci</span>
                  <span
                    key={`w-${summary.totalWasher}`}
                    className="inline-block text-sm font-mono font-semibold text-blue-900 tabular-nums animate-content-swap"
                  >
                    {summary.totalWasher} Mesin
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Mesin Kering</span>
                  <span
                    key={`d-${summary.totalDryer}`}
                    className="inline-block text-sm font-mono font-semibold text-blue-900 tabular-nums animate-content-swap"
                  >
                    {summary.totalDryer} Mesin
                  </span>
                </div>
              </div>

              {/* Cart Items */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {summary.activeServiceLines.map((line) => (
                  <div
                    key={line.service.id}
                    className="pb-2.5 border-b border-slate-100 last:border-none last:pb-0 animate-content-swap"
                  >
                    <div className="flex justify-between gap-2 text-[13px] font-medium text-slate-900">
                      <span>
                        {line.service.name} × {line.multiplier}
                      </span>
                      <span
                        key={line.subtotal}
                        className="font-mono font-semibold tabular-nums shrink-0 animate-content-swap"
                      >
                        {formatRupiah(line.subtotal)}
                      </span>
                    </div>
                    <div
                      key={line.explanation}
                      className="text-[11px] text-slate-500 mt-0.5 animate-content-swap"
                    >
                      {line.explanation}
                    </div>
                  </div>
                ))}

                {products.map((p) => {
                  const qty = productCart[p.id];
                  if (!qty) return null;
                  return (
                    <div
                      key={p.id}
                      className="flex justify-between gap-2 text-[13px] text-slate-700 pb-2 border-b border-slate-100 last:border-none last:pb-0 animate-content-swap"
                    >
                      <span>
                        {p.name} × {qty}
                      </span>
                      <span
                        key={qty}
                        className="font-mono font-medium tabular-nums shrink-0 animate-content-swap"
                      >
                        {formatRupiah(p.price * qty)}
                      </span>
                    </div>
                  );
                })}

                {summary.totalAmount === 0 && (
                  <p className="text-slate-400 text-center py-6 text-xs animate-content-swap">
                    Belum ada layanan atau sachet yang dipilih
                  </p>
                )}
              </div>

              {/* Customer Name */}
              <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Bu Rini / Mas Tian"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-sm text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                />
              </div>

              {/* Total */}
              <div className="pt-3 border-t border-slate-200/80 flex justify-between items-baseline">
                <span className="text-xs font-semibold text-slate-600">Total Tagihan</span>
                <span
                  key={summary.totalAmount}
                  className="text-2xl font-mono font-semibold text-blue-700 tabular-nums animate-content-swap"
                >
                  {formatRupiah(summary.totalAmount)}
                </span>
              </div>

              {/* Payment Method Segmented Toggle */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-sm border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("QRIS")}
                  className={`py-2 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "QRIS"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-blue-700"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QRIS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`py-2 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "CASH"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-blue-700"
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Tunai</span>
                </button>
              </div>

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  paymentMethod === "CASH"
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                }`}
                aria-hidden={paymentMethod !== "CASH"}
              >
                <div className="overflow-hidden">
                  <div className="space-y-2.5 pt-0.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Uang Diterima (Rp)
                    </label>
                    <input
                      type="number"
                      tabIndex={paymentMethod === "CASH" ? 0 : -1}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-sm text-sm font-mono font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[summary.totalAmount, 20000, 50000, 100000]
                        .filter((v) => v > 0)
                        .map((val, idx) => (
                          <button
                            key={idx}
                            type="button"
                            tabIndex={paymentMethod === "CASH" ? 0 : -1}
                            onClick={() => setCashReceived(String(val))}
                            className="text-xs px-2.5 py-1 rounded-sm border border-slate-200 bg-white hover:bg-blue-50/70 hover:border-blue-300 font-medium text-slate-700 tabular-nums cursor-pointer transition-colors"
                          >
                            {idx === 0 ? "Uang Pas" : formatRupiah(val)}
                          </button>
                        ))}
                    </div>
                    {cashNum > 0 && (
                      <p
                        key={cashChange}
                        className={`text-xs font-mono font-semibold tabular-nums animate-content-swap ${
                          cashChange < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {cashChange < 0
                          ? `Kurang ${formatRupiah(Math.abs(cashChange))}`
                          : `Kembalian: ${formatRupiah(cashChange)}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={submitting || summary.totalAmount === 0 || Boolean(pendingQris)}
                className="w-full py-3 px-4 rounded-sm bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting
                  ? "Memproses..."
                  : paymentMethod === "CASH"
                  ? "Proses Pembayaran Tunai"
                  : "Tampilkan QRIS ke Pelanggan"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}