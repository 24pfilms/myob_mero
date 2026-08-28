import type { Folder, NoteSummary } from "./api";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
  createdAt?: string;
  modifiedAt?: string;
}

export function transformNotesToFileNodes(notes: NoteSummary[], folders: Folder[]): FileNode[] {
  const folderNodes = new Map(
    folders.map((folder) => [
      folder.id,
      {
        id: folder.id,
        name: folder.name,
        type: "folder" as const,
        children: [],
        createdAt: folder.created_at,
      },
    ]),
  );
  const roots: FileNode[] = [];

  for (const folder of folders) {
    const node = folderNodes.get(folder.id)!;
    const parent = folder.parent_id ? folderNodes.get(folder.parent_id) : undefined;
    (parent?.children ?? roots).push(node);
  }

  for (const note of notes) {
    const node: FileNode = {
      id: note.id,
      name: note.title,
      type: "file",
      createdAt: note.created_at ?? undefined,
      modifiedAt: note.modified_at ?? undefined,
    };
    const folder = note.folder_id ? folderNodes.get(note.folder_id) : undefined;
    (folder?.children ?? roots).push(node);
  }

  return roots;
}
