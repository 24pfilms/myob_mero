import { api } from './api';

export const NOTE_DRAG_TYPE = 'application/x-mero-note';

export type EmbeddingState = 'pending' | 'ready' | 'failed' | 'missing';

export interface NoteSummary {
  id: string;
  title: string;
  tags: string[];
  folder_id: string | null;
  created_at: string | null;
  modified_at: string | null;
  excerpt?: string;
  embedding_status?: EmbeddingState;
}

export interface NoteDetail extends NoteSummary {
  content: string;
  updated_at?: string | null;
  version?: number;
}

export interface FolderSummary {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string | null;
}

export interface SimilarNote {
  id: string;
  title: string;
  score: number;
}

export interface SimilarityMatrix {
  ids: string[];
  matrix: number[][];
  model?: string;
  dimensions?: number;
}

export interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  completed_items: number;
  failed_items: number;
  results: Array<{ url: string; status: string; note_id?: string; error?: string }>;
}

export interface ChatCitation {
  noteId: string;
  noteTitle: string;
  excerpt?: string;
  relevanceScore?: number;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
  related_notes?: Array<{ id: string; title: string; relevance: number }>;
  conversation_id?: string;
}

export interface OpenAIOAuthStatus {
  configured: boolean;
  credentialType: string | null;
  oauth: { state: 'disconnected' | 'pending' | 'connected' | 'failed'; error?: string };
}

export interface LinkSuggestion {
  note_id: string;
  title: string;
  score: number;
  reason?: string;
}

export interface NoteVersion {
  version: number;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

export interface AttachmentMetadata {
  id: string;
  note_id: string;
  filename: string;
  mime_type: string;
  bytes: number;
  sha256: string;
  created_at: string;
}

export interface EmbeddingJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  model: string;
  dimensions: number;
  last_note_id: string | null;
  processed_count: number;
  failed_count: number;
  failures: Array<{ note_id: string | null; error: string }>;
}

export type JournalSpace = 'work' | 'personal';

export interface EntryFields {
  kind: 'note' | 'entry' | 'summary';
  entry_date: string | null;
  space: JournalSpace;
  project_id: string | null;
  assignment: 'manual' | 'rule' | 'ai' | 'unassigned';
  source: 'text' | 'voice' | 'import';
  word_count: number;
}

export interface JournalEntry extends EntryFields {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  created_at: string | null;
  updated_at: string | null;
  preview?: string;
}

export interface EntryHint {
  kind: 'project' | 'client';
  id: string;
  name: string;
  client_id: string | null;
  preview: string;
}

export interface ClientSummary {
  id: string;
  name: string;
  archived: boolean;
  created_at: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  client_id: string | null;
  status: 'active' | 'paused' | 'done';
  stale_after_days: number;
  created_at: string | null;
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  processed_count: number;
  total_count: number;
  error?: string | null;
  path?: string | null;
  updated_at?: string | null;
}

export interface CredentialUnavailableError {
  error: 'AI_CREDENTIAL_UNAVAILABLE';
}

function notePath(noteId: string): string {
  return `/myob/notes/${encodeURIComponent(noteId)}`;
}

class MyObApiService {
  listNotes(params: { q?: string; folderId?: string; tag?: string; page?: number; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.folderId) query.set('folder_id', params.folderId);
    if (params.tag) query.set('tag', params.tag);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.size ? `?${query}` : '';
    return api.request<NoteSummary[]>(`/myob/notes${suffix}`, { method: 'GET' });
  }

  getNote(noteId: string) {
    return api.request<NoteDetail>(`${notePath(noteId)}?raw=true`, { method: 'GET' });
  }

  createNote(note: { title: string; content: string; tags?: string[]; folder_id?: string | null }) {
    return api.request<NoteDetail>('/myob/notes', { method: 'POST', body: JSON.stringify(note) });
  }

  updateNote(noteId: string, note: Partial<Pick<NoteDetail, 'title' | 'content' | 'tags' | 'folder_id' | 'version'>>) {
    return api.request<NoteDetail>(notePath(noteId), { method: 'PUT', body: JSON.stringify(note) });
  }

  deleteNote(noteId: string) {
    return api.request<{ message: string; id: string }>(notePath(noteId), { method: 'DELETE' });
  }

  listFolders() {
    return api.request<FolderSummary[]>('/myob/folders', { method: 'GET' });
  }

  createFolder(folder: { name: string; parent_id?: string | null }) {
    return api.request<FolderSummary>('/myob/folders', { method: 'POST', body: JSON.stringify(folder) });
  }

  listFolderNotes(folderId: string) {
    return api.request<NoteSummary[]>(`/myob/folders/${encodeURIComponent(folderId)}/notes`, { method: 'GET' });
  }

