import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("loads notes from the loopback API", async () => {
    const notes = [{ id: "n1", title: "One", tags: [], folder_id: null, created_at: null, modified_at: null }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(notes));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getNotes()).resolves.toEqual(notes);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/api/notes",
      expect.objectContaining({ headers: {} }),
    );
  });

  it("encodes note IDs and serializes JSON updates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "folder/note" }));
    vi.stubGlobal("fetch", fetchMock);

    await api.moveNoteToFolder("folder/note", "target");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/api/notes/folder%2Fnote/move",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ folder_id: "target" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("surfaces FastAPI error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Note not found" }, { status: 404 })),
    );

    await expect(api.getNote("missing")).rejects.toThrow("Note not found");
  });

  it("uploads files as multipart data without forcing a JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ markdown: "![image](data)" }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["hello"], "note.txt", { type: "text/plain" });

    await expect(api.uploadFile(file)).resolves.toEqual({ markdown: "![image](data)" });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers).toBeUndefined();
  });
});
