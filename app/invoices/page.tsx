'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { onAuthStateChange, signIn } from '@/lib/auth';
import InvoicesApp from '@/components/InvoicesApp';

export default function InvoicesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

  if (checking) return null;
  if (user) return <InvoicesApp user={user} />;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--pbf-navy)' }}>
      <div style={{ background: 'var(--pbf-white)', borderRadius: 8, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="https://oliverlehmann.com/wp-content/uploads/2023/05/cropped-logo-ol.png" alt="Oliver F. Lehmann" style={{ height: 56, marginBottom: 12 }} />
          <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, color: 'var(--pbf-navy)', marginBottom: 4 }}>Invoices</h1>
          <p style={{ fontSize: 13, color: 'var(--pbf-muted)' }}>OliverLehmann.com</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
            style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pbf-muted)', display: 'block', marginBottom: 4 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
            onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
            style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }} />
        </div>
        {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button className="btn-primary" onClick={handleLogin} disabled={submitting} style={{ width: '100%', padding: '10px', fontSize: 14 }}>
          {submitting ? 'Please wait…' : 'Log In'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--pbf-muted)', textAlign: 'center', marginTop: 20 }}>
          Oliver F. Lehmann · OliverLehmann.com
        </p>
      </div>
    </div>
  );
}
