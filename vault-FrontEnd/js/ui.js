/**
 * ui.js — UI Utilities
 * Toast notifications, modal manager, clipboard, helpers
 */

// ─── Toast Notifications ─────────────────────────────────────────────────────
const Toast = (() => {
  let container;
  const init = () => {
    if (container) return;
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  };

  const show = (message, type = 'info', duration = 3500) => {
    init();
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  return {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    info:    (msg) => show(msg, 'info'),
  };
})();

// ─── Modal Manager ────────────────────────────────────────────────────────────
const Modal = (() => {
  let overlay;

  const close = () => {
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay?.remove(); overlay = null; }, 200);
    }
  };

  const open = ({ title, body, footer, onClose }) => {
    close();
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="btn btn-icon modal-close-btn" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    overlay.querySelector('.modal-close-btn').addEventListener('click', () => {
      close();
      onClose?.();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { close(); onClose?.(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); onClose?.(); }
    }, { once: true });

    document.body.appendChild(overlay);
    return { close, overlay };
  };

  return { open, close };
})();

// ─── Clipboard ────────────────────────────────────────────────────────────────
async function copyToClipboard(text, label = 'Value') {
  try {
    await navigator.clipboard.writeText(text);
    Toast.success(`${label} copied to clipboard`);
  } catch {
    Toast.error('Could not copy to clipboard');
  }
}

// ─── Item Type Config ─────────────────────────────────────────────────────────
const ITEM_TYPES = {
  password: { label: 'Password',   icon: '🔑', color: 'gold',   fields: ['username','secret','url','notes'] },
  secret:   { label: 'Secret',     icon: '🗝️', color: 'teal',   fields: ['secret','notes'] },
  note:     { label: 'Note',       icon: '📋', color: 'blue',   fields: ['content','notes'] },
  card:     { label: 'Card',       icon: '💳', color: 'purple', fields: ['card_number','expiry','cvv','cardholder','notes'] },
  identity: { label: 'Identity',   icon: '🪪',  color: 'green',  fields: ['first_name','last_name','phone','address','notes'] },
};

const FIELD_LABELS = {
  username:    'Username / Email',
  secret:      'Password / Secret',
  url:         'Website URL',
  notes:       'Notes',
  content:     'Content',
  card_number: 'Card Number',
  expiry:      'Expiry Date',
  cvv:         'CVV',
  cardholder:  'Cardholder Name',
  first_name:  'First Name',
  last_name:   'Last Name',
  phone:       'Phone',
  address:     'Address',
};

const SENSITIVE_FIELDS = new Set(['secret', 'cvv', 'card_number', 'content']);

