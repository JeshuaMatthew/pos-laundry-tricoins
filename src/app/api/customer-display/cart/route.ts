import { NextResponse } from "next/server";
import {
  getActiveCustomerCart,
  LiveCartPayload,
  notifyCartUpdate,
  setActiveCustomerCart,
} from "@/lib/pusher";

export async function GET() {
  const cart = getActiveCustomerCart();
  return NextResponse.json({ cart });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cart = (body.cart ?? null) as LiveCartPayload | null;
    setActiveCustomerCart(cart);
    await notifyCartUpdate(cart);
    return NextResponse.json({ success: true, cart });
  } catch (err) {
    console.error("Gagal update live cart customer display:", err);
    return NextResponse.json({ error: "Gagal update cart" }, { status: 500 });
  }
}
