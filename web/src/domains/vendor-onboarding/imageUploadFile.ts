const IMAGE_FILE_EXT = /\.(avif|gif|heic|heif|jpe?g|png|webp)(\?|$)/i;

/** True when the browser reports an image MIME type or the filename looks like an image. */
export function isLikelyImageUploadFile(file: File): boolean {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/")) return true;
  if (type !== "" && type !== "application/octet-stream") return false;
  return IMAGE_FILE_EXT.test(file.name.trim());
}

export function filterLikelyImageUploadFiles(files: Iterable<File>): File[] {
  return [...files].filter(isLikelyImageUploadFile);
}
