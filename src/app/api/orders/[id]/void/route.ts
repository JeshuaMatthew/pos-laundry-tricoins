import { NextResponse } from "next/server";
import { PaymentStatus, Role, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const voided = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!order) throw new Error("Order tidak ditemukan");
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new Error("Hanya order LUNAS yang bisa di-void");
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        paymentStatus: PaymentStatus.VOID,
        isOnDisplay: false,
      },
    });

    // Kembalikan stok sachet
    for (const item of order.products) {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
      });
      const stockBefore = product.currentStock;
      const stockAfter = stockBefore + item.qty;

      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: stockAfter },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: StockMovementType.IN_VOID,
          qtyChange: item.qty,
          stockBefore,
          stockAfter,
          referenceType: "ORDER",
          referenceId: order.id,
          notes: `Void transaksi ${order.invoiceNumber}`,
          createdById: session.userId,
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ order: voided });
}