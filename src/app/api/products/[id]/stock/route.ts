import { NextResponse } from "next/server";
import { Role, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const movements = await prisma.stockMovement.findMany({
    where: { productId: id },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ movements });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { action, qty, usePack, notes } = await req.json();
  // action: "RESTOCK" | "DAMAGED"

  const inputQty = Number(qty);
  if (!inputQty || inputQty <= 0) {
    return NextResponse.json({ error: "Jumlah harus lebih dari 0" }, { status: 400 });
  }

  const updatedProduct = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id } });

    let pcsQty = inputQty;
    if (action === "RESTOCK" && usePack && product.packQty) {
      pcsQty = inputQty * product.packQty;
    }

    const isRestock = action === "RESTOCK";
    const qtyChange = isRestock ? pcsQty : -pcsQty;
    const stockBefore = product.currentStock;
    const stockAfter = stockBefore + qtyChange;

    const updated = await tx.product.update({
      where: { id },
      data: { currentStock: stockAfter },
    });

    await tx.stockMovement.create({
      data: {
        productId: id,
        type: isRestock ? StockMovementType.IN_RESTOCK : StockMovementType.OUT_DAMAGED,
        qtyChange,
        stockBefore,
        stockAfter,
        referenceType: "MANUAL",
        notes:
          notes ||
          (isRestock
            ? `Restock ${usePack && product.packName ? `${inputQty} ${product.packName} (${pcsQty} pcs)` : `${pcsQty} pcs`}`
            : `Barang rusak/internal (${pcsQty} pcs)`),
        createdById: session.userId,
      },
    });

    return updated;
  });

  return NextResponse.json({ product: updatedProduct });
}