import api from "./axios";

export type ImageUploadResult = {
  bucket: string;
  path: string;
  public_url: string;
};

export async function uploadImage(file: File): Promise<ImageUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<ImageUploadResult>("/api/v1/media/images", fd, {
    // Let the browser set the multipart boundary.
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/** Images, PDFs, or videos — used for portfolio video and profile certificates. */
export async function uploadFile(file: File): Promise<ImageUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await api.post<ImageUploadResult>("/api/v1/media/files", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

