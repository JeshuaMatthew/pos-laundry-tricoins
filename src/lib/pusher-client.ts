"use client";

import PusherClient from "pusher-js";

export const PUSHER_CHANNEL = "laundry-pos";
export const PUSHER_EVENT_DISPLAY_UPDATE = "display-updated";
export const PUSHER_EVENT_CART_UPDATE = "cart-updated";

let pusherClientInstance: PusherClient | null = null;

export function getPusherClient() {
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(
      process.env.NEXT_PUBLIC_PUSHER_KEY!,
      {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      }
    );
  }
  return pusherClientInstance;
}