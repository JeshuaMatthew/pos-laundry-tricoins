"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Droplets,
  Package,
  Receipt,
  Scale,
  Shirt,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import {
  getPusherClient,
  PUSHER_CHANNEL,
  PUSHER_EVENT_CART_UPDATE,
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

interface ActiveOrder {
  id: string;
  invoiceNumber: string;
  customerName: string;
  weightKg: number | null;
  totalAmount: number;
  paymentMethod?: "QRIS" | "CASH";
  cashReceived?: number | null;
  cashChange?: number | null;
  paymentStatus: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "VOID";
  qrisString: string | null;
  qrisExpiredAt: string | null;
  services: { id: string; serviceName: string; qty: number; subtotal: number }[];
  products: { id: string; productName: string; qty: number; subtotal: number }[];
}

interface LiveCartItem {
  id: string;
  name: string;
  qty: number;
  subtotal: number;
  explanation?: string;
  category?: string;
}

interface LiveCart {
  customerName: string;
  totalAmount: number;
  totalWasher: number;
  totalDryer: number;
  totalWeight: number;
  services: LiveCartItem[];
  products: LiveCartItem[];
}

const CATEGORY_NAMES: Record<Product["category"], string> = {
  DETERGENT: "Deterjen",
  SOFTENER: "Pengharum",
  PERFUME: "Parfum",
};

export default function CustomerDisplayPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [liveCart, setLiveCart] = useState<LiveCart | null>(null);
  const [catalogTab, setCatalogTab] = useState<"ALL" | "SERVICES" | "PRODUCTS">("ALL");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Jam digital live
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  function handleCopyUrl() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const fetchDisplayData = useCallback(async () => {
    try {
      const res = await fetch("/api/customer-display", { cache: "no-store" });
      if (!res.ok) return;
      const text = await res.text();
      if (!text || text.trim() === "") return;
      const data = JSON.parse(text);
      setServices(data.services || []);
      setProducts(data.products || []);
      setActiveOrder(data.activeOrder || null);
      if (data.liveCart) {
        setLiveCart(data.liveCart);
      }
    } catch (err) {
      console.error("Gagal memuat customer display:", err);
    }
  }, []);

  // 1. Sinkronisasi instan via BroadcastChannel (0ms delay pada perangkat lokal / dual-monitor)
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    const bc = new BroadcastChannel("tricoins-pos-sync");
    bc.onmessage = (event) => {
      if (event.data?.type === "CART_SYNC") {
        setLiveCart(event.data.cart || null);
      }
    };

    return () => {
      bc.close();
    };
  }, []);

  // 2. Pusher WebSocket (untuk tablet pelanggan via jaringan)
  useEffect(() => {
    fetchDisplayData();

    const pusher = getPusherClient();
    const channel = pusher.subscribe(PUSHER_CHANNEL);

    channel.bind(
      PUSHER_EVENT_DISPLAY_UPDATE,
      (payload: { type: "QRIS_CREATED" | "ORDER_PAID" | "DISPLAY_CLEARED" }) => {
        if (payload.type === "DISPLAY_CLEARED") {
          setActiveOrder(null);
          return;
        }
        fetchDisplayData();
      }
    );

    channel.bind(PUSHER_EVENT_CART_UPDATE, (cart: LiveCart | null) => {
      setLiveCart(cart);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(PUSHER_CHANNEL);
    };
  }, [fetchDisplayData]);

  // Kembali ke standby setelah 8 detik jika status PAID
  useEffect(() => {
    if (activeOrder?.paymentStatus === "PAID") {
      setLiveCart(null);
      const timer = setTimeout(() => {
        setActiveOrder(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [activeOrder]);

  // Countdown QRIS
  useEffect(() => {
    if (!activeOrder || activeOrder.paymentStatus !== "PENDING" || !activeOrder.qrisExpiredAt) {
      setTimeLeft("");
      return;
    }

    const updateTimer = () => {
      const diff = new Date(activeOrder.qrisExpiredAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Kedaluwarsa");
        setActiveOrder(null);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeOrder]);

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* 1. Header Bar Sleek & Ramping */}
      <header className="h-13 px-4 md:px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm md:text-base text-white tracking-tight">
                Laundry Tricoins
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded-md">
                Layar Pelanggan
              </span>
            </div>
          </div>
        </div>

        {/* Tab Filter Katalog (Sleek Navigation) */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
          <button
            onClick={() => setCatalogTab("ALL")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              catalogTab === "ALL"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Semua Menu
          </button>
          <button
            onClick={() => setCatalogTab("SERVICES")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              catalogTab === "SERVICES"
                ? "bg-slate-800 text-blue-400 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            Layanan Mesin ({services.length})
          </button>
          <button
            onClick={() => setCatalogTab("PRODUCTS")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              catalogTab === "PRODUCTS"
                ? "bg-slate-800 text-emerald-400 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Add-On Sachet ({products.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentTime && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
              <Clock className="w-3 h-3 text-blue-400" />
              <span>{currentTime}</span>
            </div>
          )}
          <button
            onClick={handleCopyUrl}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 rounded-md transition"
            title="Salin URL Layar Pelanggan"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden md:inline">{copied ? "Tersalin" : "Salin URL"}</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Viewport (Locked to remaining screen height, ZERO SCROLL) */}
      <main className="flex-1 min-h-0 p-3 md:p-4 grid grid-cols-12 gap-4 overflow-hidden">
        {/* Kolom Kiri: Katalog Showcase Layanan & Sachet (Gambar Besar) */}
        <section className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 h-full overflow-hidden">
          {/* Tampilan Tab: SEMUA (Bagi rata 2 seksi yang muat dalam viewport) */}
          {catalogTab === "ALL" && (
            <div className="flex flex-col h-full min-h-0 gap-3">
              {/* Seksi Layanan Mesin */}
              <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-md p-3 overflow-hidden">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wide">
                    <Shirt className="w-3.5 h-3.5 text-blue-400" />
                    Layanan Mesin Cuci & Kering
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Self-Service Coin</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {services.map((s) => (
                      <div
                        key={s.id}
                        className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden flex flex-col justify-between hover:border-slate-700 transition shadow-xs"
                      >
                        <div className="w-full h-24 sm:h-28 bg-slate-800 relative overflow-hidden flex items-center justify-center shrink-0">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <Shirt className="w-8 h-8 text-blue-400/80 stroke-1" />
                            </div>
                          )}
                          <div className="absolute top-1.5 right-1.5 bg-slate-950/85 border border-slate-800 text-blue-400 text-[11px] font-black px-1.5 py-0.5 rounded-md">
                            {formatRupiah(s.price)}
                          </div>
                        </div>

                        <div className="p-2 space-y-1">
                          <h3 className="font-bold text-xs text-white truncate" title={s.name}>
                            {s.name}
                          </h3>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span className="px-1.5 py-0.2 rounded bg-blue-950/80 text-blue-300 border border-blue-900/40">
                              {s.washerCount} Cuci
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-900/40">
                              {s.dryerCount} Kering
                            </span>
                            {s.maxWeightKg && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                {s.maxWeightKg} kg
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seksi Add-On Sachet */}
              <div className="h-44 sm:h-48 shrink-0 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-md p-3 overflow-hidden">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wide">
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    Add-On Sachet (Deterjen, Pengharum, Parfum)
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Original Sachet</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden flex flex-col justify-between hover:border-slate-700 transition shadow-xs"
                      >
                        <div className="w-full h-18 sm:h-20 bg-slate-800 relative overflow-hidden flex items-center justify-center shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center justify-center text-slate-500">
                              {p.category === "DETERGENT" ? (
                                <Droplets className="w-6 h-6 text-blue-400 stroke-1" />
                              ) : p.category === "SOFTENER" ? (
                                <Sparkles className="w-6 h-6 text-pink-400 stroke-1" />
                              ) : (
                                <Package className="w-6 h-6 text-purple-400 stroke-1" />
                              )}
                            </div>
                          )}
                          <span className="absolute top-1 left-1 text-[9px] font-bold px-1 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
                            {CATEGORY_NAMES[p.category]}
                          </span>
                        </div>

                        <div className="p-1.5 flex items-center justify-between gap-1">
                          <h4 className="font-semibold text-[11px] text-white truncate" title={p.name}>
                            {p.name}
                          </h4>
                          <span className="font-black text-xs text-emerald-400 shrink-0">
                            {formatRupiah(p.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tampilan Tab: HANYA LAYANAN MESIN (Full height showcase) */}
          {catalogTab === "SERVICES" && (
            <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-md p-3.5 overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-blue-400" />
                  <h2 className="font-bold text-sm text-white">Layanan Mesin Cuci & Kering</h2>
                </div>
                <span className="text-xs text-slate-400">{services.length} Pilihan Mesin</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {services.map((s) => (
                    <div
                      key={s.id}
                      className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden flex flex-col justify-between hover:border-slate-700 transition"
                    >
                      <div className="w-full h-36 bg-slate-800 relative overflow-hidden flex items-center justify-center">
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <Shirt className="w-12 h-12 text-blue-400/80 stroke-1" />
                        )}
                        <div className="absolute top-2 right-2 bg-slate-950/85 border border-slate-800 text-blue-400 text-xs font-black px-2 py-0.5 rounded-md">
                          {formatRupiah(s.price)}
                        </div>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <h3 className="font-bold text-sm text-white truncate">{s.name}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900/50">
                            {s.washerCount} Mesin Cuci
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-900/50">
                            {s.dryerCount} Mesin Kering
                          </span>
                          {s.maxWeightKg && (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              Maks. {s.maxWeightKg} kg
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tampilan Tab: HANYA ADD-ON SACHET (Full height showcase) */}
          {catalogTab === "PRODUCTS" && (
            <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-md p-3.5 overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-bold text-sm text-white">Add-On Sachet (Deterjen, Pengharum, Parfum)</h2>
                </div>
                <span className="text-xs text-slate-400">{products.length} Pilihan Sachet</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-900 border border-slate-800 rounded-md overflow-hidden flex flex-col justify-between hover:border-slate-700 transition"
                    >
                      <div className="w-full h-28 bg-slate-800 relative overflow-hidden flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center text-slate-500">
                            {p.category === "DETERGENT" ? (
                              <Droplets className="w-8 h-8 text-blue-400 stroke-1" />
                            ) : p.category === "SOFTENER" ? (
                              <Sparkles className="w-8 h-8 text-pink-400 stroke-1" />
                            ) : (
                              <Package className="w-8 h-8 text-purple-400 stroke-1" />
                            )}
                          </div>
                        )}
                        <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950/85 border border-slate-800 text-slate-300">
                          {CATEGORY_NAMES[p.category]}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <h4 className="font-bold text-xs text-white truncate">{p.name}</h4>
                        <div className="mt-1 font-black text-sm text-emerald-400">
                          {formatRupiah(p.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Kolom Kanan: Panel Ringkasan Transaksi POS (Sleek, Fixed Height) */}
        <aside className="col-span-12 lg:col-span-5 xl:col-span-4 h-full min-h-0 flex flex-col bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-xl">
          {/* KONDISI 1: Pembayaran LUNAS */}
          {activeOrder?.paymentStatus === "PAID" ? (
            <div className="h-full flex flex-col justify-between p-5 bg-emerald-950/60 border border-emerald-500/40 text-white animate-in fade-in duration-200">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      Sukses
                    </span>
                    <h3 className="text-lg font-black text-white mt-0.5">PEMBAYARAN LUNAS</h3>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-emerald-800/40 rounded-md p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Pelanggan:</span>
                    <strong className="text-white text-sm">{activeOrder.customerName}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Invoice:</span>
                    <span className="font-mono text-slate-300">{activeOrder.invoiceNumber}</span>
                  </div>
                  {activeOrder.paymentMethod && (
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Metode:</span>
                      <span className="font-bold text-emerald-400">{activeOrder.paymentMethod}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 space-y-1 max-h-36 overflow-y-auto">
                    {activeOrder.services.map((s) => (
                      <div key={s.id} className="flex justify-between text-slate-300">
                        <span>{s.serviceName} × {s.qty}</span>
                        <span className="font-semibold">{formatRupiah(s.subtotal)}</span>
                      </div>
                    ))}
                    {activeOrder.products.map((p) => (
                      <div key={p.id} className="flex justify-between text-slate-400">
                        <span>{p.productName} × {p.qty}</span>
                        <span className="font-semibold text-slate-300">{formatRupiah(p.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  {activeOrder.cashChange !== null && activeOrder.cashChange !== undefined && activeOrder.cashChange > 0 && (
                    <div className="p-2 rounded-md bg-emerald-900/40 border border-emerald-600/30 flex justify-between items-center text-xs mt-2">
                      <span className="text-emerald-200">Uang Kembalian:</span>
                      <strong className="text-sm font-black text-emerald-300">
                        {formatRupiah(activeOrder.cashChange)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-emerald-900/30 rounded-md border border-emerald-700/30 text-center">
                <span className="text-xs text-slate-300 block">Total Pembayaran</span>
                <span className="text-2xl font-black text-emerald-400">
                  {formatRupiah(activeOrder.totalAmount)}
                </span>
                <p className="text-[11px] text-emerald-200/80 mt-1">
                  Silakan masukkan pakaian ke mesin cuci / pengering sesuai petunjuk kasir.
                </p>
              </div>
            </div>
          ) : activeOrder?.paymentStatus === "PENDING" && activeOrder.qrisString ? (
            /* KONDISI 2: Scan QRIS */
            <div className="h-full flex flex-col justify-between p-4 bg-slate-900 text-white animate-in fade-in duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Scan QRIS
                    </span>
                  </div>
                  {timeLeft && (
                    <span className="text-xs font-mono font-bold text-red-400 bg-red-950/60 border border-red-800/50 px-2 py-0.5 rounded-md">
                      Sisa: {timeLeft}
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <h3 className="font-bold text-sm text-white">{activeOrder.customerName}</h3>
                  <p className="text-[11px] text-slate-400">Invoice: {activeOrder.invoiceNumber}</p>
                </div>

                {/* QR Code Kompak & Jelas */}
                <div className="bg-white p-3 rounded-md flex flex-col items-center justify-center shadow-md">
                  <QRCodeSVG value={activeOrder.qrisString} size={170} />
                  <span className="text-[10px] text-slate-600 mt-1.5 font-medium">
                    BCA • GoPay • OVO • DANA • ShopeePay • M-Banking
                  </span>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-md p-2.5 space-y-1 text-xs max-h-24 overflow-y-auto">
                  {activeOrder.services.map((s) => (
                    <div key={s.id} className="flex justify-between text-slate-300">
                      <span>{s.serviceName} × {s.qty}</span>
                      <span className="font-semibold">{formatRupiah(s.subtotal)}</span>
                    </div>
                  ))}
                  {activeOrder.products.map((p) => (
                    <div key={p.id} className="flex justify-between text-slate-400">
                      <span>{p.productName} × {p.qty}</span>
                      <span className="font-semibold text-slate-300">{formatRupiah(p.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-md border border-slate-800 flex justify-between items-baseline shrink-0">
                <span className="text-xs text-slate-400 font-semibold">Total Tagihan:</span>
                <span className="text-2xl font-black text-blue-400">
                  {formatRupiah(activeOrder.totalAmount)}
                </span>
              </div>
            </div>
          ) : liveCart && liveCart.totalAmount > 0 ? (
            /* KONDISI 3: Live Cart dari POS (Sedang Diinput Kasir) */
            <div className="h-full flex flex-col justify-between p-4 bg-slate-900 animate-in fade-in duration-150">
              <div className="flex-1 min-h-0 flex flex-col space-y-3">
                {/* Header Live Status */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                    <h3 className="font-bold text-xs text-white uppercase tracking-wider">
                      Pesanan Anda
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded-md">
                    Kasir Sedang Memproses
                  </span>
                </div>

                {/* Info Pelanggan & Mesin */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-md p-2.5 space-y-2 shrink-0">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Nama Pelanggan:</span>
                    <strong className="text-white text-sm">
                      {liveCart.customerName || "Pelanggan Laundry"}
                    </strong>
                  </div>

                  <div className="flex items-center justify-around bg-slate-900/80 py-1.5 px-2 rounded-md border border-slate-800/80 text-[11px]">
                    <div className="text-center">
                      <span className="text-[9px] text-slate-400 block">Mesin Cuci</span>
                      <strong className="text-blue-400 font-bold">{liveCart.totalWasher} Mesin</strong>
                    </div>
                    <div className="w-px h-5 bg-slate-800" />
                    <div className="text-center">
                      <span className="text-[9px] text-slate-400 block">Dryer Kering</span>
                      <strong className="text-indigo-400 font-bold">{liveCart.totalDryer} Mesin</strong>
                    </div>
                    {liveCart.totalWeight > 0 && (
                      <>
                        <div className="w-px h-5 bg-slate-800" />
                        <div className="text-center">
                          <span className="text-[9px] text-slate-400 block">Berat Kain</span>
                          <strong className="text-emerald-400 font-bold">{liveCart.totalWeight} kg</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* List Item yang Sedang Dipilih Kasir (Scroll hanya di dalam box ini jika item banyak) */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                    Daftar Rincian:
                  </span>

                  {liveCart.services.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="p-2 rounded-md bg-slate-950/50 border border-slate-800 space-y-0.5"
                    >
                      <div className="flex justify-between font-semibold text-slate-200">
                        <span>{s.name} ({s.qty}x)</span>
                        <span className="text-white font-bold">{formatRupiah(s.subtotal)}</span>
                      </div>
                      {s.explanation && (
                        <p className="text-[10px] text-slate-400 truncate">{s.explanation}</p>
                      )}
                    </div>
                  ))}

                  {liveCart.products.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-2 rounded-md bg-slate-950/50 border border-slate-800 flex justify-between items-center text-slate-300"
                    >
                      <span className="truncate pr-2">
                        {p.name} × {p.qty}
                      </span>
                      <span className="font-bold text-white shrink-0">{formatRupiah(p.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Banner Bawah (Sticky) */}
              <div className="pt-3 border-t border-slate-800 shrink-0 space-y-2">
                <div className="p-3 bg-slate-950 rounded-md border border-slate-800 flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-slate-400">Total Pembayaran:</span>
                  <span className="text-2xl font-black text-blue-400">
                    {formatRupiah(liveCart.totalAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                  <Zap className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>Silakan periksa detail pesanan Anda sebelum kasir menyelesaikan pembayaran.</span>
                </div>
              </div>
            </div>
          ) : (
            /* KONDISI 4: Standby / Idle (Belum ada pesanan aktif) */
            <div className="h-full flex flex-col justify-between p-5 bg-slate-900 text-center animate-in fade-in duration-150">
              <div className="space-y-4 pt-4">
                <div className="w-11 h-11 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 mx-auto shadow-xs">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Ringkasan Transaksi</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Pesanan Anda yang sedang diinput oleh kasir di meja POS akan langsung muncul di panel ini secara real-time.
                  </p>
                </div>

                <div className="p-3.5 rounded-md bg-slate-950/70 border border-slate-800 text-left space-y-2 text-xs">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-blue-400" />
                    Panduan Self-Service:
                  </div>
                  <ol className="space-y-1 text-slate-400 list-decimal list-inside pl-1 text-[11px] leading-relaxed">
                    <li>Pilih layanan mesin cuci & pengering</li>
                    <li>Pilih deterjen / pewangi sachet</li>
                    <li>Sampaikan ke kasir untuk proses bayar</li>
                  </ol>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950/80 rounded-md border border-slate-800/80 text-[11px] text-slate-500 shrink-0">
                Mendukung Pembayaran QRIS & Tunai
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
