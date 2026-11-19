import { NextResponse } from "next/server";
import { PaymentMethod, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Awal hari WIB (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    const startOfDayWib = new Date(
      Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()) - wibOffset
    );

    const todayOrders = await prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: { gte: startOfDayWib },
      },
    });

    let cashTotal = 0;
    let qrisTotal = 0;
    let washerTotal = 0;
    let dryerTotal = 0;

    for (const o of todayOrders) {
      if (o.paymentMethod === PaymentMethod.CASH) cashTotal += o.totalAmount;
      if (o.paymentMethod === PaymentMethod.QRIS) qrisTotal += o.totalAmount;
      washerTotal += o.totalWasher;
      dryerTotal += o.totalDryer;
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { currentStock: "asc" },
    });

    const lowStockProducts = products.filter(
      (p) => p.currentStock <= p.minStockAlert
    );

    return NextResponse.json({
      today: {
        orderCount: todayOrders.length,
        cashTotal,
        qrisTotal,
        grandTotal: cashTotal + qrisTotal,
        washerTotal,
        dryerTotal,
      },
      lowStockProducts,
    });
  } catch (err) {
    console.error("GET /api/dashboard error:", err);
    return NextResponse.json({ error: "Gagal memuat ringkasan dashboard" }, { status: 500 });
  }
}