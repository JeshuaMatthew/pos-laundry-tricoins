"use client";

import PusherClient from "pusher-js";

export const PUSHER_CHANNEL = "laundry-pos";
export const PUSHER_EVENT_DISPLAY_UPDATE = "display-updated";
export const PUSHER_EVENT_CART_UPDATE = "cart-updated";

interface PusherChannelStub {
  bind: (event: string, cb: (data: never) => void) => void;
  unbind_all: () => void;
}

interface PusherLike {
  subscribe: (channelName: string) => PusherChannelStub;
  unsubscribe: (channelName: string) => void;
}

let pusherClientInstance: PusherLike | null = null;

export function getPusherClient(): PusherLike {
  if (!pusherClientInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1";
    const host = process.env.NEXT_PUBLIC_PUSHER_HOST;
    const port = process.env.NEXT_PUBLIC_PUSHER_PORT;
    const useTLS = process.env.NEXT_PUBLIC_PUSHER_USE_TLS === "true";

    if (!key || key === "xxxx") {
      pusherClientInstance = {
        subscribe: () => ({
          bind: () => {},
          unbind_all: () => {},
        }),
        unsubscribe: () => {},
      };
    } else {
      const clientOptions: Record<string, unknown> = {
        cluster,
      };

      if (host) {
        clientOptions.wsHost = host;
        if (port) {
          const numPort = Number(port);
          clientOptions.wsPort = numPort;
          clientOptions.wssPort = numPort;
        }
        clientOptions.forceTLS = useTLS;
        clientOptions.disableStats = true;
        clientOptions.enabledTransports = ["ws", "wss"];
      }

      pusherClientInstance = new PusherClient(key, clientOptions as never) as unknown as PusherLike;
    }
  }
  return pusherClientInstance;
}