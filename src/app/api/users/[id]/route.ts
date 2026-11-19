import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();

    const nextRole =
      body.role !== undefined
        ? String(body.role).toUpperCase() === Role.OWNER
          ? Role.OWNER
          : Role.CASHIER
        : existing.role;
    const nextIsActive =
      body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive;

    // Cegah menonaktifkan atau menurunkan role akun yang sedang dipakai
    if (id === session.userId) {
      if (!nextIsActive) {
        return NextResponse.json(
          { error: "Tidak dapat menonaktifkan akun yang sedang digunakan" },
          { status: 400 }
        );
      }
      if (nextRole !== Role.OWNER) {
        return NextResponse.json(
          { error: "Tidak dapat mengubah peran akun sendiri menjadi Kasir" },
          { status: 400 }
        );
      }
    }

    // Pastikan selalu ada minimal 1 akun Owner di aplikasi & minimal 1 Owner aktif
    if (existing.role === Role.OWNER) {
      if (nextRole !== Role.OWNER) {
        const otherOwners = await prisma.user.count({
          where: { role: Role.OWNER, id: { not: id } },
        });
        if (otherOwners === 0) {
          return NextResponse.json(
            { error: "Minimal harus ada 1 akun Owner di aplikasi" },
            { status: 400 }
          );
        }
      }

      if (existing.isActive && (nextRole !== Role.OWNER || !nextIsActive)) {
        const otherActiveOwners = await prisma.user.count({
          where: { role: Role.OWNER, isActive: true, id: { not: id } },
        });
        if (otherActiveOwners === 0) {
          return NextResponse.json(
            { error: "Minimal harus ada 1 akun Owner aktif di aplikasi" },
            { status: 400 }
          );
        }
      }
    }

    let nextName = existing.name;
    if (body.name !== undefined) {
      nextName = String(body.name).trim();
      if (!nextName) {
        return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
      }
    }

    let nextUsername = existing.username;
    if (body.username !== undefined) {
      nextUsername = String(body.username).trim().toLowerCase();
      if (nextUsername.length < 3 || !/^[a-z0-9._-]+$/.test(nextUsername)) {
        return NextResponse.json(
          { error: "Username minimal 3 karakter (huruf kecil, angka, titik, atau underscore)" },
          { status: 400 }
        );
      }
      if (nextUsername !== existing.username) {
        const dup = await prisma.user.findFirst({
          where: { username: nextUsername, id: { not: id } },
        });
        if (dup) {
          return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 });
        }
      }
    }

    let passwordHashUpdate: string | undefined;
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
      }
      passwordHashUpdate = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: nextName,
        username: nextUsername,
        role: nextRole,
        isActive: nextIsActive,
        ...(passwordHashUpdate ? { passwordHash: passwordHashUpdate } : {}),
      },
      select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error("PATCH /api/users/[id] error:", err);
    return NextResponse.json({ error: "Gagal memperbarui pengguna" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    if (id === session.userId) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus akun yang sedang digunakan" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    if (existing.role === Role.OWNER) {
      const otherOwners = await prisma.user.count({
        where: { role: Role.OWNER, id: { not: id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { error: "Minimal harus ada 1 akun Owner di aplikasi" },
          { status: 400 }
        );
      }

      if (existing.isActive) {
        const otherActiveOwners = await prisma.user.count({
          where: { role: Role.OWNER, isActive: true, id: { not: id } },
        });
        if (otherActiveOwners === 0) {
          return NextResponse.json(
            { error: "Minimal harus ada 1 akun Owner aktif di aplikasi" },
            { status: 400 }
          );
        }
      }
    }

    const [orderCount, movementCount, opnameCount] = await Promise.all([
      prisma.order.count({ where: { createdById: id } }),
      prisma.stockMovement.count({ where: { createdById: id } }),
      prisma.stockOpname.count({
        where: { OR: [{ createdById: id }, { approvedById: id }] },
      }),
    ]);

    if (orderCount > 0 || movementCount > 0 || opnameCount > 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: "Pengguna dinonaktifkan karena memiliki riwayat transaksi atau stok.",
        softDeleted: true,
      });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "Pengguna berhasil dihapus permanen." });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    return NextResponse.json({ error: "Gagal menghapus pengguna" }, { status: 500 });
  }
}
