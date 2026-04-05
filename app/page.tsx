'use client';

import { useState, useEffect } from 'react';
import { signIn, signUp, signOut, resetPassword, changePassword, onAuthStateChange } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Tracker from '@/components/Tracker';
import AdminDashboard from '@/components/AdminDashboard';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'tracker' | 'admin' | 'settings'>('tracker');
  const [checking, setChecking] = useState(true);
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
      if (u) checkAdmin(u.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
    setIsAdmin(data?.is_admin === true);
  };

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

  const handleForgot = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) { setError('Please enter your email'); return; }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setInfo('Password reset email sent! Check your inbox.');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to send reset email');
    }
    setSubmitting(false);
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setIsAdmin(false);
    setView('tracker');
  };

  if (checking) return null;

  // ─── Logged in ───
  if (user) {
    if (view === 'admin' && isAdmin) {
      return <AdminDashboard user={user} onBack={() => setView('tracker')} />;
    }

    if (view === 'settings') {
      return <SettingsPanel user={user} isAdmin={isAdmin} onBack={() => setView('tracker')} onAdmin={() => setView('admin')} onLogout={handleLogout} />;
    }

    return (
      <Tracker
        user={user}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        onAdmin={() => setView('admin')}
        onSettings={() => setView('settings')}
      />
    );
  }

  // ─── Login / Register / Forgot Password ───
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--pbf-navy)' }}>
      <div style={{ background: 'var(--pbf-white)', borderRadius: 8, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, color: 'var(--pbf-navy)', marginBottom: 4 }}>
            Prospect Tracker
          </h1>
          <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 0 }}>Brand Ambassador Portal</p>
        </div>

        {mode === 'forgot' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 16, textAlign: 'center' }}>
              Enter your email to receive a password reset link.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
                onKeyDown={e => { if (e.key === 'Enter') handleForgot(); }}
              />
            </div>
            {info && <div style={{ background: 'var(--pbf-green-bg)', color: 'var(--pbf-green)', padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 12 }}>{info}</div>}
            {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn-primary" onClick={handleForgot} disabled={submitting} style={{ width: '100%', padding: '10px', fontSize: 14 }}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
            <p style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setMode('login'); setError(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: 'var(--pbf-blue)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
                Back to login
              </button>
            </p>
          </>
        ) : (
          <>
            {/* Tab toggle */}
            <div style={{ display: 'flex', marginBottom: 20, borderBottom: '2px solid var(--pbf-border)' }}>
              <button
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: mode === 'login' ? '2px solid var(--pbf-navy)' : '2px solid transparent',
                  color: mode === 'login' ? 'var(--pbf-navy)' : 'var(--pbf-muted)', marginBottom: -2,
                }}
              >Log In</button>
              <button
                onClick={() => { setMode('register'); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: mode === 'register' ? '2px solid var(--pbf-navy)' : '2px solid transparent',
                  color: mode === 'register' ? 'var(--pbf-navy)' : 'var(--pbf-muted)', marginBottom: -2,
                }}
              >Register</button>
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
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
                onKeyDown={e => { if (e.key === 'Enter' && mode === 'login') handleLogin(); }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 6 characters' : 'Password'}
                style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}
                onKeyDown={e => { if (e.key === 'Enter') mode === 'login' ? handleLogin() : handleRegister(); }} />
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

// ─── Settings Panel (password change) ───
function SettingsPanel({ user, isAdmin, onBack, onAdmin, onLogout }: {
  user: User; isAdmin: boolean; onBack: () => void; onAdmin: () => void; onLogout: () => void;
}) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = async () => {
    setError('');
    setSuccess('');
    if (newPw.length < 6) { setError('New password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      await changePassword(newPw);
      setSuccess('Password changed successfully!');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to change password');
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="app-header">
        <h1>Settings <span>— OliverLehmann.com</span></h1>
        <div className="header-actions">
          <button className="btn-secondary btn-sm" onClick={onBack}>Back to Tracker</button>
          {isAdmin && <button className="btn-secondary btn-sm" onClick={onAdmin}>Admin</button>}
          <button className="btn-ghost btn-sm" onClick={onLogout} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 480 }}>
        <div className="section">
          <div className="section-header"><h3>Account</h3></div>
          <div className="section-body">
            <div className="field-row full">
              <div className="field-group">
                <label>Email</label>
                <input value={user.email || ''} disabled style={{ background: 'var(--pbf-light)' }} />
              </div>
            </div>
            <div className="field-row full">
              <div className="field-group">
                <label>Name</label>
                <input value={user.user_metadata?.full_name || ''} disabled style={{ background: 'var(--pbf-light)' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header"><h3>Change Password</h3></div>
          <div className="section-body">
            <div className="field-row full">
              <div className="field-group">
                <label>New Password</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 6 characters" />
              </div>
            </div>
            <div className="field-row full">
              <div className="field-group">
                <label>Confirm New Password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password"
                  onKeyDown={e => { if (e.key === 'Enter') handleChange(); }} />
              </div>
            </div>
            {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
            {success && <p style={{ color: 'var(--pbf-green)', fontSize: 13, marginBottom: 8 }}>{success}</p>}
            <button className="btn-primary" onClick={handleChange} disabled={submitting}>
              {submitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
