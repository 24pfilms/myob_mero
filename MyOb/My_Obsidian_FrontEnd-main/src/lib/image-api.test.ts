import { afterEach, describe, expect, it, vi } from "vitest";
import {
  base64ToDataUrl,
  downloadImageFromBase64,
  generateImage,
} from "./image-api";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

afterEach(() => vi.unstubAllGlobals());

describe("image helpers", () => {
  it("posts image generation requests and validates the returned image type", async () => {
    const result = {
      success: true,
      image_id: "image-1",
      image_data: "aGVsbG8=",
      mime_type: "image/png",
      aspect_ratio: "1:1",
      prompt: "A map",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(result));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateImage("A map", "1:1", "note-1")).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/api/ai/generate-image",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "A map", aspect_ratio: "1:1", note_id: "note-1" }),
      }),
    );
  });

  it("rejects unsafe MIME types from the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          image_id: "image-1",
          image_data: "PHN2Zz4=",
          mime_type: "image/svg+xml",
          aspect_ratio: "1:1",
          prompt: "Unsafe",
        }),
      ),
    );

    await expect(generateImage("Unsafe", "1:1")).rejects.toThrow("Unsupported image type");
    expect(() => base64ToDataUrl("data", "text/html")).toThrow("Unsupported image type");
  });

  it("creates safe data URLs and sanitized download names", () => {
    const click = vi.fn();
    const link = { href: "", download: "", click };
    vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(link) });

    downloadImageFromBase64("aGVsbG8=", "image/png", "my image?.png");

    expect(link.href).toBe("data:image/png;base64,aGVsbG8=");
    expect(link.download).toBe("my_image_.png");
    expect(click).toHaveBeenCalledOnce();
  });
});
