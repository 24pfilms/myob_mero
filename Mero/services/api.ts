export interface ApiUser {
  id: number;
  uuid: string;
  username: string;
  email?: string | null;
}

type HeadersInitLike = Record<string, string>;

const DEFAULT_API_BASE = 'http://localhost:3000/api';
const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

function normalizeApiBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function getApiBase(): string {
  const configured = (import.meta as any).env?.VITE_API_URL as string | undefined;
  return normalizeApiBase(configured && configured.trim().length > 0 ? configured : DEFAULT_API_BASE);
}

function getOriginFromApiBase(apiBase: string): string {
  return apiBase.replace(/\/?api$/, '');
}

function resolveUploadsUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const apiBase = getApiBase();
  const origin = getOriginFromApiBase(apiBase);

  if (url.startsWith('/')) return `${origin}${url}`;
  return `${origin}/${url}`;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly payload: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  getToken(): string | null {
    if (!this.token) this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  setUser(user: ApiUser) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  getUser(): ApiUser | null {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ApiUser;
    } catch {
      return null;
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const apiBase = getApiBase();

    const headers: HeadersInitLike = {
      ...(options.headers as HeadersInitLike | undefined),
    };

    // Only set JSON content type when we're sending a JSON body.
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

    if (!res.ok) {
      const message = (data && (data.error || data.message)) || res.statusText;
      throw new ApiError(message, res.status, data);
    }

    return data as T;
  }

  // Auth
  async register(username: string, password: string, email?: string) {
    const res = await this.request<{ success: true; user: ApiUser; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
    this.setToken(res.token);
    this.setUser(res.user);
    return res;
  }

  async login(username: string, password: string) {
    const res = await this.request<{ success: true; user: ApiUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.token);
    this.setUser(res.user);
    return res;
  }

  async me() {
    return this.request<ApiUser>('/auth/me', { method: 'GET' });
  }

  /** Local development only. The server refuses this unless it is running in development. */
  async devLogin() {
    const res = await this.request<{ success: true; user: ApiUser; token: string }>('/auth/dev-login', { method: 'POST' });
    this.setToken(res.token);
    this.setUser(res.user);
    return res.user;
  }

  // API Key Management (secure server-side storage)
  async saveApiKey(apiKey: string) {
    return this.request<{ success: true; message: string }>('/auth/api-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  }

  async getApiKey() {
    return this.request<{ hasKey: boolean; configured: boolean; credentialType: string | null }>('/auth/api-key', {
      method: 'GET',
    });
  }

  async deleteApiKey() {
    return this.request<{ success: true; message: string }>('/auth/api-key', {
      method: 'DELETE',
    });
  }

  // Boards
  async getBoards() {
    return this.request<{ boards: Array<{ board_id: string; name: string; description?: string | null; created_at: string; updated_at: string }> }>(
      '/boards',
      { method: 'GET' }
    );
  }

  async createBoard(name: string, description?: string) {
    return this.request<{ board_id: string; name: string; description?: string | null; created_at: string; updated_at: string }>(
      '/boards',
      {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }
    );
  }

  async deleteBoard(boardId: string) {
    return this.request<{ success: true; message: string }>(`/boards/${encodeURIComponent(boardId)}`, {
      method: 'DELETE',
    });
  }

  async getBoard(boardId: string) {
    return this.request<{
      board: { board_id: string; name: string; description?: string | null; created_at: string; updated_at: string };
      settings: { pan_x: number; pan_y: number; zoom: number; background_color: string; dot_density: number };
      items: Array<{
        item_id: string;
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        z_index: number;
        rotation: number;
        data: Record<string, any>;
      }>;
    }>(`/boards/${encodeURIComponent(boardId)}`, { method: 'GET' });
  }

  async updateBoardSettings(boardId: string, settings: Partial<{ pan_x: number; pan_y: number; zoom: number; background_color: string; dot_density: number }>) {
    return this.request<{ success: true; settings: any }>(`/boards/${encodeURIComponent(boardId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Items
  async syncItems(
    boardId: string,
    items: Array<{ item_id: string; type: string; x: number; y: number; width: number; height: number; z_index: number; rotation: number; data: Record<string, any> }>
  ) {
    return this.request<{ success: true }>(`/boards/${encodeURIComponent(boardId)}/items/sync`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // Upload
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);

    const res = await this.request<{ success: true; url: string; size: number }>('/upload/image', {
      method: 'POST',
      body: formData,
    });

    return { ...res, url: resolveUploadsUrl(res.url) };
  }
}

export const api = new ApiService();
export const AUTH_TOKEN_STORAGE_KEY = TOKEN_STORAGE_KEY;
export const AUTH_USER_STORAGE_KEY = USER_STORAGE_KEY;
