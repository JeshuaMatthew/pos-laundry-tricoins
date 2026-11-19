import { NextResponse } from "next/server";
import { OpnameStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const opnames = await prisma.stockOpname.findMany({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        items: { include: { product: true } },
      },
    });

    return NextResponse.json({ opnames });
  } catch (err) {
    console.error("GET /api/opname/[id] error:", err);
    return NextResponse.json({ error: "Gagal memuat opname" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const { items, submit } = await req.json();
    // items: Array<{ id: string; physicalStock: number | null; notes: string | null }>

    const opname = await prisma.stockOpname.findUnique({ where: { id } });
    if (!opname) return NextResponse.json({ error: "Opname tidak ditemukan" }, { status: 404 });
    if (opname.status === OpnameStatus.APPROVED) {
      return NextResponse.json({ error: "Opname sudah di-approve dan tidak bisa diubah" }, { status: 400 });
    }

    // Update setiap item
    for (const item of items) {
      const diff =
        item.physicalStock !== null
          ? item.physicalStock - (await prisma.stockOpnameItem.findUnique({ where: { id: item.id } }))!.systemStock
          : null;

      await prisma.stockOpnameItem.update({
        where: { id: item.id },
        data: {
          physicalStock: item.physicalStock,
          difference: diff,
          notes: item.notes,
        },
      });
    }

    // Update status opname
    const updatedOpname = await prisma.stockOpname.update({
      where: { id },
      data: {
        status: submit ? OpnameStatus.SUBMITTED : OpnameStatus.DRAFT,
      },
      include: {
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ opname: updatedOpname });
  } catch (err) {
    console.error("PATCH /api/opname/[id] error:", err);
    const message = err instanceof Error ? err.message : "Gagal menyimpan opname";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
