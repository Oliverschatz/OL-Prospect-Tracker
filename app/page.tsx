'use client';

import { useState, useEffect } from 'react';
import Tracker from '@/components/Tracker';

const APP_PASSWORD_HASH = process.env.NEXT_PUBLIC_APP_PASSWORD_HASH || '';

async function hashPassword(pw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pw);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('pbp_auth');
    if (stored === 'ok') setUnlocked(true);
    // If no password hash configured, skip authentication
    if (!APP_PASSWORD_HASH) setUnlocked(true);
    setChecking(false);
  }, []);

  const handleSubmit = async () => {
    const hash = await hashPassword(input);
    if (hash === APP_PASSWORD_HASH) {
      sessionStorage.setItem('pbp_auth', 'ok');
      setUnlocked(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (checking) return null;
  if (unlocked) return <Tracker />;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--pbf-navy)' }}>
      <div style={{ background: 'var(--pbf-white)', borderRadius: 8, padding: '40px 36px', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, color: 'var(--pbf-navy)', marginBottom: 4 }}>
          Prospect Tracker
        </h1>
        <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginBottom: 24 }}>OliverLehmann.com</p>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="Password"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 15, textAlign: 'center',
              border: error ? '2px solid var(--pbf-red)' : '1px solid var(--pbf-border)',
              borderRadius: 'var(--radius)',
            }}
            autoFocus
          />
        </div>
        {error && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginBottom: 12 }}>Wrong password</p>}
        <button className="btn-primary" onClick={handleSubmit} style={{ width: '100%', padding: '10px', fontSize: 14 }}>
          Open
        </button>
      </div>
    </div>
  );
}
