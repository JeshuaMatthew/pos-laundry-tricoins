import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveCustomerCart, getOrderQrisUrl, notifyDisplayUpdate } from "@/lib/pusher";
import { getMidtransStatus } from "@/lib/midtrans";
import { settleQrisOrder } from "@/lib/order-service";

export async function GET() {
  try {
    const [services, products] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { category: "asc" }, { name: "asc" }],
      }),
    ]);

    let activeOrder = await prisma.order.findFirst({
      where: { isOnDisplay: true },
      include: { services: true, products: true },
      orderBy: { createdAt: "desc" },
    });

    if (activeOrder) {
      const now = new Date();

      // Jika QRIS sudah expired
      if (
        activeOrder.paymentStatus === PaymentStatus.PENDING &&
        activeOrder.qrisExpiredAt &&
        activeOrder.qrisExpiredAt < now
      ) {
        await prisma.order.update({
          where: { id: activeOrder.id },
          data: { paymentStatus: PaymentStatus.EXPIRED, isOnDisplay: false },
        });
        activeOrder = null;
      }

      // Detektor otomatis: Jika ada order PENDING di layar, cek status langsung ke Midtrans
      if (
        activeOrder &&
        activeOrder.paymentStatus === PaymentStatus.PENDING &&
        activeOrder.midtransOrderId
      ) {
        try {
          const mtStatus = await getMidtransStatus(activeOrder.midtransOrderId);
          const txStatus = mtStatus?.transaction_status;
          if (txStatus === "settlement" || txStatus === "capture") {
            const settled = await settleQrisOrder(activeOrder.id);
            if (settled) {
              activeOrder = settled;
            }
          } else if (txStatus === "expire" || txStatus === "cancel" || txStatus === "deny") {
            activeOrder = await prisma.order.update({
              where: { id: activeOrder.id },
              data: {
                paymentStatus: txStatus === "expire" ? PaymentStatus.EXPIRED : PaymentStatus.CANCELLED,
                isOnDisplay: false,
              },
              include: { services: true, products: true },
            });
            await notifyDisplayUpdate({ type: "DISPLAY_CLEARED", orderId: activeOrder.id });
          }
        } catch (detectorErr) {
          console.warn("Auto-detector Midtrans warning di customer-display:", detectorErr);
        }
      }

      // Jika sudah PAID lebih dari 15 detik, jangan tampilkan lagi saat browser di-refresh
      if (
        activeOrder &&
        activeOrder.paymentStatus === PaymentStatus.PAID &&
        activeOrder.paidAt &&
        now.getTime() - activeOrder.paidAt.getTime() > 15000
      ) {
        await prisma.order.update({
          where: { id: activeOrder.id },
          data: { isOnDisplay: false },
        });
        activeOrder = null;
      }
    }

    const liveCart = getActiveCustomerCart();
    const enrichedActiveOrder = activeOrder
      ? {
          ...activeOrder,
          qrisUrl:
            getOrderQrisUrl(activeOrder.id) ||
            (activeOrder.midtransOrderId
              ? `https://api.sandbox.midtrans.com/v2/qris/${activeOrder.midtransOrderId}/qr-code`
              : activeOrder.qrisString),
        }
      : null;

    return NextResponse.json({
      services,
      products,
      activeOrder: enrichedActiveOrder,
      liveCart,
    });
  } catch (err) {
    console.error("GET /api/customer-display error:", err);
    return NextResponse.json(
      { services: [], products: [], activeOrder: null, liveCart: null },
      { status: 500 }
    );
  }
}