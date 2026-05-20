'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  onAuthStateChange, signIn, signUp, signOut, resetPassword,
} from '@/lib/auth';
import KanbanBoard from '@/components/KanbanBoard';

export default function KanbanPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // Auth UI state (mirrors / but kept local so the widget is self-contained)
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((u) => {
      setUser(u);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin() {
    setError('');
    setSubmitting(true);
    try { await signIn(email, password); }
    catch (e) { setError((e as Error).message || 'Login failed'); }
    setSubmitting(false);
  }

  async function handleRegister() {
    setError(''); setInfo('');
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    try {
      await signUp(email, password, fullName);
      setInfo('Registration successful! Check your email to confirm, then log in.');
      setMode('login');
      setPassword('');
    } catch (e) { setError((e as Error).message || 'Registration failed'); }
    setSubmitting(false);
  }

  async function handleForgot() {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Please enter your email'); return; }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setInfo('Password reset email sent! Check your inbox.');
    } catch (e) { setError((e as Error).message || 'Failed to send reset email'); }
    setSubmitting(false);
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
    router.refresh();
  }

  if (checking) return null;

  if (user) {
    return <KanbanBoard user={user} onLogout={handleLogout} />;
  }

  // ─── Standalone Kanban login ───
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--pbf-navy)' }}>
      <div style={{ background: 'var(--pbf-white)', borderRadius: 8, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, color: 'var(--pbf-navy)', marginBottom: 4 }}>
            Kanban Board
          </h1>
          <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 0 }}>OliverLehmann.com</p>
        </div>

        {mode === 'forgot' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 16, textAlign: 'center' }}>
              Enter your email to receive a password reset link.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                onKeyDown={e => { if (e.key === 'Enter') handleForgot(); }}
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }} />
            </div>
            {info && <div style={{ background: 'var(--pbf-green-bg)', color: 'var(--pbf-green)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 12 }}>{info}</div>}
            {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn-primary" onClick={handleForgot} disabled={submitting} style={{ width: '100%', padding: '10px', fontSize: 14 }}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
            <p style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--pbf-blue)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
                Back to login
              </button>
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', marginBottom: 20, borderBottom: '2px solid var(--pbf-border)' }}>
              <button onClick={() => { setMode('login'); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: mode === 'login' ? '2px solid var(--pbf-navy)' : '2px solid transparent',
                  color: mode === 'login' ? 'var(--pbf-navy)' : 'var(--pbf-muted)', marginBottom: -2,
                }}>Log In</button>
              <button onClick={() => { setMode('register'); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: mode === 'register' ? '2px solid var(--pbf-navy)' : '2px solid transparent',
                  color: mode === 'register' ? 'var(--pbf-navy)' : 'var(--pbf-muted)', marginBottom: -2,
                }}>Register</button>
            </div>

            {info && <div style={{ background: 'var(--pbf-green-bg)', color: 'var(--pbf-green)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 12 }}>{info}</div>}

            {mode === 'register' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }} />
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') handleLogin(); }}
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 6 characters' : 'Password'}
                onKeyDown={e => { if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleRegister(); }}
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }} />
            </div>

            {mode === 'login' && (
              <p style={{ fontSize: 12, textAlign: 'right', marginTop: -8, marginBottom: 12 }}>
                <button onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--pbf-blue)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
                  Forgot password?
                </button>
              </p>
            )}

            {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button className="btn-primary" onClick={mode === 'login' ? handleLogin : handleRegister}
              disabled={submitting} style={{ width: '100%', padding: '10px', fontSize: 14 }}>
              {submitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </>
        )}

        <p style={{ fontSize: 11, color: 'var(--pbf-muted)', textAlign: 'center', marginTop: 20 }}>
          Oliver F. Lehmann &middot; OliverLehmann.com
        </p>
      </div>
    </div>
  );
}
