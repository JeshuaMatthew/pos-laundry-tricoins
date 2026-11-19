import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getMidtransStatus } from "@/lib/midtrans";
import { settleQrisOrder } from "@/lib/order-service";
import { notifyDisplayUpdate } from "@/lib/pusher";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { services: true, products: true },
  });

  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

  if (order.paymentStatus !== PaymentStatus.PENDING || !order.midtransOrderId) {
    return NextResponse.json({ order });
  }

  const mtStatus = await getMidtransStatus(order.midtransOrderId);
  const txStatus = mtStatus.transaction_status;

  if (txStatus === "settlement" || txStatus === "capture") {
    const settled = await settleQrisOrder(order.id);
    return NextResponse.json({ order: settled });
  }

  if (txStatus === "expire" || txStatus === "cancel" || txStatus === "deny") {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: txStatus === "expire" ? PaymentStatus.EXPIRED : PaymentStatus.CANCELLED,
        isOnDisplay: false,
      },
      include: { services: true, products: true },
    });
    await notifyDisplayUpdate({ type: "DISPLAY_CLEARED", orderId: order.id });
    return NextResponse.json({ order: updated });
  }

  return NextResponse.json({ order });
}