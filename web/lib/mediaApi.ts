import api from "./axios";

export type ImageUploadResult = {
  bucket: string;
  path: string;
  public_url: string;
};

/** Default axios timeout is 30s — too short for large portfolio photos on mobile. */
export const IMAGE_UPLOAD_TIMEOUT_MS = 120_000;

/** Videos and PDFs can be much larger (up to 50MB). */
export const FILE_UPLOAD_TIMEOUT_MS = 180_000;

export async function uploadImage(file: File): Promise<ImageUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<ImageUploadResult>("/api/v1/media/images", fd, {
    // Let the browser set the multipart boundary.
    headers: { "Content-Type": "multipart/form-data" },
    timeout: IMAGE_UPLOAD_TIMEOUT_MS,
  });
  return res.data;
}

/** Images, PDFs, or videos - used for portfolio video and profile certificates. */
export async function uploadFile(file: File): Promise<ImageUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<ImageUploadResult>("/api/v1/media/files", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: FILE_UPLOAD_TIMEOUT_MS,
  });
  return res.data;
}

