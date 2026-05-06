import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, Auth } from '../lib/api';
import { TYPE_META, timeAgo } from '../lib/constants';
import { useToast } from '../hooks/useToast';
import Sidebar from '../components/Sidebar';
import ItemCard from '../components/ItemCard';
import DetailPanel from '../components/DetailPanel';
import ItemModal from '../components/ItemModal';
import ShareModal from '../components/ShareModal';
import MediaModal from '../components/MediaModal';

export default function Dashboard() {
  const [user, setUser]         = useState(null);
  const [items, setItems]       = useState([]);
  const [trashItems, setTrash]  = useState([]);
  const [pending, setPending]   = useState([]);
  const [stats, setStats]       = useState({});
  const [view, setView]         = useState('all');
  const [search, setSearch]     = useState('');
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // {type: 'add'|'edit'|'delete'|'share'|'media', item?}
  const navigate    = useNavigate();
  const toast       = useToast();
  const searchTimer = useRef(null);
  const [searchParams] = useSearchParams();

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Auth.loggedIn()) { navigate('/login'); return; }

    // Handle email deeplinks
    const action    = searchParams.get('action');
    const requestId = searchParams.get('requestId');
    if (action && requestId) handleDeeplink(action, requestId);

    loadAll();
    loadPending();
    const interval = setInterval(loadPending, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUser(), loadItems(), loadStats()]);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const res = await api.auth.me();
      setUser(res.data?.user || res.user || {});
    } catch {}
  };

  const loadItems = async () => {
    try {
      const res = await api.vault.items();
      setItems(res.data?.items || res.items || []);
    } catch (e) { toast('Failed to load items', 'err'); }
  };

  const loadStats = async () => {
    try {
      const res = await api.vault.stats();
      const s   = res.data?.stats || res.stats || {};
      setStats(s);
    } catch {}
  };

  const loadPending = async () => {
    try {
      const res = await api.share.pending();
      setPending(res.data?.requests || []);
    } catch {}
  };

  const loadTrash = async () => {
    try {
      const res = await api.vault.trash();
      setTrash(res.data?.items || res.items || []);
    } catch {}
  };

  // ── Deeplink (email approve/deny) ────────────────────────────────────────
  const handleDeeplink = async (action, requestId) => {
    try {
      await api.share.respond(requestId, action);
      toast(action === 'approve' ? '✓ Access approved!' : '✕ Access denied', 'ok');
      navigate('/', { replace: true });
    } catch (e) { toast('Could not process request: ' + e.message, 'err'); }
  };

  // ── Nav ──────────────────────────────────────────────────────────────────────
  const navTo = (v) => {
    setView(v); setActiveId(null); setSearch('');
    if (v === 'trash') loadTrash();
  };

  // ── Filtered items ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = items;
    if (view === 'favorites') list = items.filter(i => i.is_favorite);
    else if (TYPE_META[view])  list = items.filter(i => i.type === view);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.title + ' ' + (i.username || '') + ' ' + (i.notes || '') + ' ' + (i.tags || []).join(' ')).toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, view, search]);

  const activeItem = useMemo(() => items.find(i => i.id === activeId) || null, [items, activeId]);

  // ── Sidebar stats ────────────────────────────────────────────────────────────
  const sideStats = useMemo(() => {
    const counts = { all: items.length, favorites: items.filter(i => i.is_favorite).length, trash: trashItems.length };
    Object.keys(TYPE_META).forEach(t => { counts[t] = items.filter(i => i.type === t).length; });
    return counts;
  }, [items, trashItems]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const saveItem = async (data) => {
    if (data.id) {
      const res = await api.vault.update(data.id, data);
      const updated = res.data?.item || res.item || { ...data };
      setItems(p => p.map(i => i.id === data.id ? { ...i, ...updated } : i));
      toast('Item updated!', 'ok');
      if (activeId === data.id) setActiveId(null); // reset to reload
      setTimeout(() => setActiveId(data.id), 50);
    } else {
      const res = await api.vault.create(data);
      const created = res.data?.item || res.item || data;
      setItems(p => [created, ...p]);
      toast('Item saved!', 'ok');
    }
    setModal(null);
    loadStats();
  };

  const toggleFav = async (id, val) => {
    try {
      await api.vault.update(id, { is_favorite: val });
      setItems(p => p.map(i => i.id === id ? { ...i, is_favorite: val } : i));
      toast(val ? 'Added to favourites ★' : 'Removed from favourites', 'info');
    } catch { toast('Failed', 'err'); }
  };

  const deleteItem = async (id) => {
    try {
      await api.vault.delete(id);
      setItems(p => p.filter(i => i.id !== id));
      if (activeId === id) setActiveId(null);
      toast('Moved to trash', 'info');
      setModal(null);
      loadStats();
    } catch { toast('Failed to delete', 'err'); }
  };

  const restoreItem = async (id) => {
    try {
      await api.vault.restore(id);
      const item = trashItems.find(i => i.id === id);
      setTrash(p => p.filter(i => i.id !== id));
      if (item) setItems(p => [item, ...p]);
      toast('Item restored!', 'ok');
      loadStats();
    } catch { toast('Failed to restore', 'err'); }
  };

  const hardDelete = async (id) => {
    if (!confirm('Permanently delete? This cannot be undone.')) return;
    try {
      await api.vault.hardDelete(id);
      setTrash(p => p.filter(i => i.id !== id));
      toast('Permanently deleted');
    } catch { toast('Failed', 'err'); }
  };

  const respondRequest = async (reqId, action) => {
    try {
      await api.share.respond(reqId, action);
      setPending(p => p.filter(r => r.id !== reqId));
      toast(action === 'approve' ? '✓ Approved — email sent!' : '✕ Denied', 'ok');
    } catch { toast('Failed', 'err'); }
  };

  // ── Search debounce ──────────────────────────────────────────────────────────
  const onSearch = (v) => {
    setSearch(v);
  };

  // ── View titles ──────────────────────────────────────────────────────────────
  const viewTitle = {
    all: 'All Items', favorites: 'Favourites', trash: 'Trash', pending: 'Pending Requests',
    ...Object.fromEntries(Object.entries(TYPE_META).map(([k, m]) => [k, m.label + 's'])),
  }[view] || 'Vault';

  const showSearch = !['trash', 'pending'].includes(view);
  const showAdd    = !['trash', 'pending'].includes(view);

  return (
    <div className="app-layout">
      <Sidebar
        view={view}
        onNav={navTo}
        stats={sideStats}
        user={user}
        pendingCount={pending.length}
      />

      <main className="main-area">
        <div className="topbar">
          <div className="topbar-title">{viewTitle}</div>
          {showSearch && (
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input placeholder="Search vault…" value={search} onChange={e => onSearch(e.target.value)} />
            </div>
          )}
          {showAdd && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'add' })}>
              + New Item
            </button>
          )}
        </div>

        <div className="content-body">
          <div className="items-area">

            {/* Stats bar */}
            {view === 'all' && !loading && (
              <div className="stats-grid">
                {Object.entries(TYPE_META).slice(0, 5).map(([t, m]) => (
                  <div key={t} className="stat-card" onClick={() => navTo(t)}>
                    <div className="stat-icon">{m.icon}</div>
                    <div className="stat-num">{sideStats[t] || 0}</div>
                    <div className="stat-label">{m.label}s</div>
                  </div>
                ))}
              </div>
            )}

            {/* Loading skeletons */}
            {loading && (
              <div className="items-grid">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="item-card" style={{ height: 96 }}>
                    <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 10 }} />
                    <div className="skeleton" style={{ height: 11, width: '40%' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Pending requests */}
            {!loading && view === 'pending' && (
              pending.length === 0
                ? <Empty icon="📬" title="No pending requests" sub="When someone requests access to your items, they'll appear here." />
                : pending.map(r => (
                    <div key={r.id} className="pending-card">
                      <div className="pending-who">👤 {r.accessor_name || r.accessor_email}</div>
                      <div className="pending-item">Wants access to: <strong>{r.item_title}</strong> ({r.item_type})</div>
                      <div className="pending-meta">📧 {r.accessor_email} · 🕐 {timeAgo(r.requested_at)}{r.ip_address ? ` · 🌐 ${r.ip_address}` : ''}</div>
                      <div className="pending-acts">
                        <button className="btn btn-xs" style={{ background: 'rgba(74,222,128,0.15)', color: 'var(--green)', borderColor: 'rgba(74,222,128,0.3)' }} onClick={() => respondRequest(r.id, 'approve')}>✓ Approve</button>
                        <button className="btn btn-danger btn-xs" onClick={() => respondRequest(r.id, 'deny')}>✕ Deny</button>
                      </div>
                    </div>
                  ))
            )}

            {/* Trash */}
            {!loading && view === 'trash' && (
              trashItems.length === 0
                ? <Empty icon="🗑" title="Trash is empty" sub="Deleted items will appear here." />
                : trashItems.map(item => (
                    <div key={item.id} className="trash-card">
                      <div style={{ fontSize: 22 }}>{TYPE_META[item.type]?.icon || '📄'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--red)' }}>{timeAgo(item.deleted_at || item.updated_at)}</div>
                      </div>
                      <button className="btn btn-ghost btn-xs" onClick={() => restoreItem(item.id)}>↩ Restore</button>
                      <button className="btn btn-danger btn-xs" onClick={() => hardDelete(item.id)}>✕ Delete</button>
                    </div>
                  ))
            )}

            {/* Main items grid */}
            {!loading && !['trash', 'pending'].includes(view) && (
              filtered.length === 0
                ? <Empty
                    icon="🔐"
                    title={search ? 'No results found' : 'Nothing here yet'}
                    sub={search ? 'Try a different search term' : 'Click + New Item to add your first entry'}
                  />
                : <div className="items-grid">
                    {filtered.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        selected={activeId === item.id}
                        onOpen={setActiveId}
                        onFav={toggleFav}
                      />
                    ))}
                  </div>
            )}
          </div>

          {/* Detail panel */}
          <div className={`detail-panel ${activeItem ? '' : 'closed'}`}>
            {activeItem && (
              <DetailPanel
                item={activeItem}
                onClose={() => setActiveId(null)}
                onEdit={async () => {
  const res = await api.vault.get(activeItem.id);
  const fullItem = res.data?.item || res.item || activeItem;
  setModal({ type: 'edit', item: fullItem });
}}
                onDelete={() => setModal({ type: 'delete', id: activeItem.id })}
                onShare={(shareOnly) => setModal({ type: shareOnly ? 'share' : (activeItem.type === 'media' ? 'media' : 'share'), item: activeItem })}
              />
            )}
          </div>
        </div>
      </main>

      {/* FAB */}
      <button
        onClick={() => setModal({ type: 'add' })}
        style={{ position: 'fixed', bottom: 28, right: 28, width: 52, height: 52, borderRadius: '50%', background: 'var(--amber)', color: '#0a0a0a', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(212,168,67,0.4)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', zIndex: 100 }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1) rotate(45deg)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'}
      >+</button>

      {/* Modals */}
      {modal?.type === 'add' && (
        <ItemModal defaultType={TYPE_META[view] ? view : 'password'} onSave={saveItem} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <ItemModal item={modal.item} onSave={saveItem} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          title="Move to trash?"
          body="This item will be moved to trash. You can restore it later."
          onConfirm={() => deleteItem(modal.id)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'share' && modal.item && (
        <ShareModal item={modal.item} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'media' && modal.item && (
        <MediaModal item={modal.item} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function Empty({ icon, title, sub }) {
  return (
    <div className="empty animate-fade">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  );
}

function ConfirmModal({ title, body, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text1)', fontSize: 14 }}>{body}</p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Move to Trash</button>
        </div>
      </div>
    </div>
  );
}
