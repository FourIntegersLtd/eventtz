import { describe, expect, it, vi, beforeEach } from "vitest";
import api from "./axios";
import { multipartUploadConfig, uploadImage } from "./mediaApi";

describe("multipartUploadConfig", () => {
  it("strips JSON content-type so FormData gets a boundary", () => {
    const headers: Record<string, unknown> = { "Content-Type": "application/json" };
    const fd = new FormData();
    const [transform] = multipartUploadConfig(1).transformRequest ?? [];
    expect(transform).toBeDefined();
    transform!(fd, headers);
    expect(headers["Content-Type"]).toBeUndefined();
  });
});

describe("uploadImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts FormData without forcing multipart/form-data without boundary", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: { bucket: "b", path: "p", public_url: "https://example.com/p" },
    });
    const file = new File(["pixels"], "face.jpg", { type: "image/jpeg" });
    await uploadImage(file);
    const config = vi.mocked(api.post).mock.calls[0]?.[2];
    expect(config?.headers).not.toMatchObject({ "Content-Type": "multipart/form-data" });
    expect(config?.transformRequest?.length).toBeGreaterThan(0);
  });
});
