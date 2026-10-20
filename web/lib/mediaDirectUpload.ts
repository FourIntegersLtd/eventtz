import api from "./axios";
import type { ImageUploadResult } from "./mediaApi";

/** Same caps as api settings (50MB images and general files). */
export const MEDIA_MAX_IMAGE_UPLOAD_BYTES = 50_000_000;
export const MEDIA_MAX_FILE_UPLOAD_BYTES = 50_000_000;

export type PresignedUpload = ImageUploadResult & {
  upload_url: string;
  fields: Record<string, string>;
};

function maxBytesForKind(kind: "image" | "file"): number {
  return kind === "image" ? MEDIA_MAX_IMAGE_UPLOAD_BYTES : MEDIA_MAX_FILE_UPLOAD_BYTES;
}

function sizeLimitMegabytes(maxBytes: number): number {
  const megabytes = Math.round(maxBytes / 1_000_000);
  return megabytes < 1 ? 1 : megabytes;
}

function assertFileSizeWithinLimit(kind: "image" | "file", file: File): void {
  const maxBytes = maxBytesForKind(kind);
  if (file.size > maxBytes) {
    throw new Error(`File is too large (max ${sizeLimitMegabytes(maxBytes)}MB).`);
  }
  if (file.size < 1) {
    throw new Error("File is empty.");
  }
}

export async function requestUploadUrl(
  kind: "image" | "file",
  file: File,
): Promise<PresignedUpload> {
  assertFileSizeWithinLimit(kind, file);
  const res = await api.post<PresignedUpload>("/api/v1/media/upload-urls", {
    kind,
    filename: file.name,
    content_type: file.type || "application/octet-stream",
    content_length: file.size,
  });
  return res.data;
}

async function readS3PostError(response: Response): Promise<string> {
  const text = await response.text();
  const messageMatch = text.match(/<Message>([^<]+)<\/Message>/i);
  if (messageMatch?.[1]) return messageMatch[1];
  return `Upload failed (${response.status}).`;
}

/** POST `file` and presign fields to S3 (browser → bucket, not through Vercel). */
export async function uploadToS3(presign: PresignedUpload, file: File): Promise<void> {
  const form = new FormData();
  for (const [fieldName, fieldValue] of Object.entries(presign.fields)) {
    form.append(fieldName, fieldValue);
  }
  form.append("file", file);
  try {
    const response = await fetch(presign.upload_url, { method: "POST", body: form });
    if (!response.ok) {
      throw new Error(await readS3PostError(response));
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Upload blocked by your browser or network. If this keeps happening, contact support.",
      );
    }
    throw error;
  }
}

export async function directUpload(
  kind: "image" | "file",
  file: File,
): Promise<ImageUploadResult> {
  const presign = await requestUploadUrl(kind, file);
  await uploadToS3(presign, file);
  return {
    bucket: presign.bucket,
    path: presign.path,
    public_url: presign.public_url,
  };
}
