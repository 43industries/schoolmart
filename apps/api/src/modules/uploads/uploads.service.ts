import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../../lib/errors.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LOGBOOK_BYTES = 10 * 1024 * 1024;
/** Largest multipart file the API accepts (logbooks are bigger than product images). */
export const MAX_UPLOAD_BYTES = Math.max(MAX_IMAGE_BYTES, MAX_LOGBOOK_BYTES);

const LOGBOOK_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const LOGBOOK_EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Private (non-static) storage for vehicle logbooks — never under getUploadRoot(). */
export function getLogbooksDir() {
  return process.env.LOGBOOK_DIR
    ? path.resolve(process.env.LOGBOOK_DIR)
    : path.resolve(process.cwd(), "private-uploads", "logbooks");
}

export function getLogbookPath(storedName: string) {
  return path.join(getLogbooksDir(), path.basename(storedName));
}

export async function saveLogbook(opts: { buffer: Buffer; mimetype: string; originalFilename?: string }) {
  if (!LOGBOOK_MIME.has(opts.mimetype)) {
    throw new AppError(400, "Logbook must be a PDF, JPEG, PNG, or WebP file");
  }
  if (opts.buffer.byteLength === 0) throw new AppError(400, "Empty logbook file");
  if (opts.buffer.byteLength > MAX_LOGBOOK_BYTES) {
    throw new AppError(400, "Logbook must be 10MB or smaller");
  }
  await mkdir(getLogbooksDir(), { recursive: true });
  const ext = LOGBOOK_EXT_BY_MIME[opts.mimetype] ?? ".pdf";
  const storedName = `${randomUUID()}${ext}`;
  await writeFile(path.join(getLogbooksDir(), storedName), opts.buffer);
  return {
    storedName,
    fileName: opts.originalFilename ?? storedName,
    mimetype: opts.mimetype,
    size: opts.buffer.byteLength,
  };
}

export function getUploadRoot() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), "uploads");
}

export function getProductsUploadDir() {
  return path.join(getUploadRoot(), "products");
}

export async function ensureUploadDirs() {
  await mkdir(getProductsUploadDir(), { recursive: true });
}

export async function saveProductImage(opts: {
  buffer: Buffer;
  mimetype: string;
  originalFilename?: string;
}) {
  if (!ALLOWED_MIME.has(opts.mimetype)) {
    throw new AppError(400, "Only JPEG, PNG, WebP, or GIF images are allowed");
  }
  if (opts.buffer.byteLength === 0) {
    throw new AppError(400, "Empty file");
  }
  if (opts.buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new AppError(400, "Image must be 5MB or smaller");
  }

  await ensureUploadDirs();
  const ext = EXT_BY_MIME[opts.mimetype] ?? ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const fullPath = path.join(getProductsUploadDir(), filename);
  await writeFile(fullPath, opts.buffer);

  return {
    filename,
    url: `/api/v1/uploads/products/${filename}`,
    size: opts.buffer.byteLength,
    mimetype: opts.mimetype,
  };
}
