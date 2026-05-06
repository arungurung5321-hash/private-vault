import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';

export default function Login() {
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const navigate = useNavigate();
  const toast    = useToast();

  const submit = async (e) => {
    e?.preventDefault();
    setErr('');
    if (!email || !pw) { setErr('Email and password are required.'); return; }
    setLoading(true);
    try {
      await api.auth.login(email, pw);
      toast('Welcome back!', 'ok');
      navigate('/');
    } catch (err) {
      setErr(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const goToShare = (e) => {
    e?.preventDefault();
    if (!shareCode.trim()) return;
    navigate('/share/' + shareCode.trim().toUpperCase());
  };

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 52 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#d4a843,#7a5e20)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔐</div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>Va<span style={{ color: 'var(--amber)' }}>ult</span></span>
        </div>
        <h1 className="auth-headline">Your secrets,<br />kept <em>forever.</em></h1>
        <p className="auth-sub">AES-256 encrypted. JWT secured. One vault for passwords, keys, notes, cards, and identities.</p>
        <div className="auth-feats">
          {['Passwords & API keys', 'Encrypted secure notes', 'Payment cards & identities', 'File galleries with sharing', 'One-time share codes'].map((f, i) => (
            <div key={i} className="auth-feat-item">
              <div className="auth-feat-dot" />
              {f}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 32, padding: '16px', background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Got a share code?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input mono"
              placeholder="Enter code e.g. IFEZS9RK"
              value={shareCode}
              onChange={e => setShareCode(e.target.value.toUpperCase())}
              style={{ flex: 1, letterSpacing: 4, fontSize: 14 }}
            />
            <button className="btn btn-primary" onClick={goToShare} style={{ padding: '8px 16px', fontSize: 13 }}>
              Go
            </button>
          </div>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-box animate-fade">
          <h2>Welcome back</h2>
          <p>Sign in to access your vault</p>
          {err && <div className="auth-error">⚠ {err}</div>}
          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrap">
                <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
                <button type="button" className="input-action" onClick={() => setShowPw(!showPw)}>{showPw ? '🙈' : '👁'}</button>
              </div>
            </div>
            <button className="btn btn-primary btn-full" style={{ padding: '11px', fontSize: 14 }} type="submit" disabled={loading}>
              {loading ? <><div className="spinner" />Unlocking vault…</> : 'Unlock Vault'}
            </button>
            <p className="auth-switch">Don't have an account? <span onClick={() => navigate('/register')}>Create one</span></p>
          </form>
        </div>
      </div>
    </div>
  );
}
