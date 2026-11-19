import { NextResponse } from "next/server";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { chargeQris } from "@/lib/midtrans";
import { notifyCartUpdate, notifyDisplayUpdate } from "@/lib/pusher";
import { deductOrderStockTx, generateInvoiceNumber } from "@/lib/order-service";

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 50);

    const orders = await prisma.order.findMany({
      include: {
        services: true,
        products: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ orders });
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ orders: [], error: "Gagal memuat daftar order" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const customerName = String(body.customerName || "").trim();
    if (!customerName) {
      return NextResponse.json(
        { error: "Nama pelanggan wajib diisi" },
        { status: 400 }
      );
    }
    const weightKg = body.weightKg ? Number(body.weightKg) : null;
    const paymentMethod = body.paymentMethod as PaymentMethod;
    const cashReceived = body.cashReceived ? Number(body.cashReceived) : null;

    const serviceItems: { serviceId: string; qty: number }[] = body.services || [];
    const productItems: { productId: string; qty: number }[] = body.products || [];

    if (serviceItems.length === 0 && productItems.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal 1 layanan atau item sachet" },
        { status: 400 }
      );
    }

    // Ambil harga asli dari DB (anti manipulasi harga dari client)
    const dbServices = await prisma.service.findMany({
      where: { id: { in: serviceItems.map((s) => s.serviceId) }, isActive: true },
    });
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productItems.map((p) => p.productId) }, isActive: true },
    });

    let totalWasher = 0;
    let totalDryer = 0;
    let totalAmount = 0;

    const orderServicesData = serviceItems.map((item) => {
      const svc = dbServices.find((s) => s.id === item.serviceId);
      if (!svc || item.qty <= 0) throw new Error("Layanan tidak valid");
      const subtotal = svc.price * item.qty;
      totalWasher += svc.washerCount * item.qty;
      totalDryer += svc.dryerCount * item.qty;
      totalAmount += subtotal;
      return {
        serviceId: svc.id,
        serviceName: svc.name,
        qty: item.qty,
        unitPrice: svc.price,
        washerCount: svc.washerCount * item.qty,
        dryerCount: svc.dryerCount * item.qty,
        subtotal,
      };
    });

    const orderProductsData = productItems.map((item) => {
      const prod = dbProducts.find((p) => p.id === item.productId);
      if (!prod || item.qty <= 0) throw new Error("Produk tidak valid");
      const subtotal = prod.price * item.qty;
      totalAmount += subtotal;
      return {
        productId: prod.id,
        productName: prod.name,
        qty: item.qty,
        unitPrice: prod.price,
        subtotal,
      };
    });

    const invoiceNumber = generateInvoiceNumber();

    if (paymentMethod === PaymentMethod.CASH) {
      if (cashReceived === null || cashReceived < totalAmount) {
        return NextResponse.json(
          { error: "Uang tunai yang diterima kurang dari total tagihan" },
          { status: 400 }
        );
      }

      const cashChange = cashReceived - totalAmount;

      const order = await prisma.$transaction(async (tx) => {
        // Matikan tampilan order sebelumnya di customer display
        await tx.order.updateMany({
          where: { isOnDisplay: true },
          data: { isOnDisplay: false },
        });

        const created = await tx.order.create({
          data: {
            invoiceNumber,
            customerName,
            weightKg,
            totalWasher,
            totalDryer,
            totalAmount,
            paymentMethod: PaymentMethod.CASH,
            paymentStatus: PaymentStatus.PAID,
            isOnDisplay: true,
            cashReceived,
            cashChange,
            paidAt: new Date(),
            createdById: session.userId,
            services: { create: orderServicesData },
            products: { create: orderProductsData },
          },
          include: { services: true, products: true },
        });

        await deductOrderStockTx(tx, created.id, session.userId, created.invoiceNumber);
        return created;
      });

      await notifyDisplayUpdate({ type: "ORDER_PAID", orderId: order.id });
      await notifyCartUpdate(null);

      return NextResponse.json({ order }, { status: 201 });
    }

    // Jika QRIS Midtrans
    const midtransOrderId = `${invoiceNumber}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const qris = await chargeQris({
      orderId: midtransOrderId,
      grossAmount: totalAmount,
      customerName,
    });

    const order = await prisma.$transaction(async (tx) => {
      // Matikan tampilan QRIS sebelumnya di customer display
      await tx.order.updateMany({
        where: { isOnDisplay: true },
        data: { isOnDisplay: false },
      });

      return tx.order.create({
        data: {
          invoiceNumber,
          customerName,
          weightKg,
          totalWasher,
          totalDryer,
          totalAmount,
          paymentMethod: PaymentMethod.QRIS,
          paymentStatus: PaymentStatus.PENDING,
          midtransOrderId,
          qrisString: qris.qrString,
          qrisExpiredAt: qris.expiryTime,
          isOnDisplay: true,
          createdById: session.userId,
          services: { create: orderServicesData },
          products: { create: orderProductsData },
        },
        include: { services: true, products: true },
      });
    });

    await notifyDisplayUpdate({ type: "QRIS_CREATED", orderId: order.id });
    await notifyCartUpdate(null);

    return NextResponse.json({ order }, { status: 201 });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Gagal membuat order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}