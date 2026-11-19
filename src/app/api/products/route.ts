import { NextResponse } from "next/server";
import { ProductCategory, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("all") === "true";

    const products = await prisma.product.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ products });
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ products: [], error: "Gagal memuat produk" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const product = await prisma.product.create({
      data: {
        name: String(body.name).trim(),
        category: body.category as ProductCategory,
        price: Number(body.price),
        currentStock: Number(body.currentStock || 0),
        minStockAlert: Number(body.minStockAlert || 10),
        packName: body.packName ? String(body.packName).trim() : null,
        packQty: body.packQty ? Number(body.packQty) : null,
        imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : 0,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/products error:", err);
    const message = err instanceof Error ? err.message : "Gagal menambahkan produk";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}