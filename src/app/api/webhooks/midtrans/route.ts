import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyMidtransSignature } from "@/lib/midtrans";
import { settleQrisOrder } from "@/lib/order-service";
import { notifyDisplayUpdate } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body;

    const isValid = verifyMidtransSignature({
      orderId: String(order_id),
      statusCode: String(status_code),
      grossAmount: String(gross_amount),
      signatureKey: String(signature_key),
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { midtransOrderId: String(order_id) },
    });

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 200 });
    }

    if (
      transaction_status === "settlement" ||
      (transaction_status === "capture" && fraud_status === "accept")
    ) {
      await settleQrisOrder(order.id);
    } else if (["expire", "cancel", "deny"].includes(transaction_status)) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus:
            transaction_status === "expire"
              ? PaymentStatus.EXPIRED
              : PaymentStatus.CANCELLED,
          isOnDisplay: false,
        },
      });
      await notifyDisplayUpdate({ type: "DISPLAY_CLEARED", orderId: order.id });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Midtrans webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}