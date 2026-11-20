import Pusher from "pusher";

export const PUSHER_CHANNEL = "laundry-pos";
export const PUSHER_EVENT_DISPLAY_UPDATE = "display-updated";
export const PUSHER_EVENT_CART_UPDATE = "cart-updated";

export interface LiveCartItem {
  id: string;
  name: string;
  qty: number;
  subtotal: number;
  explanation?: string;
  category?: string;
}

export interface LiveCartPayload {
  customerName: string;
  totalAmount: number;
  totalWasher: number;
  totalDryer: number;
  totalWeight: number;
  services: LiveCartItem[];
  products: LiveCartItem[];
}

const globalForPusher = globalThis as unknown as {
  pusherServer: Pusher | null | undefined;
  activeCustomerCart: LiveCartPayload | null | undefined;
  qrisUrlMap: Map<string, string> | undefined;
};

function getQrisUrlMap(): Map<string, string> {
  if (!globalForPusher.qrisUrlMap) {
    globalForPusher.qrisUrlMap = new Map<string, string>();
  }
  return globalForPusher.qrisUrlMap;
}

export function setOrderQrisUrl(orderId: string, url: string | null) {
  if (!url) return;
  getQrisUrlMap().set(orderId, url);
}

export function getOrderQrisUrl(orderId: string): string | null {
  return getQrisUrlMap().get(orderId) || null;
}

export function getActiveCustomerCart(): LiveCartPayload | null {
  return globalForPusher.activeCustomerCart || null;
}

export function setActiveCustomerCart(cart: LiveCartPayload | null) {
  globalForPusher.activeCustomerCart = cart;
}

function createPusherServer(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1";
  const host = process.env.PUSHER_HOST;
  const port = process.env.PUSHER_PORT;
  const useTLS = process.env.PUSHER_USE_TLS === "true";

  if (
    !appId ||
    !key ||
    !secret ||
    appId === "xxxx" ||
    key === "xxxx" ||
    secret === "xxxx"
  ) {
    return null;
  }

  if (host) {
    return new Pusher({
      appId,
      key,
      secret,
      host,
      port: port || undefined,
      useTLS,
    });
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

export const pusherServer =
  globalForPusher.pusherServer !== undefined
    ? globalForPusher.pusherServer
    : createPusherServer();

if (process.env.NODE_ENV !== "production") {
  globalForPusher.pusherServer = pusherServer;
}

export async function notifyDisplayUpdate(payload: {
  type: "QRIS_CREATED" | "ORDER_PAID" | "DISPLAY_CLEARED";
  orderId?: string;
}) {
  if (!pusherServer) return;
  try {
    await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENT_DISPLAY_UPDATE, payload);
  } catch (error) {
    console.error("Pusher trigger gagal:", error);
  }
}

export async function notifyCartUpdate(cart: LiveCartPayload | null) {
  setActiveCustomerCart(cart);
  if (!pusherServer) return;
  try {
    await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENT_CART_UPDATE, cart);
  } catch (error) {
    console.error("Pusher cart trigger gagal:", error);
  }
}