  semanticSearch(query: string, limit = 20) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return api.request<{ results: Array<NoteSummary & { similarity: number }> }>(`/myob/semantic-search?${params}`, { method: 'GET' });
  }

  similarNotes(noteId: string, limit = 5) {
    return api.request<{ results: SimilarNote[] }>(`${notePath(noteId)}/similar?limit=${limit}`, { method: 'GET' });
  }

  similarityMatrix(noteIds: string[]) {
    return api.request<SimilarityMatrix>('/myob/notes/similarity-matrix', { method: 'POST', body: JSON.stringify({ note_ids: noteIds }) });
  }

  quickImport(input: { url: string; folder_id?: string | null; generate_summary?: boolean; auto_tag?: boolean; custom_title?: string }) {
    return api.request<{ success: boolean; note_id: string; title: string }>('/myob/content/import/quick', { method: 'POST', body: JSON.stringify(input) });
  }

  bulkImport(input: { items: Array<{ url: string; custom_title?: string }>; folder_id?: string | null }) {
    return api.request<{ job_id: string }>('/myob/content/import/bulk', { method: 'POST', body: JSON.stringify(input) });
  }

  importStatus(jobId: string) {
    return api.request<ImportJob>(`/myob/content/import/${encodeURIComponent(jobId)}/status`, { method: 'GET' });
  }

  chat(input: { query: string; current_note_id?: string; conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }> }) {
    return api.request<ChatResponse>('/myob/ai/chat', { method: 'POST', body: JSON.stringify(input) });
  }

  generalChat(input: { query: string; conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }> }) {
    return api.request<ChatResponse>('/myob/ai/general-chat', { method: 'POST', body: JSON.stringify(input) });
  }

  openAIOAuthStatus() {
    return api.request<OpenAIOAuthStatus>('/auth/credentials/openai/oauth/status', { method: 'GET' });
  }

  startOpenAIOAuth() {
    return api.request<{ authorizeUrl: string }>('/auth/credentials/openai/oauth/start', { method: 'POST' });
  }

  suggestLinks(noteId: string, content?: string) {
    return api.request<{ suggestions: LinkSuggestion[] }>('/myob/ai/suggest-links', { method: 'POST', body: JSON.stringify({ current_note_id: noteId, text: content || 'Find related notes' }) });
  }

  listVersions(noteId: string) {
    return api.request<{ versions: NoteVersion[] }>(`${notePath(noteId)}/versions`, { method: 'GET' });
  }

  restoreVersion(noteId: string, version: number) {
    return api.request<NoteDetail>(`${notePath(noteId)}/versions/${version}/restore`, { method: 'POST' });
  }

  listAttachments(noteId: string) {
    return api.request<{ attachments: AttachmentMetadata[] }>(`${notePath(noteId)}/attachments`, { method: 'GET' });
  }

  startEmbeddingReindex() {
    return api.request<{ job_id: string; status: EmbeddingJob['status'] }>('/myob/embeddings/reindex', { method: 'POST' });
  }

  embeddingJob(jobId: string) {
    return api.request<EmbeddingJob>(`/myob/embeddings/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' });
  }

  listEntries(params: { from?: string; to?: string; space?: JournalSpace; projectId?: string; clientId?: string; assignment?: EntryFields['assignment']; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.space) query.set('space', params.space);
    if (params.projectId) query.set('project_id', params.projectId);
    if (params.clientId) query.set('client_id', params.clientId);
    if (params.assignment) query.set('assignment', params.assignment);
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.size ? `?${query}` : '';
    return api.request<JournalEntry[]>(`/myob/entries${suffix}`, { method: 'GET' });
  }

  createEntry(entry: { title: string; content: string; entry_date: string; space: JournalSpace; project_id?: string | null; tags?: string[] }) {
    return api.request<NoteDetail & EntryFields>('/myob/notes', { method: 'POST', body: JSON.stringify({ ...entry, kind: 'entry', source: 'text' }) });
  }

  entryHints(entryId: string) {
    return api.request<{ entry_id: string; hints: EntryHint[] }>(`/myob/entries/${encodeURIComponent(entryId)}/hints`, { method: 'GET' });
  }

  updateAssignment(entryId: string, assignment: { space: JournalSpace; project_id: string | null }) {
    return api.request<JournalEntry & { previous: { space: JournalSpace; project_id: string | null; assignment: EntryFields['assignment'] } }>(
      `/myob/entries/${encodeURIComponent(entryId)}/assignment`,
      { method: 'PUT', body: JSON.stringify(assignment) },
    );
  }

  listClients() {
    return api.request<ClientSummary[]>('/myob/clients', { method: 'GET' });
  }

  createClient(client: { name: string }) {
    return api.request<ClientSummary>('/myob/clients', { method: 'POST', body: JSON.stringify(client) });
  }

  listProjects(params: { status?: ProjectSummary['status']; clientId?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.clientId) query.set('client_id', params.clientId);
    const suffix = query.size ? `?${query}` : '';
    return api.request<ProjectSummary[]>(`/myob/projects${suffix}`, { method: 'GET' });
  }

  createProject(project: { name: string; client_id?: string | null }) {
    return api.request<ProjectSummary>('/myob/projects', { method: 'POST', body: JSON.stringify({ status: 'active', stale_after_days: 7, ...project }) });
  }

  projectUnlinked(projectId: string) {
    return api.request<JournalEntry[]>(`/myob/projects/${encodeURIComponent(projectId)}/unlinked`, { method: 'GET' });
  }

  startExport() {
    return api.request<ExportJob>('/myob/exports', { method: 'POST' });
  }

  exportStatus(jobId: string) {
    return api.request<ExportJob>(`/myob/exports/${encodeURIComponent(jobId)}`, { method: 'GET' });
  }
}

export const myobApi = new MyObApiService();
