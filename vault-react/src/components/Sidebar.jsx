import { TYPE_META } from '../lib/constants';
import { useToast } from '../hooks/useToast';
import { api, Auth } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const NAV = [
  { v: 'all',      icon: '🏠', label: 'All Items' },
  { v: 'password', icon: '🔑', label: 'Passwords' },
  { v: 'secret',   icon: '🗝️', label: 'Secrets' },
  { v: 'note',     icon: '📋', label: 'Notes' },
  { v: 'card',     icon: '💳', label: 'Cards' },
  { v: 'identity', icon: '🪪', label: 'Identities' },
  { v: 'media',    icon: '🖼️', label: 'Media' },
];

export default function Sidebar({ view, onNav, stats, user, pendingCount }) {
  const toast    = useToast();
  const navigate = useNavigate();

  const logout = async () => {
    try { await api.auth.logout(); } catch {}
    Auth.clear();
    toast('Signed out', 'info');
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <div className="sb-lock">🔐</div>
        <span className="sb-wordmark">Va<span>ult</span></span>
      </div>

      <nav className="sb-nav">
        <div className="sb-section">Vault</div>
        {NAV.map(({ v, icon, label }) => (
          <div key={v} className={`sb-item ${view === v ? 'active' : ''}`} onClick={() => onNav(v)}>
            <span className="sb-icon">{icon}</span>
            {label}
            <span className="sb-count">{stats[v] ?? 0}</span>
          </div>
        ))}

        <div className="sb-section" style={{ marginTop: 8 }}>Other</div>
        <div className={`sb-item ${view === 'favorites' ? 'active' : ''}`} onClick={() => onNav('favorites')}>
          <span className="sb-icon">★</span>
          Favourites
          <span className="sb-count">{stats.favorites ?? 0}</span>
        </div>
        <div className={`sb-item ${view === 'pending' ? 'active' : ''}`} onClick={() => onNav('pending')}>
          <span className="sb-icon">📬</span>
          Pending
          {pendingCount > 0
            ? <span className="sb-pulse" />
            : <span className="sb-count">{pendingCount}</span>}
        </div>
        <div className={`sb-item ${view === 'trash' ? 'active' : ''}`} onClick={() => onNav('trash')}>
          <span className="sb-icon">🗑</span>
          Trash
          <span className="sb-count">{stats.trash ?? 0}</span>
        </div>
      </nav>

      <div className="sb-footer">
        <div className="user-row">
          <div className="avatar">{(user?.name || user?.email || 'V')[0].toUpperCase()}</div>
          <div className="user-name">{user?.name || user?.email || 'Vault User'}</div>
          <button className="logout-btn" onClick={logout} title="Sign out">⏻</button>
        </div>
      </div>
    </aside>
  );
}
