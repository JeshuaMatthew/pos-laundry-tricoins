import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { cancelMidtransTransaction } from "@/lib/midtrans";
import { notifyDisplayUpdate } from "@/lib/pusher";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });

  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  if (order.paymentStatus !== PaymentStatus.PENDING) {
    return NextResponse.json(
      { error: "Hanya order PENDING yang bisa dibatalkan" },
      { status: 400 }
    );
  }

  if (order.midtransOrderId) {
    try {
      await cancelMidtransTransaction(order.midtransOrderId);
    } catch {
      // Abaikan jika sudah expired di Midtrans
    }
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      paymentStatus: PaymentStatus.CANCELLED,
      isOnDisplay: false,
    },
  });

  await notifyDisplayUpdate({ type: "DISPLAY_CLEARED", orderId: id });
  return NextResponse.json({ order: updated });
}