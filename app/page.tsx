'use client';

import { useState, useEffect } from 'react';
import { signIn, signUp, signOut, onAuthStateChange } from '@/lib/auth';
import Tracker from '@/components/Tracker';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
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

  const handleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e: unknown) {
      setError((e as Error).message || 'Login failed');
    }
    setSubmitting(false);
  };

  const handleRegister = async () => {
    setError('');
    setInfo('');
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    try {
      await signUp(email, password, fullName);
      setInfo('Registration successful! Check your email to confirm, then log in.');
      setMode('login');
      setPassword('');
    } catch (e: unknown) {
      setError((e as Error).message || 'Registration failed');
    }
    setSubmitting(false);
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
  };

  if (checking) return null;

  if (user) {
    return (
      <Tracker
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--pbf-navy)' }}>
      <div style={{ background: 'var(--pbf-white)', borderRadius: 8, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, color: 'var(--pbf-navy)', marginBottom: 4 }}>
            Prospect Tracker
          </h1>
          <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 0 }}>Brand Ambassador Portal</p>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', marginBottom: 20, borderBottom: '2px solid var(--pbf-border)' }}>
          <button
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: mode === 'login' ? '2px solid var(--pbf-navy)' : '2px solid transparent',
              color: mode === 'login' ? 'var(--pbf-navy)' : 'var(--pbf-muted)',
              marginBottom: -2,
            }}
          >
            Log In
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: mode === 'register' ? '2px solid var(--pbf-navy)' : '2px solid transparent',
              color: mode === 'register' ? 'var(--pbf-navy)' : 'var(--pbf-muted)',
              marginBottom: -2,
            }}
          >
            Register
          </button>
        </div>

        {info && (
          <div style={{ background: 'var(--pbf-green-bg)', color: 'var(--pbf-green)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 12 }}>
            {info}
          </div>
        )}

        {mode === 'register' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
            />
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
            onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') handleLogin(); }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'Min. 6 characters' : 'Password'}
            style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
            onKeyDown={e => {
              if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleRegister();
            }}
          />
        </div>

        {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button
          className="btn-primary"
          onClick={mode === 'login' ? handleLogin : handleRegister}
          disabled={submitting}
          style={{ width: '100%', padding: '10px', fontSize: 14 }}
        >
          {submitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>

        <p style={{ fontSize: 11, color: 'var(--pbf-muted)', textAlign: 'center', marginTop: 20 }}>
          Oliver F. Lehmann &middot; OliverLehmann.com
        </p>
      </div>
    </div>
  );
}
