import { describe, expect, it } from "vitest";
import {
  detectContentType,
  getContentTypeIcon,
  isValidUrl,
  parseUrlTextFile,
} from "./urlFileParser";

describe("URL file parsing", () => {
  it("accepts only HTTP(S) URLs", () => {
    expect(isValidUrl("https://example.com/article")).toBe(true);
    expect(isValidUrl("http://localhost:8001")).toBe(true);
    expect(isValidUrl("file:///etc/passwd")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("parses URL-first and title-first rows while skipping comments and invalid rows", () => {
    const result = parseUrlTextFile(`
# reading list
https://example.com/a | Article A
Article B\thttps://example.com/b
not a URL
`);

    expect(result).toEqual([
      { url: "https://example.com/a", custom_title: "Article A" },
      { url: "https://example.com/b", custom_title: "Article B" },
    ]);
  });

  it("detects supported content types and their icons", () => {
    expect(detectContentType("https://youtu.be/video")).toBe("youtube");
    expect(detectContentType("https://github.com/org/repo")).toBe("github");
    expect(detectContentType("https://example.com/file.PDF?download=1")).toBe("pdf");
    expect(detectContentType("https://example.com/post")).toBe("article");
    expect(getContentTypeIcon("youtube")).toBe("🎬");
    expect(getContentTypeIcon("unknown")).toBe("🔗");
  });
});
