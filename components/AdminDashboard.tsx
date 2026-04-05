'use client';

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserStats {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  companies: number;
  contacts: number;
  activities: number;
  last_activity: string | null;
}

interface Totals {
  users: number;
  companies: number;
  contacts: number;
  activities: number;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
}

async function getToken() {
  if (!supabase) return '';
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

export default function AdminDashboard({ user, onBack }: { user: User; onBack: () => void }) {
  const [tab, setTab] = useState<'overview' | 'users'>('overview');
  const [stats, setStats] = useState<{ totals: Totals; users: UserStats[] } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [testEmailMsg, setTestEmailMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
      ]);

      if (!statsRes.ok || !usersRes.ok) {
        setError('Failed to load admin data. Are you an admin?');
        setLoading(false);
        return;
      }

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleInvite = async () => {
    setInviteMsg('');
    if (!inviteEmail || !invitePassword) { setInviteMsg('Email and password required'); return; }
    if (invitePassword.length < 6) { setInviteMsg('Password must be at least 6 characters'); return; }
    const token = await getToken();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName, password: invitePassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteMsg(`Created: ${data.email}`);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      fetchData();
    } else {
      setInviteMsg(`Error: ${data.error}`);
    }
  };

  const handleTestEmail = async () => {
    setTestEmailMsg('Sending...');
    const token = await getToken();
    const res = await fetch('/api/admin/test-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setTestEmailMsg(`Test email sent to ${data.to}`);
    } else {
      setTestEmailMsg(`Error: ${data.error}`);
    }
    setTimeout(() => setTestEmailMsg(''), 8000);
  };

  const handleToggleBan = async (userId: string, currentlyBanned: boolean) => {
    if (userId === user.id) { alert('Cannot ban yourself'); return; }
    const action = currentlyBanned ? 'unban' : 'ban';
    if (!confirm(`${action === 'ban' ? 'Disable' : 'Re-enable'} this user?`)) return;
    const token = await getToken();
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action }),
    });
    fetchData();
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('de-DE') : '—';

  if (loading) return <div className="loading-screen">Loading admin data...</div>;
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--pbf-red)', marginBottom: 16 }}>{error}</p>
      <button className="btn-ghost" onClick={onBack}>Back to Tracker</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="app-header">
        <h1>Admin Dashboard <span>— OliverLehmann.com</span></h1>
        <div className="header-actions">
          <button className="btn-secondary btn-sm" onClick={onBack}>Back to Tracker</button>
          <span style={{ fontSize: 11, color: 'var(--pbf-muted)', marginLeft: 8 }}>{user.email}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--pbf-white)', borderBottom: '1px solid var(--pbf-border)', padding: '0 24px', display: 'flex', gap: 0 }}>
        {(['overview', 'users'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--pbf-navy)' : '2px solid transparent',
              color: tab === t ? 'var(--pbf-navy)' : 'var(--pbf-muted)',
            }}
          >
            {t === 'overview' ? 'Usage Overview' : 'Manage Users'}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 960 }}>
        {tab === 'overview' && stats && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Brand Ambassadors', value: stats.totals.users, color: 'var(--pbf-blue)' },
                { label: 'Total Companies', value: stats.totals.companies, color: 'var(--stage-qualified)' },
                { label: 'Total Contacts', value: stats.totals.contacts, color: 'var(--stage-contacted)' },
                { label: 'Total Activities', value: stats.totals.activities, color: 'var(--stage-dialogue)' },
              ].map(card => (
                <div key={card.label} className="section" style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--pbf-muted)', marginTop: 4 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Test email */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn-primary btn-sm" onClick={handleTestEmail}>Send Test Email</button>
              {testEmailMsg && (
                <span style={{ fontSize: 13, color: testEmailMsg.startsWith('Error') ? 'var(--pbf-red)' : 'var(--pbf-green)' }}>{testEmailMsg}</span>
              )}
            </div>

            {/* Per-user usage table */}
            <div className="section">
              <div className="section-header"><h3>Usage per Ambassador</h3></div>
              <div className="section-body" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--pbf-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Ambassador</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Companies</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Contacts</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Activities</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Last Sign-in</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--pbf-light)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{u.full_name || '(no name)'}</div>
                          <div style={{ fontSize: 11, color: 'var(--pbf-muted)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{u.companies}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{u.contacts}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{u.activities}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--pbf-muted)' }}>{fmtDate(u.last_sign_in_at)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--pbf-muted)' }}>{fmtDate(u.last_activity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'users' && (
          <>
            {/* Invite form */}
            <div className="section" style={{ marginBottom: 24 }}>
              <div className="section-header"><h3>Invite New Brand Ambassador</h3></div>
              <div className="section-body">
                <div className="field-row">
                  <div className="field-group">
                    <label>Email</label>
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="ambassador@example.com" />
                  </div>
                  <div className="field-group">
                    <label>Full Name</label>
                    <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name" />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field-group">
                    <label>Initial Password</label>
                    <input type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="Min. 6 characters" />
                  </div>
                  <div className="field-group" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-primary" onClick={handleInvite} style={{ alignSelf: 'flex-end' }}>Create Account</button>
                  </div>
                </div>
                {inviteMsg && (
                  <p style={{ fontSize: 13, marginTop: 8, color: inviteMsg.startsWith('Error') ? 'var(--pbf-red)' : 'var(--pbf-green)' }}>{inviteMsg}</p>
                )}
              </div>
            </div>

            {/* User list */}
            <div className="section">
              <div className="section-header"><h3>All Users</h3></div>
              <div className="section-body" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--pbf-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>User</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Joined</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Last Sign-in</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--pbf-light)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{u.full_name || '(no name)'}</div>
                          <div style={{ fontSize: 11, color: 'var(--pbf-muted)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--pbf-muted)' }}>{fmtDate(u.created_at)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--pbf-muted)' }}>{fmtDate(u.last_sign_in_at)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`stage-badge ${u.banned ? 'stage-lost' : 'stage-won'}`}>
                            {u.banned ? 'Disabled' : 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {u.id !== user.id && (
                            <button
                              className={u.banned ? 'btn-ghost btn-sm' : 'btn-danger btn-sm'}
                              onClick={() => handleToggleBan(u.id, u.banned)}
                            >
                              {u.banned ? 'Re-enable' : 'Disable'}
                            </button>
                          )}
                          {u.id === user.id && <span style={{ fontSize: 11, color: 'var(--pbf-muted)' }}>You</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
