import { NextResponse } from "next/server";
import { ProductCategory, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { deleteImageByUrl } from "@/lib/blob";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const body = await req.json();
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    const nextImageUrl =
      body.imageUrl !== undefined
        ? body.imageUrl
          ? String(body.imageUrl).trim()
          : null
        : undefined;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.category !== undefined && { category: body.category as ProductCategory }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.minStockAlert !== undefined && { minStockAlert: Number(body.minStockAlert) }),
        ...(body.packName !== undefined && {
          packName: body.packName ? String(body.packName).trim() : null,
        }),
        ...(body.packQty !== undefined && {
          packQty: body.packQty ? Number(body.packQty) : null,
        }),
        ...(nextImageUrl !== undefined && { imageUrl: nextImageUrl }),
        ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
      },
    });

    if (
      nextImageUrl !== undefined &&
      existing?.imageUrl &&
      existing.imageUrl !== nextImageUrl
    ) {
      await deleteImageByUrl(existing.imageUrl);
    }

    return NextResponse.json({ product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengupdate produk";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    const [orderCount, movementCount, opnameCount] = await Promise.all([
      prisma.orderProduct.count({ where: { productId: id } }),
      prisma.stockMovement.count({ where: { productId: id } }),
      prisma.stockOpnameItem.count({ where: { productId: id } }),
    ]);

    if (orderCount > 0 || movementCount > 0 || opnameCount > 0) {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: "Produk telah dinonaktifkan karena memiliki riwayat transaksi/stok.",
        softDeleted: true,
      });
    }

    await prisma.product.delete({ where: { id } });
    if (existing?.imageUrl) {
      await deleteImageByUrl(existing.imageUrl);
    }

    return NextResponse.json({ ok: true, message: "Produk berhasil dihapus permanen." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus produk";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