// ─── Date formatter ───────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// ─── Build item card HTML ─────────────────────────────────────────────────────
function buildItemCard(item) {
  const t = ITEM_TYPES[item.type] || ITEM_TYPES.password;
  const sub = item.username || item.cardholder || item.first_name
    ? (item.username || `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.cardholder)
    : item.url || '';
  const tags = (item.tags || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join('');
  const fav = item.is_favorite ? 'active' : '';

  return `
    <div class="item-card type-${item.type} animate-fade" data-id="${item.id}" data-type="${item.type}">
      <div class="item-card-header">
        <div class="item-type-icon ${item.type}">${t.icon}</div>
        <div style="flex:1;overflow:hidden">
          <div class="item-card-title">${escapeHtml(item.title)}</div>
          ${sub ? `<div class="item-card-sub">${escapeHtml(sub)}</div>` : ''}
        </div>
      </div>
      <div class="item-card-footer">
        <div class="item-tags">${tags}</div>
        <button class="item-fav-btn ${fav}" data-id="${item.id}" title="Toggle favorite">★</button>
      </div>
    </div>
  `;
}

// ─── Build detail panel HTML ──────────────────────────────────────────────────
function buildDetailPanel(item) {
  const t = ITEM_TYPES[item.type] || ITEM_TYPES.password;
  const fieldsHtml = t.fields.map(f => {
    const val = item[f];
    if (!val) return '';
    const isSensitive = SENSITIVE_FIELDS.has(f);
    const masked = isSensitive ? '••••••••••••' : '';
    return `
      <div class="detail-field">
        <div class="detail-field-label">${FIELD_LABELS[f] || f}</div>
        <div class="detail-field-value ${isSensitive ? 'masked' : ''}" id="field-${f}">${isSensitive ? masked : escapeHtml(val)}</div>
        <div class="detail-field-actions">
          ${isSensitive ? `<button class="btn btn-ghost btn-sm reveal-btn" data-field="${f}" data-val="${escapeHtml(val)}">👁 Reveal</button>` : ''}
          <button class="btn btn-ghost btn-sm copy-btn" data-val="${escapeHtml(val)}" data-label="${FIELD_LABELS[f] || f}">⎘ Copy</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="detail-header">
      <div class="detail-type-badge">${t.icon} ${t.label}</div>
      <button class="btn btn-icon" id="close-detail-btn" title="Close">✕</button>
    </div>
    <div class="detail-body">
      <div>
        <div style="font-family:var(--font-display);font-size:1.3rem;margin-bottom:4px">${escapeHtml(item.title)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono)">Updated ${timeAgo(item.updated_at)}</div>
      </div>
      <div class="divider"></div>
      ${fieldsHtml}
      ${(item.tags||[]).length ? `
        <div class="detail-field">
          <div class="detail-field-label">Tags</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">
            ${item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
    <div class="detail-footer">
      <button class="btn btn-secondary btn-sm" id="edit-item-btn" data-id="${item.id}">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" id="delete-item-btn" data-id="${item.id}">🗑 Delete</button>
    </div>
  `;
}

// ─── Build add/edit form HTML ─────────────────────────────────────────────────
function buildItemForm(type, existing = null) {
  const fieldRows = {
    password: `
      <div class="form-group">
        <label class="form-label">Username / Email</label>
        <input class="form-input" name="username" type="text" value="${existing?.username || ''}" placeholder="john@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">Password *</label>
        <div class="input-wrapper">
          <input class="form-input mono" name="secret" type="password" value="${existing?.secret || ''}" placeholder="••••••••" required>
          <button type="button" class="input-action toggle-pw">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Website URL</label>
        <input class="form-input" name="url" type="url" value="${existing?.url || ''}" placeholder="https://example.com">
      </div>`,
    secret: `
      <div class="form-group">
        <label class="form-label">Secret Value *</label>
        <div class="input-wrapper">
          <input class="form-input mono" name="secret" type="password" value="${existing?.secret || ''}" placeholder="API key, token, env var…" required>
          <button type="button" class="input-action toggle-pw">👁</button>
        </div>
      </div>`,
    note: `
      <div class="form-group">
        <label class="form-label">Content *</label>
        <textarea class="form-textarea" name="content" placeholder="Write your secure note here…" required>${existing?.content || ''}</textarea>
      </div>`,
    card: `
      <div class="form-group">
        <label class="form-label">Card Number *</label>
        <input class="form-input mono" name="card_number" type="text" maxlength="19" value="${existing?.card_number || ''}" placeholder="4111 1111 1111 1111" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-group">
          <label class="form-label">Expiry</label>
          <input class="form-input mono" name="expiry" type="text" maxlength="5" value="${existing?.expiry || ''}" placeholder="MM/YY">
        </div>
        <div class="form-group">
          <label class="form-label">CVV</label>
          <input class="form-input mono" name="cvv" type="password" maxlength="4" value="${existing?.cvv || ''}" placeholder="•••">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Cardholder Name</label>
        <input class="form-input" name="cardholder" type="text" value="${existing?.cardholder || ''}" placeholder="John Doe">
      </div>`,
    identity: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="form-group">
          <label class="form-label">First Name</label>
          <input class="form-input" name="first_name" type="text" value="${existing?.first_name || ''}" placeholder="John">
        </div>
        <div class="form-group">
          <label class="form-label">Last Name</label>
          <input class="form-input" name="last_name" type="text" value="${existing?.last_name || ''}" placeholder="Doe">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-input" name="phone" type="tel" value="${existing?.phone || ''}" placeholder="+1 555 123 4567">
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea class="form-textarea" name="address" style="min-height:70px" placeholder="123 Main St…">${existing?.address || ''}</textarea>
      </div>`,
  };

  return `
    <div class="form-group">
      <label class="form-label">Type</label>
      <select class="form-select" name="type" ${existing ? 'disabled' : ''}>
        ${Object.entries(ITEM_TYPES).map(([k,v]) =>
          `<option value="${k}" ${type === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Title *</label>
      <input class="form-input" name="title" type="text" value="${existing?.title || ''}" placeholder="e.g. GitHub Account" required>
    </div>
    <div id="type-fields">
      ${fieldRows[type] || ''}
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-textarea" name="notes" style="min-height:70px" placeholder="Optional notes…">${existing?.notes || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Tags (comma separated)</label>
      <input class="form-input" name="tags" type="text" value="${(existing?.tags||[]).join(', ')}" placeholder="work, personal, dev">
    </div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem;color:var(--text-secondary)">
      <input type="checkbox" name="is_favorite" ${existing?.is_favorite ? 'checked' : ''}> Mark as favourite
    </label>
  `;
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Read form data ───────────────────────────────────────────────────────────
function readForm(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    obj[k] = v;
  }
  // tags → array
  if (obj.tags) obj.tags = obj.tags.split(',').map(t => t.trim()).filter(Boolean);
  else obj.tags = [];
  // checkbox
  obj.is_favorite = form.querySelector('[name=is_favorite]')?.checked ?? false;
  // type from disabled select
  if (!obj.type) obj.type = form.querySelector('[name=type]')?.value;
  return obj;
}

// Expose globally
window.Toast = Toast;
window.Modal = Modal;
window.copyToClipboard = copyToClipboard;
window.ITEM_TYPES = ITEM_TYPES;
window.buildItemCard = buildItemCard;
window.buildDetailPanel = buildDetailPanel;
window.buildItemForm = buildItemForm;
window.readForm = readForm;
window.escapeHtml = escapeHtml;
window.timeAgo = timeAgo;
window.FIELD_LABELS = FIELD_LABELS;
window.SENSITIVE_FIELDS = SENSITIVE_FIELDS;
