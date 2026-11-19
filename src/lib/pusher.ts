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
  pusherServer: Pusher | undefined;
  activeCustomerCart: LiveCartPayload | null | undefined;
};

export function getActiveCustomerCart(): LiveCartPayload | null {
  return globalForPusher.activeCustomerCart || null;
}

export function setActiveCustomerCart(cart: LiveCartPayload | null) {
  globalForPusher.activeCustomerCart = cart;
}

export const pusherServer =
  globalForPusher.pusherServer ??
  new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPusher.pusherServer = pusherServer;
}

export async function notifyDisplayUpdate(payload: {
  type: "QRIS_CREATED" | "ORDER_PAID" | "DISPLAY_CLEARED";
  orderId?: string;
}) {
  try {
    await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENT_DISPLAY_UPDATE, payload);
  } catch (error) {
    console.error("Pusher trigger gagal:", error);
  }
}

export async function notifyCartUpdate(cart: LiveCartPayload | null) {
  setActiveCustomerCart(cart);
  try {
    await pusherServer.trigger(PUSHER_CHANNEL, PUSHER_EVENT_CART_UPDATE, cart);
  } catch (error) {
    console.error("Pusher cart trigger gagal:", error);
  }
}