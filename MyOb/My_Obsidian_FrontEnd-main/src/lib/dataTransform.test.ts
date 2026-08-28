import { describe, expect, it } from "vitest";
import { transformNotesToFileNodes } from "./dataTransform";

describe("transformNotesToFileNodes", () => {
  it("builds nested folders and places notes in their folders", () => {
    const result = transformNotesToFileNodes(
      [
        {
          id: "note",
          title: "Nested note",
          tags: [],
          folder_id: "child",
          created_at: "created",
          modified_at: "modified",
        },
      ],
      [
        { id: "parent", name: "Parent", parent_id: null },
        { id: "child", name: "Child", parent_id: "parent" },
      ],
    );

    expect(result).toEqual([
      {
        id: "parent",
        name: "Parent",
        type: "folder",
        children: [
          {
            id: "child",
            name: "Child",
            type: "folder",
            children: [
              {
                id: "note",
                name: "Nested note",
                type: "file",
                createdAt: "created",
                modifiedAt: "modified",
              },
            ],
            createdAt: undefined,
          },
        ],
        createdAt: undefined,
      },
    ]);
  });

  it("keeps orphaned notes and folders visible at the root", () => {
    const result = transformNotesToFileNodes(
      [
        {
          id: "note",
          title: "Orphan note",
          tags: [],
          folder_id: "missing",
          created_at: null,
          modified_at: null,
        },
      ],
      [{ id: "folder", name: "Orphan folder", parent_id: "missing" }],
    );

    expect(result.map(({ id }) => id)).toEqual(["folder", "note"]);
  });
});
