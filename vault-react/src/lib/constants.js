export const TYPE_META = {
  password: { label: 'Password', icon: '🔑', cls: 'password', color: '#d4a843' },
  secret:   { label: 'Secret',   icon: '🗝️', cls: 'secret',   color: '#3dd9c5' },
  note:     { label: 'Note',     icon: '📋', cls: 'note',     color: '#60a5fa' },
  card:     { label: 'Card',     icon: '💳', cls: 'card',     color: '#a78bfa' },
  identity: { label: 'Identity', icon: '🪪', cls: 'identity', color: '#4ade80' },
  media:    { label: 'Media',    icon: '🖼️', cls: 'media',    color: '#f472b6' },
};

export const TYPE_FIELDS = {
  password: ['username', 'secret', 'url', 'notes'],
  secret:   ['secret', 'notes'],
  note:     ['content', 'notes'],
  card:     ['card_number', 'expiry', 'cvv', 'cardholder', 'notes'],
  identity: ['first_name', 'last_name', 'phone', 'address', 'notes'],
  media:    ['notes'],
};

export const FIELD_LABELS = {
  username: 'Username / Email', secret: 'Password / Secret',
  url: 'Website URL', notes: 'Notes', content: 'Content',
  card_number: 'Card Number', expiry: 'Expiry', cvv: 'CVV', cardholder: 'Cardholder',
  first_name: 'First Name', last_name: 'Last Name', phone: 'Phone', address: 'Address',
};

export const SENSITIVE = new Set(['secret', 'cvv', 'card_number', 'content']);

export function timeAgo(iso) {
  if (!iso) return '—';
  const d = Date.now() - new Date(iso).getTime(), m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy < 30) return `${dy}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatBytes(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB']; let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function fileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf'))      return '📕';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  if (mime.includes('word'))     return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📄';
}

export function itemSubtitle(item) {
  return item.username
    || (item.first_name ? `${item.first_name} ${item.last_name || ''}`.trim() : '')
    || item.cardholder
    || item.url
    || '';
}
