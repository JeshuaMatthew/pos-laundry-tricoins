import { del, put } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";

export type UploadFolder = "services" | "products" | "uploads";

const ALLOWED_FOLDERS = new Set<UploadFolder>(["services", "products", "uploads"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export function normalizeUploadFolder(raw?: string | null): UploadFolder {
  if (raw && ALLOWED_FOLDERS.has(raw as UploadFolder)) {
    return raw as UploadFolder;
  }
  return "uploads";
}

export function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") ||
      parsed.hostname.endsWith(".blob.vercel-storage.com")
    ) {
      return true;
    }

    // Support local vercel-blob-emulator (e.g. localhost:3100)
    const emulatorUrl = process.env.VERCEL_BLOB_API_URL;
    if (emulatorUrl) {
      try {
        const emulatorParsed = new URL(emulatorUrl);
        if (parsed.host === emulatorParsed.host) {
          return true;
        }
      } catch {
        // ignore
      }
    }

    return parsed.host === "localhost:3100" || parsed.host === "127.0.0.1:3100";
  } catch {
    return false;
  }
}

export async function uploadImageToBlob(
  file: File,
  folder: UploadFolder = "uploads"
): Promise<{ url: string; pathname: string; storage: "vercel-blob" | "local" }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar (JPG, PNG, WebP, dll)");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Ukuran gambar maksimal 5MB");
  }

  const ext = path.extname(file.name) || ".png";
  const cleanName = path
    .basename(file.name, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  const fileName = `${Date.now()}-${cleanName || "image"}${ext}`;
  const blobPathname = `${folder}/${fileName}`;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(blobPathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || undefined,
      token,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      storage: "vercel-blob",
    };
  }

  if (process.env.VERCEL === "1") {
    throw new Error("BLOB_READ_WRITE_TOKEN belum dikonfigurasi untuk Vercel Blob");
  }

  // Fallback lokal untuk preview/development saat BLOB_READ_WRITE_TOKEN belum diisi
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, buffer);

  return {
    url: `/uploads/${folder}/${fileName}`,
    pathname: blobPathname,
    storage: "local",
  };
}

export async function deleteImageByUrl(url?: string | null): Promise<void> {
  if (!url) return;

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token && isVercelBlobUrl(url)) {
      await del(url, { token });
      return;
    }

    if (url.startsWith("/uploads/")) {
      const relative = url.replace(/^\/+/, "");
      const resolved = path.resolve(process.cwd(), "public", relative);
      const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
      if (resolved.startsWith(uploadsRoot + path.sep)) {
        await fs.unlink(resolved).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Cleanup image skipped:", err);
  }
}
