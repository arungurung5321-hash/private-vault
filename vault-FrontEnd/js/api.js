/**
 * api.js — Vault API Client
 * All communication with the Express backend lives here.
 */

const API_BASE = 'http://localhost:4000/api';

// ─── Token Storage ─────────────────────────────────────────────────────────────
const Auth = {
  getAccess()  { return localStorage.getItem('vault_access_token'); },
  getRefresh() { return localStorage.getItem('vault_refresh_token'); },
  set(accessToken, refreshToken) {
    localStorage.setItem('vault_access_token', accessToken);
    if (refreshToken) localStorage.setItem('vault_refresh_token', refreshToken);
  },
  clear() {
    localStorage.removeItem('vault_access_token');
    localStorage.removeItem('vault_refresh_token');
  },
  isLoggedIn() { return !!this.getAccess(); },
};

// ─── Core Fetch ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, retry = true) {
  const token = Auth.getAccess();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(path, options, false);
    Auth.clear();
    window.location.href = '/login.html';
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message || 'Request failed', res.status, data);
  return data;
}

async function tryRefresh() {
  const refreshToken = Auth.getRefresh();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    Auth.set(data.data.accessToken, data.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ─── Auth Endpoints ──────────────────────────────────────────────────────────
const api = {
  auth: {
    async register(email, password, name) {
      const data = await apiFetch('/auth/register', { method: 'POST', body: { email, password, name } });
      Auth.set(data.data.accessToken, data.data.refreshToken);
      return data.data.user;
    },
    async login(email, password) {
      const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
      Auth.set(data.data.accessToken, data.data.refreshToken);
      return data.data.user;
    },
    async logout() {
      try {
        await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken: Auth.getRefresh() } });
      } finally {
        Auth.clear();
      }
    },
    async me() {
      const data = await apiFetch('/auth/me');
      return data.data.user;
    },
    async updateMe(updates) {
      const data = await apiFetch('/auth/me', { method: 'PUT', body: updates });
      return data.data.user;
    },
  },

  // ─── Vault Items ──────────────────────────────────────────────────────────
  items: {
    async list(params = {}) {
      const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined && v !== '')).toString();
      const data = await apiFetch(`/vault/items${qs ? '?' + qs : ''}`);
      return data.data;
    },
    async get(id) {
      const data = await apiFetch(`/vault/items/${id}`);
      return data.data.item;
    },
    async create(payload) {
      const data = await apiFetch('/vault/items', { method: 'POST', body: payload });
      return data.data.item;
    },
    async update(id, payload) {
      const data = await apiFetch(`/vault/items/${id}`, { method: 'PUT', body: payload });
      return data.data.item;
    },
    async delete(id) {
      return apiFetch(`/vault/items/${id}`, { method: 'DELETE' });
    },
    async deletePermanent(id) {
      return apiFetch(`/vault/items/${id}/permanent`, { method: 'DELETE' });
    },
    async restore(id) {
      return apiFetch(`/vault/items/${id}/restore`, { method: 'POST' });
    },
  },

  // ─── Trash ────────────────────────────────────────────────────────────────
  trash: {
    async list() {
      const data = await apiFetch('/vault/trash');
      return data.data.items;
    },
  },

  // ─── Folders ──────────────────────────────────────────────────────────────
  folders: {
    async list() {
      const data = await apiFetch('/vault/folders');
      return data.data.folders;
    },
    async create(name, icon, color) {
      const data = await apiFetch('/vault/folders', { method: 'POST', body: { name, icon, color } });
      return data.data.folder;
    },
    async update(id, updates) {
      const data = await apiFetch(`/vault/folders/${id}`, { method: 'PUT', body: updates });
      return data.data.folder;
    },
    async delete(id) {
      return apiFetch(`/vault/folders/${id}`, { method: 'DELETE' });
    },
  },

  // ─── Stats ────────────────────────────────────────────────────────────────
  stats: {
    async get() {
      const data = await apiFetch('/vault/stats');
      return data.data.stats;
    },
  },

  // ─── Health ───────────────────────────────────────────────────────────────
  health: {
    async check() {
      const data = await apiFetch('/health');
      return data;
    },
  },
};

// Expose globally
window.api = api;
window.Auth = Auth;
window.ApiError = ApiError;

// ─── Media File Endpoints ─────────────────────────────────────────────────────
api.media = {
  async upload(itemId, formData) {
    const token = Auth.getAccess();
    const res = await fetch(`${API_BASE}/media/${itemId}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData, // FormData — no Content-Type header, browser sets it with boundary
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.message || 'Upload failed', res.status, data);
    return data.data.files;
  },
  async list(itemId) {
    const data = await apiFetch(`/media/${itemId}/files`);
    return data.data.files;
  },
  async delete(itemId, fileId) {
    return apiFetch(`/media/${itemId}/files/${fileId}`, { method: 'DELETE' });
  },
};

// ─── Share Endpoints ──────────────────────────────────────────────────────────
api.share = {
  async createCode(itemId, label) {
    const data = await apiFetch(`/share/items/${itemId}/share`, { method: 'POST', body: { label } });
    return data.data;
  },
  async listCodes(itemId) {
    const data = await apiFetch(`/share/items/${itemId}/shares`);
    return data.data.share_codes;
  },
  async revokeCode(itemId, codeId) {
    return apiFetch(`/share/items/${itemId}/shares/${codeId}`, { method: 'DELETE' });
  },
  async listPending() {
    const data = await apiFetch('/share/pending');
    return data.data.requests;
  },
  async respond(requestId, action) {
    return apiFetch(`/share/respond/${requestId}`, { method: 'POST', body: { action } });
  },
};
