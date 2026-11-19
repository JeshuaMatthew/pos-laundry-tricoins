import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: Request) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { items } = await req.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Data urutan tidak valid" }, { status: 400 });
    }

    await prisma.$transaction(
      items.map((item: { id: string; sortOrder: number }) =>
        prisma.product.update({
          where: { id: item.id },
          data: { sortOrder: Number(item.sortOrder) },
        })
      )
    );

    return NextResponse.json({ ok: true, message: "Urutan produk berhasil disimpan" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengatur urutan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
