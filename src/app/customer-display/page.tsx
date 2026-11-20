"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Droplets,
  Package,
  Receipt,
  Shirt,
  Sparkles,
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
  midtransOrderId?: string | null;
  qrisString: string | null;
  qrisUrl?: string | null;
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

interface AutoMarqueeRowProps<T> {
  items: T[];
  renderItem: (item: T, widthPx: number | null, keyPrefix: string) => React.ReactNode;
  columnsForCardWidth?: number;
  secondsPerItem?: number;
  className?: string;
}

function AutoMarqueeRow<T>({
  items,
  renderItem,
  columnsForCardWidth,
  secondsPerItem = 3.8,
  className = "",
}: AutoMarqueeRowProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [cardWidth, setCardWidth] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const measure = () => {
      const cw = container.clientWidth;
      if (cw <= 0) return;

      if (columnsForCardWidth && columnsForCardWidth > 0) {
        const gapTotal = 12 * (columnsForCardWidth - 1);
        const computed = Math.max(150, Math.floor((cw - gapTotal) / columnsForCardWidth));
        setCardWidth(computed);
        const estimatedWidth = items.length * computed + Math.max(0, items.length - 1) * 12;
        setShouldScroll(estimatedWidth > cw + 2);
      } else {
        setCardWidth(null);
        setShouldScroll(track.scrollWidth > cw + 2);
      }
    };

    const rafId = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(track);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [items.length, columnsForCardWidth]);

  const duration = Math.max(14, items.length * secondsPerItem);

  return (
    <div ref={containerRef} className={`w-full overflow-hidden ${className}`}>
      <div
        className={
          shouldScroll
            ? "flex w-max h-full items-stretch animate-marquee-left"
            : "flex w-full h-full items-stretch gap-3"
        }
        style={shouldScroll ? { animationDuration: `${duration}s` } : undefined}
      >
        <div
          ref={trackRef}
          className={`flex shrink-0 h-full items-stretch gap-3 ${shouldScroll ? "pr-3" : ""}`}
        >
          {items.map((item) => renderItem(item, cardWidth, "a"))}
        </div>
        {shouldScroll && (
          <div className="flex shrink-0 h-full items-stretch gap-3 pr-3" aria-hidden="true">
            {items.map((item) => renderItem(item, cardWidth, "b"))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerDisplayPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [liveCart, setLiveCart] = useState<LiveCart | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const dismissedPaidOrderIdRef = useRef<string | null>(null);

  const qrisDebugLink =
    activeOrder?.qrisUrl ||
    (activeOrder?.midtransOrderId
      ? `https://api.sandbox.midtrans.com/v2/qris/${activeOrder.midtransOrderId}/qr-code`
      : activeOrder?.qrisString || "");

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

  function handleCopyQrisUrl() {
    if (typeof window === "undefined" || !qrisDebugLink) return;
    navigator.clipboard.writeText(qrisDebugLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      if (data.activeOrder) {
        if (
          data.activeOrder.paymentStatus === "PAID" &&
          data.activeOrder.id === dismissedPaidOrderIdRef.current
        ) {
          setActiveOrder(null);
        } else {
          setActiveOrder((prev) => {
            if (prev?.id === data.activeOrder.id && prev?.paymentStatus === "PAID") {
              return prev;
            }
            return data.activeOrder;
          });
        }
      } else {
        setActiveOrder(null);
      }

      if (data.liveCart) {
        setLiveCart(data.liveCart);
      }
    } catch (err) {
      console.error("Gagal memuat customer display:", err);
    }
  }, []);

  // 1. Sinkronisasi instan via BroadcastChannel & localStorage (0ms antar-tab/layar)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel("tricoins-pos-sync");
      bc.onmessage = (event) => {
        if (event.data?.type === "CART_SYNC") {
          setLiveCart(event.data.cart || null);
        } else if (event.data?.type === "ORDER_DISPLAY_SYNC") {
          if (event.data.action === "DISPLAY_CLEARED") {
            setActiveOrder(null);
          } else if (event.data.order) {
            setActiveOrder(event.data.order);
            setLiveCart(null);
          }
          fetchDisplayData();
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "tricoins_display_sync" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.action === "DISPLAY_CLEARED") {
            setActiveOrder(null);
          } else if (parsed.order) {
            setActiveOrder(parsed.order);
            setLiveCart(null);
          }
          fetchDisplayData();
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchDisplayData]);

  // 2. Pusher WebSocket Listener (untuk tablet pelanggan via jaringan)
  useEffect(() => {
    const initTimer = setTimeout(() => {
      fetchDisplayData();
    }, 0);

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
      clearTimeout(initTimer);
      channel.unbind_all();
      pusher.unsubscribe(PUSHER_CHANNEL);
    };
  }, [fetchDisplayData]);

  // 3. Polling background (fallback otomatis setiap 1.5 detik agar QRIS & update pembayaran
  // selalu muncul otomatis tanpa perlu refresh, baik di dual monitor maupun tablet)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDisplayData();
    }, 1500);

    return () => clearInterval(interval);
  }, [fetchDisplayData]);

  const handlePaidAnimationEnd = useCallback(() => {
    if (activeOrder) {
      dismissedPaidOrderIdRef.current = activeOrder.id;
    }
    setActiveOrder(null);
  }, [activeOrder]);

  // 4. Progress bar 2 detik saat pembayaran sudah masuk, lalu kembali ke tampilan biasa
  useEffect(() => {
    if (activeOrder?.paymentStatus === "PAID") {
      const orderId = activeOrder.id;
      const clearCartTimer = setTimeout(() => {
        setLiveCart(null);
      }, 0);

      const timer = setTimeout(() => {
        dismissedPaidOrderIdRef.current = orderId;
        setActiveOrder(null);
      }, 2000);

      return () => {
        clearTimeout(clearCartTimer);
        clearTimeout(timer);
      };
    }
  }, [activeOrder?.id, activeOrder?.paymentStatus]);

  useEffect(() => {
    if (!activeOrder || activeOrder.paymentStatus !== "PENDING" || !activeOrder.qrisExpiredAt) {
      const clearTime = setTimeout(() => setTimeLeft(""), 0);
      return () => clearTimeout(clearTime);
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

  const rightPanelKey =
    activeOrder?.paymentStatus === "PAID"
      ? `paid-${activeOrder.id}`
      : activeOrder?.paymentStatus === "PENDING" && activeOrder.qrisString
      ? `qris-${activeOrder.id}`
      : liveCart && liveCart.totalAmount > 0
      ? "live-cart"
      : "idle";

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#F4F7FB] text-slate-900 flex flex-col select-none animate-page-enter">
      {/* Top Bar */}
      <header className="h-14 px-4 md:px-6 bg-white border-b border-slate-200/90 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <img
            src="/logo-icon.webp"
            alt="Laundry Tricoins"
            className="w-9 h-9 object-contain shrink-0"
          />
          <span className="font-semibold text-sm md:text-base text-slate-900 tracking-tight">
            Laundry Tricoins
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {currentTime && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentTime}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleCopyQrisUrl}
            disabled={!qrisDebugLink}
            title={qrisDebugLink ? "Salin link QRIS untuk debugging" : "Menunggu QRIS dibuat"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all whitespace-nowrap ${
              qrisDebugLink
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-600/20 cursor-pointer"
                : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copied ? "QRIS Tersalin" : "Salin Link QRIS"}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 p-4 md:p-5 grid grid-cols-12 gap-5 overflow-hidden">
        {/* Left: Catalog Showcase */}
        <section className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 h-full overflow-hidden">
          <div className="flex flex-col h-full min-h-0 gap-4">
              {/* Services */}
              <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200/90 rounded-sm p-4 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <Shirt className="w-4 h-4 text-blue-600" />
                    <span>Layanan Mesin Cuci & Kering</span>
                  </div>
                  <span className="text-xs text-slate-500">Self-Service Coin</span>
                </div>

                {services.length <= 6 ? (
                  <div
                    className={`flex-1 min-h-0 grid grid-cols-2 md:grid-cols-3 gap-3 overflow-hidden ${
                      services.length > 3 ? "grid-rows-2" : "grid-rows-1"
                    }`}
                  >
                    {services.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-sm overflow-hidden flex flex-col justify-between transition-colors h-full min-h-0"
                      >
                        <div className="flex-1 min-h-[68px] w-full bg-gradient-to-br from-blue-50 to-indigo-50/70 relative overflow-hidden flex items-center justify-center">
                          {s.imageUrl ? (
                            <img
                              src={s.imageUrl}
                              alt={s.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Shirt className="w-8 h-8 text-blue-600/80 stroke-[1.5]" />
                          )}
                        </div>

                        <div className="p-2.5 sm:p-3 space-y-1 shrink-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="font-semibold text-xs text-slate-900 truncate" title={s.name}>
                              {s.name}
                            </h3>
                            <span className="font-mono font-semibold text-xs text-blue-600 tabular-nums shrink-0">
                              {formatRupiah(s.price)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums truncate">
                            {s.washerCount} Cuci · {s.dryerCount} Kering
                            {s.maxWeightKg ? ` · ${s.maxWeightKg} kg` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
                    {/* Baris 1: 3 Layanan Pertama Statis */}
                    <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 overflow-hidden">
                      {services.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-sm overflow-hidden flex flex-col justify-between transition-colors h-full min-h-0"
                        >
                          <div className="flex-1 min-h-[68px] w-full bg-gradient-to-br from-blue-50 to-indigo-50/70 relative overflow-hidden flex items-center justify-center">
                            {s.imageUrl ? (
                              <img
                                src={s.imageUrl}
                                alt={s.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Shirt className="w-8 h-8 text-blue-600/80 stroke-[1.5]" />
                            )}
                          </div>

                          <div className="p-2.5 sm:p-3 space-y-1 shrink-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <h3 className="font-semibold text-xs text-slate-900 truncate" title={s.name}>
                                {s.name}
                              </h3>
                              <span className="font-mono font-semibold text-xs text-blue-600 tabular-nums shrink-0">
                                {formatRupiah(s.price)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 tabular-nums truncate">
                              {s.washerCount} Cuci · {s.dryerCount} Kering
                              {s.maxWeightKg ? ` · ${s.maxWeightKg} kg` : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Baris 2: Infinite Auto Scroller ke Kiri */}
                    <AutoMarqueeRow
                      items={services.slice(3)}
                      columnsForCardWidth={3}
                      className="flex-1 min-h-0"
                      renderItem={(s, widthPx, keyPrefix) => (
                        <div
                          key={`${keyPrefix}-${s.id}`}
                          style={widthPx ? { width: widthPx } : undefined}
                          className="shrink-0 bg-white border border-slate-200/90 hover:border-blue-300 rounded-sm overflow-hidden flex flex-col justify-between transition-colors h-full min-h-0"
                        >
                          <div className="flex-1 min-h-[68px] w-full bg-gradient-to-br from-blue-50 to-indigo-50/70 relative overflow-hidden flex items-center justify-center">
                            {s.imageUrl ? (
                              <img
                                src={s.imageUrl}
                                alt={s.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Shirt className="w-8 h-8 text-blue-600/80 stroke-[1.5]" />
                            )}
                          </div>

                          <div className="p-2.5 sm:p-3 space-y-1 shrink-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <h3 className="font-semibold text-xs text-slate-900 truncate" title={s.name}>
                                {s.name}
                              </h3>
                              <span className="font-mono font-semibold text-xs text-blue-600 tabular-nums shrink-0">
                                {formatRupiah(s.price)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 tabular-nums truncate">
                              {s.washerCount} Cuci · {s.dryerCount} Kering
                              {s.maxWeightKg ? ` · ${s.maxWeightKg} kg` : ""}
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Add-On Products: Selalu 1 Baris, Auto-Scroll Infinite ke Kiri jika Overflow */}
              <div className="shrink-0 flex flex-col bg-white border border-slate-200/90 rounded-sm p-4 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Add-On Sachet</span>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">{products.length} item</span>
                </div>

                <AutoMarqueeRow
                  items={products}
                  secondsPerItem={3.5}
                  renderItem={(p, _widthPx, keyPrefix) => (
                    <div
                      key={`${keyPrefix}-${p.id}`}
                      className="w-40 sm:w-44 shrink-0 bg-white border border-slate-200/90 hover:border-blue-300 rounded-sm overflow-hidden flex flex-col justify-between transition-colors"
                    >
                      <div className="w-full h-14 sm:h-16 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 relative overflow-hidden flex items-center justify-center shrink-0">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : p.category === "DETERGENT" ? (
                          <Droplets className="w-5 h-5 text-blue-600 stroke-[1.5]" />
                        ) : p.category === "SOFTENER" ? (
                          <Sparkles className="w-5 h-5 text-sky-600 stroke-[1.5]" />
                        ) : (
                          <Package className="w-5 h-5 text-indigo-600 stroke-[1.5]" />
                        )}
                      </div>

                      <div className="p-2.5 space-y-0.5">
                        <div className="text-[10px] text-slate-500">
                          {CATEGORY_NAMES[p.category]}
                        </div>
                        <div className="flex items-baseline justify-between gap-1.5">
                          <h4 className="font-semibold text-xs text-slate-900 truncate" title={p.name}>
                            {p.name}
                          </h4>
                          <span className="font-mono font-semibold text-xs text-blue-600 tabular-nums shrink-0">
                            {formatRupiah(p.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
        </section>

        {/* Right: Active Transaction / QRIS / Live Cart */}
        <aside className="col-span-12 lg:col-span-5 xl:col-span-4 h-full min-h-0 flex flex-col bg-white border border-slate-200/90 rounded-sm overflow-hidden shadow-xs">
          <div key={rightPanelKey} className="h-full flex flex-col justify-between animate-content-swap">
          {activeOrder?.paymentStatus === "PAID" ? (
            <div className="h-full flex flex-col justify-between">
              <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-white shrink-0" />
                    <div>
                      <div className="text-[11px] font-medium text-emerald-100">Pembayaran Lunas</div>
                      <h3 className="text-base font-semibold text-white">Terima Kasih</h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-100/90 bg-emerald-700/60 px-2 py-0.5 rounded-sm">
                    2s
                  </span>
                </div>
                {/* Progress bar sepanjang 2 detik */}
                <div className="w-full bg-emerald-900/40 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-white rounded-full animate-paid-countdown"
                    onAnimationEnd={handlePaidAnimationEnd}
                  />
                </div>
              </div>

              <div className="flex-1 p-5 space-y-3 text-xs overflow-hidden">
                <div className="flex justify-between text-slate-500">
                  <span>Pelanggan</span>
                  <strong className="text-slate-900 text-sm">{activeOrder.customerName}</strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Invoice</span>
                  <span className="font-mono text-slate-800 tabular-nums">{activeOrder.invoiceNumber}</span>
                </div>
                {activeOrder.paymentMethod && (
                  <div className="flex justify-between text-slate-500">
                    <span>Metode</span>
                    <span className="font-semibold text-emerald-600">{activeOrder.paymentMethod}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  {activeOrder.services.map((s) => (
                    <div key={s.id} className="flex justify-between text-slate-800">
                      <span>{s.serviceName} × {s.qty}</span>
                      <span className="font-mono font-semibold tabular-nums">{formatRupiah(s.subtotal)}</span>
                    </div>
                  ))}
                  {activeOrder.products.map((p) => (
                    <div key={p.id} className="flex justify-between text-slate-600">
                      <span>{p.productName} × {p.qty}</span>
                      <span className="font-mono font-semibold tabular-nums">{formatRupiah(p.subtotal)}</span>
                    </div>
                  ))}
                </div>

                {activeOrder.cashChange !== null && activeOrder.cashChange !== undefined && activeOrder.cashChange > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500">Kembalian</span>
                    <strong className="font-mono text-sm font-semibold text-emerald-600 tabular-nums">
                      {formatRupiah(activeOrder.cashChange)}
                    </strong>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 bg-emerald-50/70 border-t border-emerald-100 text-center space-y-1 shrink-0">
                <span className="text-xs text-slate-500 block">Total Pembayaran</span>
                <span className="text-2xl font-mono font-semibold text-emerald-600 tabular-nums">
                  {formatRupiah(activeOrder.totalAmount)}
                </span>
              </div>
            </div>
          ) : activeOrder?.paymentStatus === "PENDING" && activeOrder.qrisString ? (
            <div className="h-full flex flex-col justify-between">
              <div className="px-5 py-3.5 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold">Scan Pembayaran QRIS</span>
                {timeLeft && (
                  <span className="text-xs font-mono font-semibold text-blue-100 tabular-nums">
                    Sisa {timeLeft}
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0 p-4 flex flex-col justify-between gap-2.5 overflow-hidden">
                <div className="text-center shrink-0">
                  <h3 className="font-semibold text-sm text-slate-900">{activeOrder.customerName}</h3>
                  <p className="text-xs font-mono text-slate-500 tabular-nums">{activeOrder.invoiceNumber}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/60 border border-blue-100 p-3.5 rounded-sm flex flex-col items-center justify-center shrink-0">
                  <div className="bg-white p-2 rounded-sm border border-slate-200/80 shadow-xs">
                    <QRCodeSVG value={activeOrder.qrisString} size={148} />
                  </div>
                  <span className="text-[11px] text-slate-600 mt-2 font-medium">
                    BCA · GoPay · OVO · DANA · ShopeePay
                  </span>
                </div>

                <div className="space-y-1 text-xs overflow-hidden">
                  {activeOrder.services.map((s) => (
                    <div key={s.id} className="flex justify-between text-slate-800">
                      <span className="truncate pr-2">{s.serviceName} × {s.qty}</span>
                      <span className="font-mono font-semibold tabular-nums shrink-0">{formatRupiah(s.subtotal)}</span>
                    </div>
                  ))}
                  {activeOrder.products.map((p) => (
                    <div key={p.id} className="flex justify-between text-slate-600">
                      <span className="truncate pr-2">{p.productName} × {p.qty}</span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums shrink-0">{formatRupiah(p.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border-t border-blue-100 flex justify-between items-baseline shrink-0">
                <span className="text-xs text-slate-600 font-medium">Total Tagihan</span>
                <span className="text-2xl font-mono font-semibold text-blue-700 tabular-nums">
                  {formatRupiah(activeOrder.totalAmount)}
                </span>
              </div>
            </div>
          ) : liveCart && liveCart.totalAmount > 0 ? (
            <div className="h-full flex flex-col justify-between">
              <div className="px-5 py-3.5 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm">Pesanan Anda</h3>
                <span className="text-xs font-medium text-blue-100">Diproses</span>
              </div>

              <div className="flex-1 min-h-0 flex flex-col p-5 space-y-4 overflow-hidden">
                <div className="space-y-3 shrink-0">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Pelanggan</span>
                    <strong className="text-slate-900 text-sm">
                      {liveCart.customerName || "Pelanggan Laundry"}
                    </strong>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-blue-100 py-2 bg-blue-50/60 rounded-sm border border-blue-100 text-center text-xs tabular-nums">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Cuci</span>
                      <strong className="text-blue-700 font-mono">{liveCart.totalWasher}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Dryer</span>
                      <strong className="text-indigo-700 font-mono">{liveCart.totalDryer}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Berat</span>
                      <strong className="text-emerald-700 font-mono">
                        {liveCart.totalWeight > 0 ? `${liveCart.totalWeight} kg` : "-"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden divide-y divide-slate-100 text-xs">
                  {liveCart.services.map((s, idx) => (
                    <div key={s.id || idx} className="py-2 space-y-0.5">
                      <div className="flex justify-between font-medium text-slate-900">
                        <span className="truncate pr-2">{s.name} ({s.qty}x)</span>
                        <span className="font-mono font-semibold tabular-nums shrink-0">{formatRupiah(s.subtotal)}</span>
                      </div>
                      {s.explanation && (
                        <p className="text-[11px] text-slate-500 truncate">{s.explanation}</p>
                      )}
                    </div>
                  ))}

                  {liveCart.products.map((p, idx) => (
                    <div key={p.id || idx} className="py-2 flex justify-between items-center text-slate-600">
                      <span className="truncate pr-2">{p.name} × {p.qty}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                        {formatRupiah(p.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border-t border-blue-100 shrink-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-medium text-slate-600">Total</span>
                  <span
                    key={liveCart.totalAmount}
                    className="text-2xl font-mono font-semibold text-blue-700 tabular-nums animate-content-swap"
                  >
                    {formatRupiah(liveCart.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-between">
              <div className="px-5 py-3.5 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shrink-0">
                <h3 className="font-semibold text-sm">Ringkasan Transaksi</h3>
              </div>

              <div className="p-6 text-center space-y-4">
                <div className="w-11 h-11 rounded-sm bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto">
                  <Receipt className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-500">
                  Pesanan akan tampil otomatis di sini.
                </p>

                <div className="pt-4 border-t border-slate-100 text-left space-y-1.5 text-xs text-slate-500">
                  <div className="font-semibold text-slate-900">Cara Order</div>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Pilih layanan mesin</li>
                    <li>Tambah sachet jika perlu</li>
                    <li>Bayar QRIS atau tunai di kasir</li>
                  </ol>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-100 text-center text-xs text-slate-400 shrink-0">
                QRIS & Tunai
              </div>
            </div>
          )}
          </div>
        </aside>
      </main>
    </div>
  );
}
