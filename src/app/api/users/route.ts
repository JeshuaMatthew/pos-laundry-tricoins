import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users, currentUserId: session.userId });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ users: [], error: "Gagal memuat daftar pengguna" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const roleInput = String(body.role || "CASHIER").toUpperCase();
    const role = roleInput === Role.OWNER ? Role.OWNER : Role.CASHIER;

    if (!name) {
      return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    }
    if (username.length < 3 || !/^[a-z0-9._-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username minimal 3 karakter (huruf kecil, angka, titik, atau underscore)" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
      select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: "Gagal menambahkan pengguna" }, { status: 500 });
  }
}