import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Share() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    if (!email) { setErr('Email is required.'); return; }
    setErr(''); setLoading(true);
    try {
      const res = await fetch(import.meta.env.VITE_API_URL + '/share/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, accessor_email: email, accessor_name: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to request access.');
      setDone(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 52 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#d4a843,#7a5e20)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔐</div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>Va<span style={{ color: 'var(--amber)' }}>ult</span></span>
        </div>
        <h1 className="auth-headline">Someone shared<br /><em>something</em> with you.</h1>
        <p className="auth-sub">Enter your details to request access. The owner will be notified and can approve or deny your request.</p>
      </div>
      <div className="auth-panel">
        <div className="auth-box animate-fade">
          {done ? (
            <>
              <h2>Request sent!</h2>
              <p>The owner has been notified. You will receive an email once they approve your request.</p>
              <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>Back to login</button>
            </>
          ) : (
            <>
              <h2>Request access</h2>
              <p>Share code: <strong style={{ fontFamily: 'monospace', color: 'var(--amber)', letterSpacing: 4 }}>{code}</strong></p>
              {err && <div className="auth-error">⚠ {err}</div>}
              <form className="auth-form" onSubmit={submit} noValidate>
                <div className="form-group">
                  <label className="form-label">Your name</label>
                  <input className="form-input" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Your email *</label>
                  <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-full" style={{ padding: '11px', fontSize: 14 }} type="submit" disabled={loading}>
                  {loading ? <><div className="spinner" />Sending request…</> : 'Request Access'}
                </button>
                <p className="auth-switch"><span onClick={() => navigate('/login')}>Back to login</span></p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
