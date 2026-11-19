import { NextResponse } from "next/server";
import { OpnameStatus, Role, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;

    const approved = await prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!opname || opname.status === OpnameStatus.APPROVED) {
        throw new Error("Opname tidak valid atau sudah di-approve");
      }

      for (const item of opname.items) {
        if (item.physicalStock === null) continue;

        const product = await tx.product.findUniqueOrThrow({
          where: { id: item.productId },
        });

        const stockBefore = product.currentStock;
        const stockAfter = item.physicalStock;
        const qtyChange = stockAfter - stockBefore;

        if (qtyChange !== 0) {
          await tx.product.update({
            where: { id: product.id },
            data: { currentStock: stockAfter },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: StockMovementType.OPNAME_ADJUSTMENT,
              qtyChange,
              stockBefore,
              stockAfter,
              referenceType: "OPNAME",
              referenceId: opname.id,
              notes: item.notes || "Penyesuaian Stock Opname",
              createdById: session.userId,
            },
          });
        }
      }

      return tx.stockOpname.update({
        where: { id },
        data: {
          status: OpnameStatus.APPROVED,
          approvedById: session.userId,
          approvedAt: new Date(),
        },
        include: { items: { include: { product: true } } },
      });
    });

    return NextResponse.json({ opname: approved });
  } catch (err) {
    console.error("POST /api/opname/[id]/approve error:", err);
    const message = err instanceof Error ? err.message : "Gagal approve opname";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
