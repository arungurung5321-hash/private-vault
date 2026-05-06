import { useState, useEffect } from 'react';
import { TYPE_META, TYPE_FIELDS, FIELD_LABELS, SENSITIVE, timeAgo } from '../lib/constants';
import { useToast } from '../hooks/useToast';

export default function DetailPanel({ item, onClose, onEdit, onDelete, onShare }) {
  const [revealed, setRevealed] = useState(new Set());
  const toast = useToast();
  const m     = TYPE_META[item.type] || TYPE_META.password;
  const fields = TYPE_FIELDS[item.type] || [];

  useEffect(() => setRevealed(new Set()), [item.id]);

  const copy = (val, label) => {
    navigator.clipboard.writeText(val)
      .then(() => toast(`${label} copied!`, 'ok'))
      .catch(() => toast('Copy failed', 'err'));
  };

  const toggleReveal = (f) => {
    setRevealed(prev => {
      const n = new Set(prev);
      n.has(f) ? n.delete(f) : n.add(f);
      return n;
    });
  };

  return (
    <>
      <div className="detail-head">
        <div className="detail-type">{m.icon} {m.label.toUpperCase()}</div>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>✕ Close</button>
      </div>

      <div className="detail-body">
        <div className="detail-title">{item.title}</div>
        <div className="detail-updated">Updated {timeAgo(item.updated_at)}</div>
        <div className="divider" />

        {fields.map(f => {
          const val = item[f];
          if (!val) return null;
          const isSens  = SENSITIVE.has(f);
          const shown   = revealed.has(f);
          const display = isSens && !shown ? '••••••••••••' : val;

          return (
            <div key={f} className="field">
              <div className="field-label">{FIELD_LABELS[f] || f}</div>
              <div className={`field-val ${isSens && !shown ? 'masked' : ''}`}>
                {f === 'url' && shown
                  ? <a href={val} target="_blank" rel="noopener noreferrer">{val}</a>
                  : display}
              </div>
              <div className="field-actions">
                {isSens && (
                  <button className="btn btn-ghost btn-xs" onClick={() => toggleReveal(f)}>
                    {shown ? '🙈 Hide' : '👁 Reveal'}
                  </button>
                )}
                <button className="btn btn-ghost btn-xs" onClick={() => copy(val, FIELD_LABELS[f] || f)}>
                  ⎘ Copy
                </button>
              </div>
            </div>
          );
        })}

        {item.url && !fields.includes('url') && (
          <div className="field">
            <div className="field-label">URL</div>
            <div className="field-val">
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
            </div>
          </div>
        )}

        {(item.tags || []).length > 0 && (
          <div className="field">
            <div className="field-label">Tags</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
              {item.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="detail-foot">
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>✏️ Edit</button>
        {item.type === 'media' && (
          <button className="btn btn-secondary btn-sm" onClick={() => onShare(false)}>📁 Files</button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => onShare(true)}>🔗 Share</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>🗑</button>
      </div>
    </>
  );
}