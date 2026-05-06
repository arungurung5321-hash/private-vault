import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';

export default function Register() {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp]         = useState('');
  const navigate = useNavigate();
  const toast    = useToast();

  const strength = useMemo(() => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }, [pw]);

  const strengthMeta = [
    { color: '#e05252', label: 'Weak' },
    { color: '#e08c52', label: 'Fair' },
    { color: '#c9a84c', label: 'Good' },
    { color: '#4ade80', label: 'Strong' },
    { color: '#3dd9c5', label: 'Excellent' },
  ];

  const submit = async (e) => {
    e?.preventDefault();
    setErr('');
    if (!email || !pw) { setErr('Email and password are required.'); return; }
    if (pw.length < 8)  { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== confirm) { setErr('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed.');
      if (data.message?.includes('OTP')) {
        setOtpSent(true);
        toast('OTP sent to your email!', 'ok');
      } else {
        api.auth.set?.(data.data?.accessToken, data.data?.refreshToken);
        toast('Vault created! Welcome 🔐', 'ok');
        navigate('/');
      }
    } catch (err) {
      setErr(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault();
    setErr('');
    if (!otp) { setErr('Please enter the OTP.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP.');
      const { Auth } = await import('../lib/api');
      Auth.set(data.data?.accessToken, data.data?.refreshToken);
      toast('Vault created! Welcome 🔐', 'ok');
      navigate('/');
    } catch (err) {
      setErr(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (otpSent) {
    return (
      <div className="auth-layout">
        <div className="auth-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 52 }}>
            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#d4a843,#7a5e20)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔐</div>
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>Va<span style={{ color: 'var(--amber)' }}>ult</span></span>
          </div>
          <h1 className="auth-headline">Check your<br /><em>email.</em></h1>
          <p className="auth-sub">We sent a 6-digit verification code to {email}. Enter it below to activate your vault.</p>
        </div>
        <div className="auth-panel">
          <div className="auth-box animate-fade">
            <h2>Verify your email</h2>
            <p>Enter the 6-digit code we sent to <strong>{email}</strong></p>
            {err && <div className="auth-error" style={{ marginBottom: 0 }}>⚠ {err}</div>}
            <form className="auth-form" onSubmit={verifyOtp} noValidate>
              <div className="form-group">
                <label className="form-label">Verification code</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  autoFocus
                  style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
                />
              </div>
              <button className="btn btn-primary btn-full" style={{ padding: '11px', fontSize: 14 }} type="submit" disabled={loading}>
                {loading ? <><div className="spinner" />Verifying…</> : 'Verify & Create Vault'}
              </button>
              <p className="auth-switch" onClick={submit} style={{ cursor: 'pointer' }}>Didn't receive it? <span>Resend code</span></p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 52 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#d4a843,#7a5e20)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔐</div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>Va<span style={{ color: 'var(--amber)' }}>ult</span></span>
        </div>
        <h1 className="auth-headline">One vault,<br /><em>everything</em> safe.</h1>
        <p className="auth-sub">Your digital life, encrypted and organized. Zero-knowledge architecture — only you can read your data.</p>
        <div className="auth-feats">
          {['AES-256-GCM encryption on all fields', 'JWT access + refresh token rotation', 'Supabase Storage for secure file uploads', 'One-time share codes with owner approval', 'Email alerts on every access request'].map((f, i) => (
            <div key={i} className="auth-feat-item">
              <div className="auth-feat-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-box animate-fade">
          <h2>Create account</h2>
          <p>Start securing your digital life</p>
          {err && <div className="auth-error" style={{ marginBottom: 0 }}>⚠ {err}</div>}
          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input className="form-input" type="text" placeholder="Arun Gurung" value={name} onChange={e => setName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password * <span style={{ color: 'var(--text2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(min 8 chars)</span></label>
              <div className="input-wrap">
                <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} />
                <button type="button" className="input-action" onClick={() => setShowPw(!showPw)}>{showPw ? '🙈' : '👁'}</button>
              </div>
              {pw && (
                <>
                  <div className="pw-strength">
                    <div className="pw-bar" style={{ width: `${strength * 20}%`, background: strengthMeta[strength - 1]?.color || '#e05252' }} />
                  </div>
                  <div style={{ fontSize: 11, color: strengthMeta[strength - 1]?.color || '#e05252', marginTop: 2 }}>
                    {strengthMeta[strength - 1]?.label || 'Too short'}
                  </div>
                </>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password *</label>
              <input className="form-input" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-full" style={{ padding: '11px', fontSize: 14 }} type="submit" disabled={loading}>
              {loading ? <><div className="spinner" />Creating vault…</> : 'Create My Vault'}
            </button>
            <p className="auth-switch">Already have an account? <span onClick={() => navigate('/login')}>Sign in</span></p>
          </form>
        </div>
      </div>
    </div>
  );
}