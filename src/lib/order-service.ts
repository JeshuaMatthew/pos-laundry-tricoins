import { PaymentStatus, Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "./prisma";
import { notifyDisplayUpdate } from "./pusher";

export function generateInvoiceNumber() {
  const now = new Date();
  // Format tanggal WIB (UTC+7)
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wib.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

export async function deductOrderStockTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  invoiceNumber: string
) {
  const orderProducts = await tx.orderProduct.findMany({
    where: { orderId },
  });

  for (const item of orderProducts) {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: item.productId },
    });

    const stockBefore = product.currentStock;
    const stockAfter = stockBefore - item.qty; // Boleh minus

    await tx.product.update({
      where: { id: item.productId },
      data: { currentStock: stockAfter },
    });

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        type: StockMovementType.OUT_SALE,
        qtyChange: -item.qty,
        stockBefore,
        stockAfter,
        referenceType: "ORDER",
        referenceId: orderId,
        notes: `Penjualan ${invoiceNumber}`,
        createdById: userId,
      },
    });
  }
}

export async function settleQrisOrder(orderId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        services: true,
        products: true,
      },
    });

    if (!order) return null;

    // Idempotency check: jika sudah PAID, jangan potong stok lagi!
    if (order.paymentStatus === PaymentStatus.PAID) {
      return { order, alreadyPaid: true };
    }

    if (
      order.paymentStatus === PaymentStatus.CANCELLED ||
      order.paymentStatus === PaymentStatus.VOID
    ) {
      return { order, alreadyPaid: false, ignored: true };
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
      },
      include: {
        services: true,
        products: true,
      },
    });

    await deductOrderStockTx(
      tx,
      updatedOrder.id,
      updatedOrder.createdById,
      updatedOrder.invoiceNumber
    );

    return { order: updatedOrder, alreadyPaid: false };
  });

  if (result && !result.alreadyPaid && !result.ignored) {
    await notifyDisplayUpdate({
      type: "ORDER_PAID",
      orderId: result.order.id,
    });
  }

  return result?.order ?? null;
}