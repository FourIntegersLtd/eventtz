import { describe, expect, it, vi, beforeEach } from "vitest";
import api from "./axios";
import * as mediaDirectUpload from "./mediaDirectUpload";
import { uploadImage } from "./mediaApi";

describe("uploadImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses presigned direct upload instead of multipart through the proxy", async () => {
    vi.spyOn(api, "post");
    vi.spyOn(mediaDirectUpload, "directUpload").mockResolvedValue({
      bucket: "b",
      path: "p",
      public_url: "https://example.com/p",
    });
    const file = new File(["pixels"], "face.jpg", { type: "image/jpeg" });
    const result = await uploadImage(file);
    expect(mediaDirectUpload.directUpload).toHaveBeenCalledWith("image", file);
    expect(result.public_url).toBe("https://example.com/p");
    expect(api.post).not.toHaveBeenCalled();
  });
});
