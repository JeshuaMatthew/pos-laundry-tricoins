import { NextResponse } from "next/server";
import { OpnameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const opnames = await prisma.stockOpname.findMany({
      include: {
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        items: { include: { product: true } },
      },
      orderBy: { opnameDate: "desc" },
      take: 30,
    });

    return NextResponse.json({ opnames });
  } catch (err) {
    console.error("GET /api/opname error:", err);
    return NextResponse.json({ opnames: [], error: "Gagal memuat daftar opname" }, { status: 500 });
  }
}

export async function POST() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const openOpname = await prisma.stockOpname.findFirst({
      where: { status: { in: [OpnameStatus.DRAFT, OpnameStatus.SUBMITTED] } },
    });

    if (openOpname) {
      return NextResponse.json(
        { error: "Masih ada sesi Stock Opname yang belum di-approve. Selesaikan atau approve dulu sebelum membuat sesi baru." },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    if (products.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada produk aktif. Tambahkan produk sachet terlebih dahulu." },
        { status: 400 }
      );
    }

    const opname = await prisma.stockOpname.create({
      data: {
        createdById: session.userId,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            systemStock: p.currentStock,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    return NextResponse.json({ opname }, { status: 201 });
  } catch (err) {
    console.error("POST /api/opname error:", err);
    const message = err instanceof Error ? err.message : "Gagal memulai sesi opname";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
