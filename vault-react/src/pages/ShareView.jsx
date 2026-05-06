import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ShareView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId');
  const token = searchParams.get('token');
  const [item, setItem] = useState(null);
  const [files, setFiles] = useState([]);
  const [sharedBy, setSharedBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!requestId || !token) { setErr('Invalid share link.'); setLoading(false); return; }
    fetch(`${import.meta.env.VITE_API_URL}/share/view?requestId=${requestId}&token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Access denied.');
        setItem(data.data?.item || data.item);
        setFiles(data.data?.files || []);
        setSharedBy(data.data?.shared_by || '');
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const isImage = (mime) => mime?.startsWith('image/');
  const isVideo = (mime) => mime?.startsWith('video/');

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#d4a843,#7a5e20)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔐</div>
          <span style={{ fontWeight: 800, fontSize: 20 }}>Va<span style={{ color: '#d4a843' }}>ult</span></span>
        </div>

        {loading && <p style={{ color: '#888' }}>Loading shared item…</p>}

        {err && (
          <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ color: '#e05252', margin: '0 0 8px' }}>Access Error</h2>
            <p style={{ color: '#888', margin: 0 }}>{err}</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>Back to login</button>
          </div>
        )}

        {item && (
          <div>
            {sharedBy && <p style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Shared by <strong style={{ color: '#d4a843' }}>{sharedBy}</strong></p>}
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{item.title}</h1>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 24, textTransform: 'capitalize' }}>{item.type}</p>

            {/* Only show fields if NOT media type */}
            {item.type !== 'media' && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {item.username && <Field label="Username" value={item.username} />}
                {item.secret && <Field label="Password" value={item.secret} secret />}
                {item.url && <Field label="URL" value={item.url} isUrl />}
                {item.content && <Field label="Content" value={item.content} />}
                {item.card_number && <Field label="Card Number" value={item.card_number} secret />}
                {item.expiry && <Field label="Expiry" value={item.expiry} />}
                {item.cvv && <Field label="CVV" value={item.cvv} secret />}
                {item.cardholder && <Field label="Cardholder" value={item.cardholder} />}
                {item.first_name && <Field label="First Name" value={item.first_name} />}
                {item.last_name && <Field label="Last Name" value={item.last_name} />}
                {item.phone && <Field label="Phone" value={item.phone} />}
                {item.address && <Field label="Address" value={item.address} />}
                {item.notes && <Field label="Notes" value={item.notes} />}
              </div>
            )}

            {/* Media files */}
            {files.length > 0 && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Files ({files.length})</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {files.map(f => (
                    <div key={f.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                      {isImage(f.mime_type) ? (
                        <img src={f.signed_url} alt={f.original_name} style={{ width: '100%', height: 160, objectFit: 'cover', cursor: 'pointer' }} onClick={() => setLightbox(f)} />
                      ) : isVideo(f.mime_type) ? (
                        <video src={f.signed_url} style={{ width: '100%', height: 160, objectFit: 'cover', cursor: 'pointer' }} onClick={() => setLightbox(f)} />
                      ) : (
                        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📄</div>
                      )}
                      <div style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.original_name}</div>
                        <a href={f.signed_url} download={f.original_name} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#d4a843', textDecoration: 'none' }}>⬇ Download</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.type === 'media' && item.notes && (
              <div style={{ marginTop: 16, color: '#888', fontSize: 14 }}>
                <strong style={{ color: '#fff' }}>Notes:</strong> {item.notes}
              </div>
            )}

            <button className="btn btn-ghost" style={{ marginTop: 32 }} onClick={() => navigate('/login')}>Back to login</button>
          </div>
        )}
      </div>

      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setLightbox(null)}>
          <button style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }} onClick={() => setLightbox(null)}>✕</button>
          {isVideo(lightbox.mime_type)
            ? <video src={lightbox.signed_url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()} />
            : <img src={lightbox.signed_url} alt={lightbox.original_name} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          }
        </div>
      )}
    </div>
  );
}

function Field({ label, value, secret, isUrl }) {
  const [shown, setShown] = useState(!secret);
  const copy = () => navigator.clipboard.writeText(value);
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontSize: 14, color: '#fff', fontFamily: secret ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
          {isUrl ? <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#d4a843' }}>{value}</a> : shown ? value : '••••••••••••'}
        </div>
        {secret && <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }} onClick={() => setShown(p => !p)}>{shown ? '🙈' : '👁'}</button>}
        <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }} onClick={copy}>⎘</button>
      </div>
    </div>
  );
}
