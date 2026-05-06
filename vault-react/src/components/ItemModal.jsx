import { useState } from 'react';
import { TYPE_META } from '../lib/constants';

const EMPTY = {
  title:'', username:'', secret:'', url:'', notes:'', content:'',
  card_number:'', expiry:'', cvv:'', cardholder:'',
  first_name:'', last_name:'', phone:'', address:'',
  tags:'', is_favorite: false
};

export default function ItemModal({ item, defaultType = 'password', onSave, onClose }) {
  const isEdit = !!item;
  const [type, setType]   = useState(item?.type || defaultType);
  const [form, setForm]   = useState(() => item
    ? { ...EMPTY, ...item, tags: (item.tags || []).join(', ') }
    : { ...EMPTY }
  );
  const [showPw, setShowPw] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    setErr(''); setSaving(true);
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const data = { ...form, type, tags };
    if (isEdit) data.id = item.id;
    Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });
    data.tags = tags;
    data.is_favorite = form.is_favorite;
    try { await onSave(data); }
    catch (e) { setErr(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">{isEdit ? `Edit ${TYPE_META[type]?.label}` : 'New Item'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {err && <div style={{color:'var(--red)',fontSize:13,padding:'8px 12px',background:'rgba(224,82,82,0.1)',borderRadius:8}}>⚠ {err}</div>}
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={type} disabled={isEdit} onChange={e => setType(e.target.value)}>
              {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.icon} {m.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g. GitHub Account" value={form.title} onChange={set('title')} autoFocus />
          </div>
          {type === 'password' && <>
            <div className="form-group"><label className="form-label">Username / Email</label><input className="form-input" type="text" placeholder="john@example.com" value={form.username} onChange={set('username')} /></div>
            <div className="form-group"><label className="form-label">Password</label><div className="input-wrap"><input className="form-input mono" type={showPw?'text':'password'} placeholder="••••••••" value={form.secret} onChange={set('secret')} /><button type="button" className="input-action" onClick={()=>setShowPw(p=>!p)}>{showPw?'🙈':'👁'}</button></div></div>
            <div className="form-group"><label className="form-label">Website URL</label><input className="form-input" type="text" placeholder="https://example.com" value={form.url} onChange={set('url')} /></div>
          </>}
          {type === 'secret' && <div className="form-group"><label className="form-label">Secret Value</label><div className="input-wrap"><input className="form-input mono" type={showPw?'text':'password'} placeholder="API key, token…" value={form.secret} onChange={set('secret')} /><button type="button" className="input-action" onClick={()=>setShowPw(p=>!p)}>{showPw?'🙈':'👁'}</button></div></div>}
          {type === 'note' && <div className="form-group"><label className="form-label">Content</label><textarea className="form-textarea" placeholder="Write your secure note…" value={form.content} onChange={set('content')} style={{minHeight:120}} /></div>}
          {type === 'card' && <>
            <div className="form-group"><label className="form-label">Card Number</label><input className="form-input mono" type="text" placeholder="4111 1111 1111 1111" value={form.card_number} onChange={set('card_number')} /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="form-group"><label className="form-label">Expiry</label><input className="form-input mono" placeholder="MM/YY" value={form.expiry} onChange={set('expiry')} /></div>
              <div className="form-group">
                <label className="form-label">CVV</label>
                <div className="input-wrap">
                  <input className="form-input mono" type={showCvv?'text':'password'} placeholder="•••" value={form.cvv} onChange={set('cvv')} />
                  <button type="button" className="input-action" onClick={()=>setShowCvv(p=>!p)}>{showCvv?'🙈':'👁'}</button>
                </div>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Cardholder Name</label><input className="form-input" type="text" placeholder="John Doe" value={form.cardholder} onChange={set('cardholder')} /></div>
          </>}
          {type === 'identity' && <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="form-group"><label className="form-label">First Name</label><input className="form-input" type="text" placeholder="John" value={form.first_name} onChange={set('first_name')} /></div>
              <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" type="text" placeholder="Doe" value={form.last_name} onChange={set('last_name')} /></div>
            </div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" placeholder="+1 555 123 4567" value={form.phone} onChange={set('phone')} /></div>
            <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" style={{minHeight:70}} placeholder="123 Main St…" value={form.address} onChange={set('address')} /></div>
          </>}
          {type === 'media' && <p style={{fontSize:13,color:'var(--text1)',padding:'6px 0'}}>After creating this item, upload photos, videos and files from the detail panel.</p>}
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" style={{minHeight:70}} placeholder="Optional notes…" value={form.notes} onChange={set('notes')} /></div>
          <div className="form-group"><label className="form-label">Tags (comma separated)</label><input className="form-input" type="text" placeholder="work, personal, dev" value={form.tags} onChange={set('tags')} /></div>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--text1)'}}>
            <input type="checkbox" checked={form.is_favorite} onChange={e=>setForm(p=>({...p,is_favorite:e.target.checked}))} />
            Mark as favourite
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? <><div className="spinner"/>{isEdit?'Updating…':'Saving…'}</> : isEdit?'Update Item':'Save Item'}
          </button>
        </div>
      </div>
    </div>
  );
}