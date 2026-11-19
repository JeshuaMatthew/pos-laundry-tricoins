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
  return parts.length > 0 ? parts.join(" + ") : "Mesin";
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
        explanation = `Berat ${rawNum} kg (≤ ${maxKg} kg) → 1x (${machineText})`;
      } else {
        explanation = `Berat ${rawNum} kg (> ${(multiplier - 1) * maxKg} kg) → ${multiplier}x (${machineText})`;
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
      explanation = `${pcs} sprei → ${multiplier}x (${machineText})`;
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
      explanation = `${pcs} selimut besar → ${multiplier}x (${machineText})`;
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
      explanation = `${pcs} selimut kecil → ${multiplier}x (${machineText}, maks 2/mesin)`;
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
  const [customerName, setCustomerName] = useState("");

  const [serviceConfigs, setServiceConfigs] = useState<Record<string, ServiceConfig>>({});
  const [productCart, setProductCart] = useState<Record<string, number>>({});

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("QRIS");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    loadMasterData();
  }, [loadMasterData]);

  const resetCart = useCallback(() => {
    setCustomerName("");
    setServiceConfigs({});
    setProductCart({});
    setCashReceived("");
  }, []);

  // Dengarkan Pusher jika QRIS yang sedang menunggu ternyata sudah dibayar
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

  // Sinkronisasi otomatis ringkasan transaksi ke Layar Pelanggan (Customer Display)
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

    // 1. Sinkronisasi instan via BroadcastChannel (untuk multi-layar / tab di perangkat yang sama)
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const bc = new BroadcastChannel("tricoins-pos-sync");
        bc.postMessage({ type: "CART_SYNC", cart: cartPayload });
        bc.close();
      }
    } catch {
      // Abaikan jika tidak didukung
    }

    // 2. Sinkronisasi via HTTP API + Pusher (untuk tablet pelanggan / perangkat eksternal)
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
      // Abaikan jika network error
    }
    setPendingQris(null);
    setErrorMsg("QRIS dibatalkan. Anda bisa ganti ke Cash atau buat ulang.");
  }

  return (
    <AppShell>
      {successMsg && (
        <div className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
          </span>
          <button onClick={() => setSuccessMsg("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
          </span>
          <button onClick={() => setErrorMsg("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pendingQris && (
        <div className="mb-4 p-4 rounded-md bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-blue-900">
              QRIS sedang tampil di Layar Pelanggan ({pendingQris.invoiceNumber})
            </p>
            <p className="text-sm text-blue-700">
              {pendingQris.customerName} • Total:{" "}
              <strong>{formatRupiah(pendingQris.totalAmount)}</strong> • Menunggu scan...
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCheckStatus}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Cek Status Midtrans
            </button>
            <button
              onClick={handleCancelQris}
              className="px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
            >
              Batalkan / Ganti Cash
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Layanan Berbasis Berat & Sachet */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Daftar Layanan Mesin */}
          <div className="space-y-3">
            <h2 className="font-bold text-slate-900 text-base">
              1. Pilih Layanan Mesin
            </h2>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {services.map((s) => {
                const config = serviceConfigs[s.id];
                const metrics = calculateServiceMetrics(s, config);
                const category = getServiceCategory(s.name);
                const maxKg = s.maxWeightKg && s.maxWeightKg > 0 ? s.maxWeightKg : 8;

                return (
                  <div
                    key={s.id}
                    className={`rounded-md border transition overflow-hidden bg-white ${
                      metrics.isSelected
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div
                      onClick={() => toggleService(s)}
                      className="p-3.5 cursor-pointer flex items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {s.imageUrl ? (
                          <img
                            src={s.imageUrl}
                            alt={s.name}
                            className="w-12 h-12 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 text-base">
                            <Shirt className="w-6 h-6 text-blue-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 truncate">{s.name}</span>
                            {metrics.isSelected && (
                              <span className="p-0.5 rounded-full bg-blue-600 text-white shrink-0">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <strong className="text-slate-700">{formatRupiah(s.price)}</strong>
                            {category === "WEIGHT_BASED"
                              ? ` / ${maxKg} kg (${formatMachineLabel(s.washerCount, s.dryerCount)})`
                              : ` • ${formatMachineLabel(s.washerCount, s.dryerCount)}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {metrics.isSelected && (
                      <div className="p-3.5 bg-blue-50/70 border-t border-blue-100 space-y-3">
                        {category === "WEIGHT_BASED" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                <Scale className="w-3.5 h-3.5 text-blue-600" />
                                Berapa kilo kain untuk layanan ini?
                              </label>
                              <button
                                type="button"
                                onClick={() => toggleService(s)}
                                className="text-[11px] text-red-600 hover:underline font-semibold"
                              >
                                Batalkan
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                                value={config?.value || ""}
                                onChange={(e) => updateServiceValue(s.id, e.target.value)}
                                placeholder="Timbang kain (contoh: 10.5)"
                                className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-md text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs font-bold text-slate-600 bg-white px-2 py-1.5 border border-blue-200 rounded-md">
                                kg
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              <span className="text-[10px] font-semibold text-slate-500 mr-1">
                                Cepat:
                              </span>
                              {[5, 8, 10, 12, 16, 20].map((kg) => (
                                <button
                                  key={kg}
                                  type="button"
                                  onClick={() => updateServiceValue(s.id, String(kg))}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white hover:bg-blue-100 border border-blue-200 text-blue-700 transition"
                                >
                                  {kg} kg
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {category === "SPREI" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-blue-900">
                                Berapa lembar sprei? (1 mesin / sprei)
                              </label>
                              <button
                                type="button"
                                onClick={() => toggleService(s)}
                                className="text-[11px] text-red-600 hover:underline font-semibold"
                              >
                                Batalkan
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateServiceValue(
                                    s.id,
                                    String(Math.max(1, Number(config?.value || 1) - 1))
                                  )
                                }
                                className="p-1.5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 text-slate-700"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={config?.value || ""}
                                onChange={(e) => updateServiceValue(s.id, e.target.value)}
                                className="w-20 text-center px-2 py-1.5 bg-white border border-blue-300 rounded-md text-sm font-bold text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateServiceValue(
                                    s.id,
                                    String(Number(config?.value || 0) + 1)
                                  )
                                }
                                className="p-1.5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 text-slate-700"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-semibold text-slate-600">
                                lembar sprei
                              </span>
                            </div>
                          </div>
                        )}

                        {category === "SELIMUT_BESAR" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-blue-900">
                                Berapa lembar selimut besar? (1 mesin / selimut)
                              </label>
                              <button
                                type="button"
                                onClick={() => toggleService(s)}
                                className="text-[11px] text-red-600 hover:underline font-semibold"
                              >
                                Batalkan
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateServiceValue(
                                    s.id,
                                    String(Math.max(1, Number(config?.value || 1) - 1))
                                  )
                                }
                                className="p-1.5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 text-slate-700"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={config?.value || ""}
                                onChange={(e) => updateServiceValue(s.id, e.target.value)}
                                className="w-20 text-center px-2 py-1.5 bg-white border border-blue-300 rounded-md text-sm font-bold text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateServiceValue(
                                    s.id,
                                    String(Number(config?.value || 0) + 1)
                                  )
                                }
                                className="p-1.5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 text-slate-700"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-semibold text-slate-600">
                                lembar selimut besar
                              </span>
                            </div>
                          </div>
                        )}

                        {category === "SELIMUT_KECIL" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-blue-900">
                                Berapa lembar selimut kecil? (Maks. 2 per mesin)
                              </label>
                              <button
                                type="button"
                                onClick={() => toggleService(s)}
                                className="text-[11px] text-red-600 hover:underline font-semibold"
                              >
                                Batalkan
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateServiceValue(
                                    s.id,
                                    String(Math.max(1, Number(config?.value || 1) - 1))
                                  )
                                }
                                className="p-1.5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 text-slate-700"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={config?.value || ""}
                                onChange={(e) => updateServiceValue(s.id, e.target.value)}
                                className="w-20 text-center px-2 py-1.5 bg-white border border-blue-300 rounded-md text-sm font-bold text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateServiceValue(
                                    s.id,
                                    String(Number(config?.value || 0) + 1)
                                  )
                                }
                                className="p-1.5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 text-slate-700"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-semibold text-slate-600">
                                lembar (maks 2/mesin)
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="text-xs font-semibold bg-white p-2.5 rounded-md border border-blue-200 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                          <span className="text-blue-950 font-medium">
                            {metrics.explanation}
                          </span>
                          <span className="text-sm font-black text-blue-700">
                            {formatRupiah(metrics.subtotal)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Add-on Sachet */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-slate-900 text-base">
                  2. Add-On Sachet (Deterjen, Pengharum, Parfum)
                </h2>
                <p className="text-xs text-slate-500">
                  Tambahkan jika pelanggan membutuhkan sabun atau pewangi
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {products.map((p) => {
                const qty = productCart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-md border bg-white flex flex-col justify-between gap-2 transition ${
                      qty > 0
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-12 h-12 rounded-md object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 text-base">
                          {p.category === "DETERGENT" ? (
                            <Droplets className="w-6 h-6 text-blue-600" />
                          ) : p.category === "SOFTENER" ? (
                            <Sparkles className="w-6 h-6 text-pink-500" />
                          ) : (
                            <Package className="w-6 h-6 text-purple-600" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {CATEGORY_LABEL[p.category]}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              p.currentStock <= 0 ? "text-red-600" : "text-slate-500"
                            }`}
                          >
                            {p.currentStock} pcs
                          </span>
                        </div>
                        <p className="font-semibold text-xs mt-1 text-slate-900 truncate" title={p.name}>
                          {p.name}
                        </p>
                        <p className="text-xs font-bold text-blue-600">{formatRupiah(p.price)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {qty > 0 && (
                        <>
                          <button
                            onClick={() => updateProductQty(p.id, -1)}
                            className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm">{qty}</span>
                        </>
                      )}
                      <button
                        onClick={() => updateProductQty(p.id, 1)}
                        className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Ringkasan Order & Pembayaran */}
        <div className="bg-white p-5 rounded-md border border-slate-200 h-fit sticky top-20 space-y-4 shadow-sm">
          <h2 className="font-bold text-lg border-b border-slate-100 pb-2">
            Ringkasan Transaksi
          </h2>

          <div className="flex justify-around text-xs bg-slate-50 p-3 rounded-md border border-slate-200/60">
            <div>
              <span className="text-slate-500 block">Washer:</span>
              <strong className="text-blue-600 font-bold">{summary.totalWasher} Mesin</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Dryer:</span>
              <strong className="text-indigo-600 font-bold">{summary.totalDryer} Mesin</strong>
            </div>
          </div>
          <div className="space-y-2 text-sm max-h-56 overflow-y-auto pr-1">
            {summary.activeServiceLines.map((line) => (
              <div
                key={line.service.id}
                className="py-1.5 border-b border-slate-100/60 last:border-none"
              >
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>
                    {line.service.name} ({line.multiplier}x)
                  </span>
                  <span>{formatRupiah(line.subtotal)}</span>
                </div>
                <div className="text-[11px] text-slate-500">{line.explanation}</div>
              </div>
            ))}

            {products.map((p) => {
              const qty = productCart[p.id];
              if (!qty) return null;
              return (
                <div
                  key={p.id}
                  className="flex justify-between text-slate-600 py-1 border-b border-slate-100/60 last:border-none"
                >
                  <span>
                    {p.name} × {qty}
                  </span>
                  <span className="font-medium">{formatRupiah(p.price * qty)}</span>
                </div>
              );
            })}

            {summary.totalAmount === 0 && (
              <p className="text-slate-400 text-center py-6 text-xs">
                Belum ada layanan yang dipilih
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Nama Pelanggan <span className="text-red-500">*</span>:
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Bu Rini / Mas Tian"
                className="w-full sm:w-56 px-3 py-1.5 border border-slate-300 rounded-md text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

          <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
            <span className="font-semibold text-slate-700">Total Tagihan</span>
            <span className="text-2xl font-black text-blue-600">
              {formatRupiah(summary.totalAmount)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("QRIS")}
              className={`py-2.5 rounded-md border text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                paymentMethod === "QRIS"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <QrCode className="w-4 h-4" />
              QRIS
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("CASH")}
              className={`py-2.5 rounded-md border text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                paymentMethod === "CASH"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Banknote className="w-4 h-4" />
              Cash
            </button>
          </div>

          {paymentMethod === "CASH" && (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-slate-600">
                Uang Diterima (Rp)
              </label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-semibold"
              />
              <div className="flex flex-wrap gap-1.5">
                {[summary.totalAmount, 20000, 50000, 100000]
                  .filter((v) => v > 0)
                  .map((val, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashReceived(String(val))}
                      className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 font-medium"
                    >
                      {idx === 0 ? "Uang Pas" : formatRupiah(val)}
                    </button>
                  ))}
              </div>
              {cashNum > 0 && (
                <p
                  className={`text-sm font-bold ${
                    cashChange < 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {cashChange < 0
                    ? `Kurang ${formatRupiah(Math.abs(cashChange))}`
                    : `Kembalian: ${formatRupiah(cashChange)}`}
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={submitting || summary.totalAmount === 0 || Boolean(pendingQris)}
            className="w-full py-3.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 shadow-md transition"
          >
            {submitting
              ? "Memproses..."
              : paymentMethod === "CASH"
              ? "Proses Bayar Cash"
              : "Tampilkan QRIS ke Layar Pelanggan"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}