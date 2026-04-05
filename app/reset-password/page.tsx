'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase will automatically pick up the tokens from the URL hash
    if (!supabase) return;
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!supabase) { setError('Not configured'); return; }

    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); return; }
    setSuccess(true);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--pbf-navy)' }}>
      <div style={{ background: 'var(--pbf-white)', borderRadius: 8, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, color: 'var(--pbf-navy)', marginBottom: 4 }}>
            Reset Password
          </h1>
          <p style={{ fontSize: 13, color: 'var(--pbf-muted)' }}>Prospect Tracker</p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--pbf-green)', fontSize: 14, marginBottom: 16 }}>Password updated successfully!</p>
            <a href="/" className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px', fontSize: 14, textDecoration: 'none' }}>
              Go to Login
            </a>
          </div>
        ) : !ready ? (
          <p style={{ textAlign: 'center', color: 'var(--pbf-muted)', fontSize: 13 }}>
            Verifying reset link...
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              />
            </div>
            {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn-primary" onClick={handleSubmit} style={{ width: '100%', padding: '10px', fontSize: 14 }}>
              Set New Password
            </button>
          </>
        )}
      </div>
    </div>
  );
}
