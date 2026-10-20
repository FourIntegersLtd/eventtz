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

/** Axios config for `FormData` posts through the JSON-default client and Next proxy. */
export function multipartUploadConfig(timeoutMs: number) {
  return {
    timeout: timeoutMs,
    // Shared axios client defaults to JSON. For FormData, drop Content-Type so the
    // runtime sets `multipart/form-data` with a boundary (a bare multipart type hangs
    // or fails on the Next proxy and api/).
    transformRequest: [
      (data: unknown, headers: Record<string, unknown>) => {
        if (data instanceof FormData) {
          delete headers["Content-Type"];
          delete headers["content-type"];
        }
        return data;
      },
    ],
  };
}

export async function uploadImage(file: File): Promise<ImageUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<ImageUploadResult>(
    "/api/v1/media/images",
    fd,
    multipartUploadConfig(IMAGE_UPLOAD_TIMEOUT_MS),
  );
  return res.data;
}

/** Images, PDFs, or videos - used for portfolio video and profile certificates. */
export async function uploadFile(file: File): Promise<ImageUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<ImageUploadResult>(
    "/api/v1/media/files",
    fd,
    multipartUploadConfig(FILE_UPLOAD_TIMEOUT_MS),
  );
  return res.data;
}

