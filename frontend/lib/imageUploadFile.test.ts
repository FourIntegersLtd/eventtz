import { describe, expect, it } from "vitest";
import { filterLikelyImageUploadFiles, isLikelyImageUploadFile } from "./imageUploadFile";

function file(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("isLikelyImageUploadFile", () => {
  it("accepts normal image MIME types", () => {
    expect(isLikelyImageUploadFile(file("photo.jpg", "image/jpeg"))).toBe(true);
  });

  it("accepts common mobile picks with an empty MIME type", () => {
    expect(isLikelyImageUploadFile(file("IMG_1234.HEIC", ""))).toBe(true);
    expect(isLikelyImageUploadFile(file("photo.jpeg", ""))).toBe(true);
  });

  it("accepts octet-stream when the filename looks like an image", () => {
    expect(isLikelyImageUploadFile(file("photo.png", "application/octet-stream"))).toBe(true);
  });

  it("rejects non-image files", () => {
    expect(isLikelyImageUploadFile(file("notes.pdf", "application/pdf"))).toBe(false);
    expect(isLikelyImageUploadFile(file("clip.mp4", "video/mp4"))).toBe(false);
    expect(isLikelyImageUploadFile(file("readme.txt", ""))).toBe(false);
  });
});

describe("filterLikelyImageUploadFiles", () => {
  it("keeps only likely image files", () => {
    expect(
      filterLikelyImageUploadFiles([
        file("a.jpg", "image/jpeg"),
        file("b.pdf", "application/pdf"),
        file("c.heic", ""),
      ]).map((f) => f.name),
    ).toEqual(["a.jpg", "c.heic"]);
  });
});
