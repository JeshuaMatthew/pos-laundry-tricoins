import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("all") === "true";

    const services = await prisma.service.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    });
    return NextResponse.json({ services });
  } catch (err) {
    console.error("GET /api/services error:", err);
    return NextResponse.json({ services: [], error: "Gagal memuat layanan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const service = await prisma.service.create({
      data: {
        name: String(body.name).trim(),
        price: Number(body.price),
        washerCount: Number(body.washerCount || 0),
        dryerCount: Number(body.dryerCount || 0),
        maxWeightKg: body.maxWeightKg ? Number(body.maxWeightKg) : null,
        imageUrl: body.imageUrl ? String(body.imageUrl).trim() : null,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : 0,
      },
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/services error:", err);
    const message = err instanceof Error ? err.message : "Gagal menambahkan layanan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}