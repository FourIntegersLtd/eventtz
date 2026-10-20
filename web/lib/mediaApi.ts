import { directUpload } from "./mediaDirectUpload";

export type ImageUploadResult = {
  bucket: string;
  path: string;
  public_url: string;
};

/** Default axios timeout is 30s — presign JSON is fast; S3 POST uses `fetch` without this cap. */
export const IMAGE_UPLOAD_TIMEOUT_MS = 120_000;

/** Videos and PDFs can be much larger (up to 50MB). */
export const FILE_UPLOAD_TIMEOUT_MS = 180_000;

export async function uploadImage(file: File): Promise<ImageUploadResult> {
  return directUpload("image", file);
}

/** Images, PDFs, or videos - used for portfolio video and profile certificates. */
export async function uploadFile(file: File): Promise<ImageUploadResult> {
  return directUpload("file", file);
}
