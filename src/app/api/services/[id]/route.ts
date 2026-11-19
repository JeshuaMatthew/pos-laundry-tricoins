import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
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
    const existing = await prisma.service.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    const nextImageUrl =
      body.imageUrl !== undefined
        ? body.imageUrl
          ? String(body.imageUrl).trim()
          : null
        : undefined;

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).trim() }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.washerCount !== undefined && { washerCount: Number(body.washerCount) }),
        ...(body.dryerCount !== undefined && { dryerCount: Number(body.dryerCount) }),
        ...(body.maxWeightKg !== undefined && {
          maxWeightKg: body.maxWeightKg ? Number(body.maxWeightKg) : null,
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

    return NextResponse.json({ service });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengupdate layanan";
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
    const existing = await prisma.service.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    const orderCount = await prisma.orderService.count({ where: { serviceId: id } });
    if (orderCount > 0) {
      await prisma.service.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: "Layanan telah dinonaktifkan karena memiliki riwayat transaksi.",
        softDeleted: true,
      });
    }

    await prisma.service.delete({ where: { id } });
    if (existing?.imageUrl) {
      await deleteImageByUrl(existing.imageUrl);
    }

    return NextResponse.json({ ok: true, message: "Layanan berhasil dihapus permanen." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus layanan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
