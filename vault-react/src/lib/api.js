// ── Config ─────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Token storage ──────────────────────────────────────────────────────────
export const Auth = {
  getAccess:  ()    => localStorage.getItem('vault_access'),
  getRefresh: ()    => localStorage.getItem('vault_refresh'),
  set:        (a,r) => { localStorage.setItem('vault_access', a); if (r) localStorage.setItem('vault_refresh', r); },
  clear:      ()    => { localStorage.removeItem('vault_access'); localStorage.removeItem('vault_refresh'); },
  loggedIn:   ()    => !!localStorage.getItem('vault_access'),
};

// ── Core fetch ─────────────────────────────────────────────────────────────
let refreshing = false;
let refreshQueue = [];

async function req(path, opts = {}, retry = true) {
  const headers = { ...opts.headers };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = Auth.getAccess();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (res.status === 401 && retry) {
    if (refreshing) return new Promise((resolve, reject) => refreshQueue.push({ resolve, reject, path, opts }));
    refreshing = true;
    try {
      const rf = Auth.getRefresh();
      if (!rf) throw new Error('No refresh token');
      const r2 = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rf }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error('Refresh failed');
      Auth.set(d2.data?.accessToken || d2.accessToken, d2.data?.refreshToken || d2.refreshToken);
      refreshQueue.forEach(q => req(q.path, q.opts, false).then(q.resolve).catch(q.reject));
      refreshQueue = [];
      return req(path, opts, false);
    } catch {
      Auth.clear();
      window.location.href = '/login';
    } finally {
      refreshing = false;
    }
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
}

const get  = (path, params) => req(path + (params ? '?' + new URLSearchParams(params) : ''), { method: 'GET' });
const post = (path, body)   => req(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) });
const put  = (path, body)   => req(path, { method: 'PUT',  body: JSON.stringify(body) });
const del  = (path)         => req(path, { method: 'DELETE' });

// ── API surface ────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (email, password, name) => post('/auth/register', { email, password, name }).then(d => { Auth.set(d.data?.accessToken||d.accessToken, d.data?.refreshToken||d.refreshToken); return d; }),
    login:    (email, password)       => post('/auth/login',    { email, password })       .then(d => { Auth.set(d.data?.accessToken||d.accessToken, d.data?.refreshToken||d.refreshToken); return d; }),
    logout:   ()                      => post('/auth/logout',   {}),
    me:       ()                      => get('/auth/me'),
    update:   (data)                  => put('/auth/me', data),
  },
  vault: {
    items:      (params) => get('/vault/items', params),
    get:        (id)     => get(`/vault/items/${id}`),
    create:     (data)   => post('/vault/items', data),
    update:     (id, d)  => put(`/vault/items/${id}`, d),
    delete:     (id)     => del(`/vault/items/${id}`),
    hardDelete: (id)     => del(`/vault/items/${id}/permanent`),
    restore:    (id)     => post(`/vault/items/${id}/restore`, {}),
    trash:      ()       => get('/vault/trash'),
    stats:      ()       => get('/vault/stats'),
  },
  media: {
    upload: (itemId, fd)       => req(`/media/${itemId}/files`,         { method: 'POST', body: fd }),
    list:   (itemId)           => get(`/media/${itemId}/files`),
    delete: (itemId, fileId)   => del(`/media/${itemId}/files/${fileId}`),
  },
  share: {
    create:  (itemId, label)   => post(`/share/items/${itemId}/share`, { label }),
    list:    (itemId)          => get(`/share/items/${itemId}/shares`),
    revoke:  (itemId, codeId)  => del(`/share/items/${itemId}/shares/${codeId}`),
    pending: ()                => get('/share/pending'),
    respond: (reqId, action)   => post(`/share/respond/${reqId}`, { action }),
    request: (code, email, name) => post('/share/request', { code, accessor_email: email, accessor_name: name }),
    view:    (requestId, token)  => get('/share/view', { requestId, token }),
  },
  health: () => get('/health'),
};
