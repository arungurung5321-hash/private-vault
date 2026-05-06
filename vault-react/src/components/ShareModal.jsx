import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';

export default function ShareModal({ item, onClose }) {
  const [codes, setCodes]     = useState([]);
  const [label, setLabel]     = useState('');
  const [generated, setGen]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreate] = useState(false);
  const toast = useToast();

  useEffect(() => { loadCodes(); }, [item.id]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const res = await api.share.list(item.id);
      setCodes(res.data?.share_codes || []);
    } catch { toast('Failed to load share codes', 'err'); }
    finally { setLoading(false); }
  };

  const generate = async () => {
    setCreate(true);
    try {
      const res = await api.share.create(item.id, label);
      setGen(res.data);
      await loadCodes();
      toast('Share code generated!', 'ok');
    } catch (e) { toast(e.message || 'Failed', 'err'); }
    finally { setCreate(false); }
  };

  const revoke = async (codeId) => {
    try {
      await api.share.revoke(item.id, codeId);
      toast('Code revoked', 'info');
      await loadCodes();
    } catch { toast('Failed to revoke', 'err'); }
  };

  const copy = (text, label = 'Value') => {
    navigator.clipboard.writeText(text).then(() => toast(`${label} copied!`, 'ok'));
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">🔗 Share "{item.title}"</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.6 }}>
            Generate a one-time code. When your friend enters it, you'll receive an email to approve or deny the request.
          </p>

          {generated && (
            <div style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>New Share Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="share-badge" style={{ fontSize: 18, letterSpacing: '0.3em' }}>{generated.share_code?.code}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => copy(generated.share_code?.code, 'Share code')}>⎘ Copy Code</button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                Friend visits: <span style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{generated.share_url}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Label (optional)</label>
            <input className="form-input" placeholder="e.g. For Alice" value={label} onChange={e => setLabel(e.target.value)} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text2)' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : codes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 8 }}>Existing Codes</div>
              {codes.map(c => (
                <div key={c.id} className="share-code-row">
                  <div className="share-badge">{c.code}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label || 'No label'}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: c.status === 'active' ? 'var(--green)' : c.status === 'used' ? 'var(--teal)' : 'var(--red)', marginTop: 1 }}>
                      {c.status} · {c.request_count || 0} request(s)
                    </div>
                  </div>
                  {c.status === 'active' && (
                    <button className="btn btn-danger btn-xs" onClick={() => revoke(c.id)}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={generate} disabled={creating}>
            {creating ? <><div className="spinner" />Generating…</> : '🔗 Generate Code'}
          </button>
        </div>
      </div>
    </div>
  );
}
