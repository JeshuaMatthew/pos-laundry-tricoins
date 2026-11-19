import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  deleteImageByUrl,
  normalizeUploadFolder,
  uploadImageToBlob,
} from "@/lib/blob";

export async function POST(req: Request) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderRaw = formData.get("folder") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    const folder = normalizeUploadFolder(folderRaw);
    const result = await uploadImageToBlob(file, folder);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    const message = err instanceof Error ? err.message : "Gagal mengupload gambar";
    const status =
      message.includes("harus berupa gambar") || message.includes("maksimal")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const session = await requireAuth([Role.OWNER]);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    let url = searchParams.get("url");

    if (!url) {
      const body = await req.json().catch(() => ({}));
      url = typeof body?.url === "string" ? body.url : null;
    }

    if (!url) {
      return NextResponse.json({ error: "URL gambar wajib disertakan" }, { status: 400 });
    }

    await deleteImageByUrl(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete upload error:", err);
    return NextResponse.json({ error: "Gagal menghapus gambar" }, { status: 500 });
  }
}
