const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api").replace(/\/$/, "");

export interface NoteSummary {
  id: string;
  title: string;
  tags: string[];
  folder_id: string | null;
  created_at: string | null;
  modified_at: string | null;
}

export interface Note extends NoteSummary {
  content: string;
  updated_at?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string;
}

export interface NoteInput {
  title: string;
  content: string;
  tags?: string[];
  folder_id?: string | null;
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error = await response.json();
      if (typeof error?.detail === "string") message = error.detail;
    } catch {
      // Keep the status-based message for non-JSON failures.
    }
    throw new Error(message);
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

const notePath = (id: string) => `/notes/${encodeURIComponent(id)}`;

export const api = {
  testConnection: () => request<{ status: string }>("/stats"),
  getNotes: () => request<NoteSummary[]>("/notes"),
  getNote: (id: string) => request<Note>(notePath(id)),
  createNote: (note: NoteInput) => request<Note>("/notes", { method: "POST", body: note }),
  updateNote: (id: string, note: Partial<NoteInput>) =>
    request<Note>(notePath(id), { method: "PUT", body: note }),
  moveNoteToFolder: (id: string, folderId: string | null) =>
    request<Note>(`${notePath(id)}/move`, { method: "PUT", body: { folder_id: folderId } }),
  deleteNote: (id: string) => request<{ id: string }>(notePath(id), { method: "DELETE" }),
  getFolders: () => request<Folder[]>("/folders"),
  createFolder: (name: string, parentId: string | null = null) =>
    request<Folder>("/folders", { method: "POST", body: { name, parent_id: parentId } }),
  bulkImportNotes: (files: Array<{ filename: string; content: string; folder_id?: string | null }>) =>
    request<{
      success: number;
      failed: number;
      imported: Array<{ id: string; title: string; filename: string }>;
      errors: Array<{ filename: string; error: string }>;
    }>("/notes/import-bulk", { method: "POST", body: { files } }),
  importContentQuick: (input: Record<string, unknown>) =>
    request<{ note_id: string; title: string; content_type: string; transcript_available?: boolean }>(
      "/content/import/quick",
      { method: "POST", body: input },
    ),
  importContentBulk: (input: Record<string, unknown>) =>
    request<{ job_id: string; total_items: number }>("/content/import/bulk", {
      method: "POST",
      body: input,
    }),
  getImportJobStatus: (jobId: string) =>
    request<Record<string, unknown>>(`/content/import/${encodeURIComponent(jobId)}/status`),
  uploadFile: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`${API_BASE}/upload`, { method: "POST", body });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    return response.json() as Promise<{ markdown: string }>;
  },
  browseFilesystem: (path?: string) =>
    request<{
      current_path: string;
      parent_path: string | null;
      directories: Array<{ name: string; path: string; is_drive?: boolean; has_md_files?: boolean }>;
      md_file_count: number;
      total_md_count: number;
    }>(`/filesystem/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`),
  previewVaultImport: (folderPath: string, includeSubfolders: boolean) =>
    request<{
      file_count: number;
      folder_count: number;
      folders: string[];
      files: Array<{ name: string; path: string }>;
      has_more: boolean;
    }>(
      `/vault/preview?folder_path=${encodeURIComponent(folderPath)}&include_subfolders=${includeSubfolders}`,
    ),
  importFromVault: (input: Record<string, unknown>) =>
    request<{
      success: number;
      failed: number;
      folders_created: number;
      imported: Array<{ id: string; title: string; filename: string }>;
      errors: Array<{ filename: string; error: string }>;
    }>("/vault/import", { method: "POST", body: input }),
};
