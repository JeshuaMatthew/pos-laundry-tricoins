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
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      pusherClientInstance = {
        subscribe: () => ({
          bind: () => {},
          unbind_all: () => {},
        }),
        unsubscribe: () => {},
      };
    } else {
      pusherClientInstance = new PusherClient(key, {
        cluster,
      }) as unknown as PusherLike;
    }
  }
  return pusherClientInstance;
}