'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/lib/helpers';
import ImportAmbassadorsModal from './ImportAmbassadorsModal';

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
  ambassador_code: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
}

interface AdminEmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

interface SharedTemplate {
  id: string;
  name: string;
  body: string;
  sort_order: number;
  updated_at: string;
}

async function getToken() {
  if (!supabase) return '';
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

type Tab = 'overview' | 'users' | 'email-templates' | 'shared-templates';

export default function AdminDashboard({ user, onBack }: { user: User; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<{ totals: Totals; users: UserStats[] } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<AdminEmailTemplate[]>([]);
  const [sharedTemplates, setSharedTemplates] = useState<SharedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharedTemplatesErr, setSharedTemplatesErr] = useState<string>('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [sendWelcome, setSendWelcome] = useState(true);

  // Per-user send-email modal
  const [sendTarget, setSendTarget] = useState<UserRow | null>(null);

  // Bulk import modal
  const [importOpen, setImportOpen] = useState(false);

  // Broadcast form
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastIncludeAdmins, setBroadcastIncludeAdmins] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const [testEmailMsg, setTestEmailMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [statsRes, usersRes, etRes, stRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/email-templates', { headers }),
        fetch('/api/admin/shared-templates', { headers }),
      ]);

      if (!statsRes.ok || !usersRes.ok) {
        setError('Failed to load admin data. Are you an admin?');
        setLoading(false);
        return;
      }

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
      if (etRes.ok) setEmailTemplates(await etRes.json());
      if (stRes.ok) {
        setSharedTemplates(await stRes.json());
        setSharedTemplatesErr('');
      } else {
        const err = await stRes.json().catch(() => ({ error: 'unknown' }));
        setSharedTemplatesErr(err.error || 'Unknown error');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Invite flow ───
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
    if (!res.ok) {
      setInviteMsg(`Error: ${data.error}`);
      return;
    }

    // Optionally send the welcome email using the 'welcome' admin template
    if (sendWelcome) {
      const welcome = emailTemplates.find(t => t.slug === 'welcome');
      if (!welcome) {
        setInviteMsg(`Created ${data.email} — but no 'welcome' email template found.`);
      } else {
        const sendRes = await fetch('/api/admin/send-user-email', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: data.id,
            subject: welcome.subject,
            body: welcome.body,
            vars: {
              FullName: inviteName || inviteEmail,
              Email: inviteEmail,
              TempPassword: invitePassword,
            },
          }),
        });
        if (sendRes.ok) {
          setInviteMsg(`Created ${data.email} and sent welcome email.`);
        } else {
          const err = await sendRes.json().catch(() => ({ error: 'unknown' }));
          setInviteMsg(`Created ${data.email} — but welcome email failed: ${err.error}`);
        }
      }
    } else {
      setInviteMsg(`Created: ${data.email}`);
    }

    setInviteEmail('');
    setInviteName('');
    setInvitePassword('');
    fetchData();
  };

  // ─── Test email ───
  const handleTestEmail = async () => {
    setTestEmailMsg('Sending...');
    const token = await getToken();
    const res = await fetch('/api/admin/test-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setTestEmailMsg(res.ok ? `Test email sent to ${data.to}` : `Error: ${data.error}`);
    setTimeout(() => setTestEmailMsg(''), 8000);
  };

  // ─── Ban / unban ───
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

  // ─── Broadcast ───
  const handleBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) {
      setBroadcastMsg('Subject and body required');
      return;
    }
    const activeCount = users.filter(u => !u.banned).length;
    if (!confirm(`Send this email to ${activeCount} ambassador${activeCount === 1 ? '' : 's'}?`)) return;
    setBroadcasting(true);
    setBroadcastMsg('Sending...');
    const token = await getToken();
    const res = await fetch('/api/admin/broadcast-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: broadcastSubject,
        body: broadcastBody,
        include_admins: broadcastIncludeAdmins,
      }),
    });
    const data = await res.json();
    setBroadcasting(false);
    if (res.ok) {
      setBroadcastMsg(`Sent to ${data.sent} of ${data.total}${data.failed ? ` — ${data.failed} failed` : ''}.`);
      setBroadcastSubject('');
      setBroadcastBody('');
    } else {
      setBroadcastMsg(`Error: ${data.error}`);
    }
  };

  // ─── Admin email templates CRUD ───
  // Returns true on success so the editor can keep the form open on error.
  const saveEmailTemplate = async (t: AdminEmailTemplate, isNew: boolean): Promise<boolean> => {
    const token = await getToken();
    const res = await fetch('/api/admin/email-templates', {
      method: isNew ? 'POST' : 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    if (res.ok) { fetchData(); return true; }
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    alert(`Could not save template: ${err.error}`);
    return false;
  };
  const deleteEmailTemplate = async (id: string) => {
    if (!confirm('Delete this email template?')) return;
    const token = await getToken();
    const res = await fetch(`/api/admin/email-templates?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      alert(`Could not delete template: ${err.error}`);
    }
    fetchData();
  };

  // ─── Shared templates CRUD ───
  const saveSharedTemplate = async (t: SharedTemplate, isNew: boolean): Promise<boolean> => {
    const token = await getToken();
    // New templates get placed at the end of the existing order.
    const payload = isNew
      ? { ...t, sort_order: sharedTemplates.length }
      : t;
    const res = await fetch('/api/admin/shared-templates', {
      method: isNew ? 'POST' : 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { fetchData(); return true; }
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    alert(`Could not save template: ${err.error}\n\nIf this says the table is missing, run supabase/add-shared-templates.sql in the Supabase SQL editor.`);
    return false;
  };
  const deleteSharedTemplate = async (id: string) => {
    if (!confirm('Delete this shared template?')) return;
    const token = await getToken();
    const res = await fetch(`/api/admin/shared-templates?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      alert(`Could not delete template: ${err.error}`);
    }
    fetchData();
  };
  const reorderSharedTemplates = async (orderedIds: string[]): Promise<void> => {
    const token = await getToken();
    // Optimistic reorder so the UI updates instantly.
    setSharedTemplates(prev => {
      const byId = new Map(prev.map(t => [t.id, t]));
      return orderedIds
        .map((id, i) => {
          const t = byId.get(id);
          return t ? { ...t, sort_order: i } : null;
        })
        .filter((t): t is SharedTemplate => t !== null);
    });
    const res = await fetch('/api/admin/shared-templates', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderedIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'unknown' }));
      alert(`Could not reorder templates: ${err.error}`);
      fetchData();
    }
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
      <div style={{ background: 'var(--pbf-white)', borderBottom: '1px solid var(--pbf-border)', padding: '0 24px', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
        {([
          ['overview', 'Usage Overview'],
          ['users', 'Manage Users'],
          ['email-templates', 'Email Templates'],
          ['shared-templates', 'Shared Templates'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--pbf-navy)' : '2px solid transparent',
              color: tab === t ? 'var(--pbf-navy)' : 'var(--pbf-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1000 }}>
        {/* ─── Overview tab ─── */}
        {tab === 'overview' && stats && (
          <>
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

            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn-primary btn-sm" onClick={handleTestEmail}>Send Test Email</button>
              {testEmailMsg && (
                <span style={{ fontSize: 13, color: testEmailMsg.startsWith('Error') ? 'var(--pbf-red)' : 'var(--pbf-green)' }}>{testEmailMsg}</span>
              )}
            </div>

            {/* Broadcast to all ambassadors */}
            <div className="section" style={{ marginBottom: 24 }}>
              <div className="section-header"><h3>Broadcast Email to All Ambassadors</h3></div>
              <div className="section-body">
                <p style={{ fontSize: 12, color: 'var(--pbf-muted)', marginBottom: 10 }}>
                  Placeholders: [FullName], [Email], [LoginUrl], [AdminName], [Code]
                </p>
                <div className="field-group" style={{ marginBottom: 10 }}>
                  <label>Subject</label>
                  <input value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} placeholder="Subject line" />
                </div>
                <div className="field-group" style={{ marginBottom: 10 }}>
                  <label>Body</label>
                  <textarea rows={8} value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} placeholder="Hello [FullName], ..." style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--pbf-muted)', marginBottom: 10 }}>
                  <input type="checkbox" checked={broadcastIncludeAdmins} onChange={e => setBroadcastIncludeAdmins(e.target.checked)} />
                  Also send to admin users
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button className="btn-primary" onClick={handleBroadcast} disabled={broadcasting}>
                    {broadcasting ? 'Sending…' : `Send to ${users.filter(u => !u.banned).length} ambassadors`}
                  </button>
                  {broadcastMsg && (
                    <span style={{ fontSize: 13, color: broadcastMsg.startsWith('Error') ? 'var(--pbf-red)' : 'var(--pbf-green)' }}>{broadcastMsg}</span>
                  )}
                </div>
              </div>
            </div>

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

        {/* ─── Users tab ─── */}
        {tab === 'users' && (
          <>
            <div className="section" style={{ marginBottom: 24 }}>
              <div className="section-header"><h3>Bulk Import from XLSX</h3></div>
              <div className="section-body">
                <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginTop: 0, marginBottom: 10 }}>
                  Upload an Excel sheet with columns <strong>AmbassadorName</strong>, <strong>Email</strong>, <strong>Location</strong>, <strong>Country</strong>, <strong>LinkedIn Contact</strong>.
                  Existing users will be updated; new users receive the welcome email with an auto-generated password.
                </p>
                <button className="btn-primary" onClick={() => setImportOpen(true)}>Import XLSX…</button>
              </div>
            </div>

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
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--pbf-muted)', marginTop: 6 }}>
                  <input type="checkbox" checked={sendWelcome} onChange={e => setSendWelcome(e.target.checked)} />
                  Send welcome email (uses the &apos;welcome&apos; template in Email Templates)
                </label>
                {inviteMsg && (
                  <p style={{ fontSize: 13, marginTop: 8, color: inviteMsg.startsWith('Error') ? 'var(--pbf-red)' : 'var(--pbf-green)' }}>{inviteMsg}</p>
                )}
              </div>
            </div>

            <div className="section">
              <div className="section-header"><h3>All Users</h3></div>
              <div className="section-body" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--pbf-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>User</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Code</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Joined</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Last Sign-in</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--pbf-light)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{u.full_name || '(no name)'}</div>
                          <div style={{ fontSize: 11, color: 'var(--pbf-muted)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'ui-monospace, monospace', color: u.ambassador_code ? 'var(--pbf-text)' : 'var(--pbf-muted)' }}>
                          {u.ambassador_code || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--pbf-muted)' }}>{fmtDate(u.created_at)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--pbf-muted)' }}>{fmtDate(u.last_sign_in_at)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`stage-badge ${u.banned ? 'stage-lost' : 'stage-won'}`}>
                            {u.banned ? 'Disabled' : 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
                          <button className="btn-ghost btn-sm" onClick={() => setSendTarget(u)} title="Send a one-off email">Email</button>
                          {u.id !== user.id ? (
                            <button
                              className={u.banned ? 'btn-ghost btn-sm' : 'btn-danger btn-sm'}
                              onClick={() => handleToggleBan(u.id, u.banned)}
                            >
                              {u.banned ? 'Re-enable' : 'Disable'}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--pbf-muted)', alignSelf: 'center' }}>You</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ─── Email Templates tab ─── */}
        {tab === 'email-templates' && (
          <EmailTemplatesEditor
            templates={emailTemplates}
            onSave={saveEmailTemplate}
            onDelete={deleteEmailTemplate}
          />
        )}

        {/* ─── Shared Templates tab ─── */}
        {tab === 'shared-templates' && (
          <>
            {sharedTemplatesErr && (
              <div className="section" style={{ marginBottom: 16, borderColor: 'var(--pbf-red)' }}>
                <div className="section-body" style={{ color: 'var(--pbf-red)', fontSize: 13 }}>
                  <strong>Shared templates unavailable:</strong> {sharedTemplatesErr}
                  {/schema cache|shared_templates/i.test(sharedTemplatesErr) && (
                    <div style={{ marginTop: 6, color: 'var(--pbf-muted)' }}>
                      Run <code>supabase/add-shared-templates.sql</code> in the Supabase SQL editor to create the missing table, then reload this page.
                    </div>
                  )}
                </div>
              </div>
            )}
            <SharedTemplatesEditor
              templates={sharedTemplates}
              onSave={saveSharedTemplate}
              onDelete={deleteSharedTemplate}
              onReorder={reorderSharedTemplates}
            />
          </>
        )}
      </div>

      {/* Send email modal */}
      {sendTarget && (
        <SendUserEmailModal
          target={sendTarget}
          templates={emailTemplates}
          onClose={() => setSendTarget(null)}
        />
      )}

      {/* Bulk import modal */}
      {importOpen && (
        <ImportAmbassadorsModal
          onClose={() => { setImportOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}

// ─── Admin email-templates editor ───
function EmailTemplatesEditor({
  templates,
  onSave,
  onDelete,
}: {
  templates: AdminEmailTemplate[];
  onSave: (t: AdminEmailTemplate, isNew: boolean) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<{ id: string; slug: string; name: string; subject: string; body: string }>({
    id: '', slug: '', name: '', subject: '', body: '',
  });

  const startEdit = (t: AdminEmailTemplate) => {
    setEditing(t.id);
    setForm({ id: t.id, slug: t.slug, name: t.name, subject: t.subject, body: t.body });
  };
  const startNew = () => {
    setEditing('new');
    setForm({ id: generateId(), slug: '', name: '', subject: '', body: '' });
  };
  const save = async () => {
    if (!form.slug.trim() || !form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      alert('slug, name, subject, body are required');
      return;
    }
    // Client-side slug-collision check for new templates — gives a friendlier
    // message than the raw Postgres unique-violation error.
    if (editing === 'new' && templates.some(t => t.slug.toLowerCase() === form.slug.trim().toLowerCase())) {
      alert(`A template with slug '${form.slug.trim()}' already exists — choose another slug.`);
      return;
    }
    const ok = await onSave({ ...form, updated_at: new Date().toISOString() }, editing === 'new');
    if (ok) setEditing(null);
  };

  return (
    <div className="section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Admin Email Templates</h3>
        <button className="btn-primary btn-sm" onClick={startNew}>+ New Template</button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: 'var(--pbf-muted)', marginBottom: 12 }}>
          These templates are used when the admin sends emails to brand ambassadors (e.g. the welcome email on account creation).
          The slug <code>welcome</code> is the one used by the invite form. Placeholders:
          [FullName], [Email], [LoginUrl], [TempPassword], [AdminName], [Code].
        </p>

        {templates.map(t => (
          <div key={t.id} style={{ marginBottom: 10, padding: 12, background: 'var(--pbf-light)', borderRadius: 'var(--radius)', border: '1px solid var(--pbf-border)' }}>
            {editing === t.id ? (
              <EmailTemplateForm
                form={form}
                setForm={setForm}
                onSave={save}
                onCancel={() => setEditing(null)}
                isNew={false}
              />
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name} <span style={{ fontSize: 11, color: 'var(--pbf-muted)', fontWeight: 500 }}>— slug: {t.slug}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>Subject: {t.subject}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost btn-sm" onClick={() => startEdit(t)} title="Edit this template">Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => onDelete(t.id)} title="Delete this template">Delete</button>
                  </div>
                </div>
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.4 }}>{t.body}</pre>
              </div>
            )}
          </div>
        ))}

        {editing === 'new' && (
          <div style={{ marginBottom: 10, padding: 12, background: 'var(--pbf-yellow-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--pbf-border)' }}>
            <EmailTemplateForm
              form={form}
              setForm={setForm}
              onSave={save}
              onCancel={() => setEditing(null)}
              isNew={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EmailTemplateForm({
  form,
  setForm,
  onSave,
  onCancel,
  isNew,
}: {
  form: { id: string; slug: string; name: string; subject: string; body: string };
  setForm: (f: { id: string; slug: string; name: string; subject: string; body: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  return (
    <div>
      <div className="field-row">
        <div className="field-group">
          <label>Slug (e.g. welcome, reminder)</label>
          <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} />
        </div>
        <div className="field-group">
          <label>Display Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
      </div>
      <div className="field-group" style={{ marginBottom: 8 }}>
        <label>Subject</label>
        <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
      </div>
      <div className="field-group" style={{ marginBottom: 8 }}>
        <label>Body</label>
        <textarea value={form.body} rows={10} onChange={e => setForm({ ...form, body: e.target.value })} style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn-primary btn-sm" onClick={onSave}>{isNew ? 'Create' : 'Save'}</button>
        <button className="btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Shared templates editor ───
function SharedTemplatesEditor({
  templates,
  onSave,
  onDelete,
  onReorder,
}: {
  templates: SharedTemplate[];
  onSave: (t: SharedTemplate, isNew: boolean) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<SharedTemplate>({
    id: '', name: '', body: '', sort_order: 0, updated_at: '',
  });

  // Defensive local sort. The API already orders by sort_order, but if two
  // rows share the same sort_order (legacy data), fall back to name so the
  // list is deterministic.
  const sorted = [...templates].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });

  const startEdit = (t: SharedTemplate) => {
    setEditing(t.id);
    setForm({ ...t });
  };
  const startNew = () => {
    setEditing('new');
    setForm({ id: generateId(), name: '', body: '', sort_order: templates.length, updated_at: '' });
  };
  const save = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      alert('name and body are required');
      return;
    }
    const ok = await onSave(form, editing === 'new');
    if (ok) setEditing(null);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const newOrder = sorted.map(t => t.id);
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    void onReorder(newOrder);
  };

  return (
    <div className="section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Shared Message Templates</h3>
        <button className="btn-primary btn-sm" onClick={startNew}>+ New Template</button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: 'var(--pbf-muted)', marginBottom: 12 }}>
          These message templates are available read-only to every brand ambassador in their &ldquo;Use Template&rdquo; dialog.
          Use the same placeholders the ambassadors know: [Salutation], [FirstName], [LastName], [Company], [AmbassadorName], [Code], etc.
          <br />
          <span style={{ fontSize: 11 }}>
            <code>[Code]</code> is replaced with each ambassador&apos;s personal code at send time.
            Reorder templates with the ↑ / ↓ arrows; the order applies to every ambassador.
          </span>
        </p>

        {sorted.map((t, idx) => (
          <div key={t.id} style={{ marginBottom: 10, padding: 12, background: 'var(--pbf-light)', borderRadius: 'var(--radius)', border: '1px solid var(--pbf-border)' }}>
            {editing === t.id ? (
              <SharedTemplateForm form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} isNew={false} />
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                        style={{ padding: '0 6px', lineHeight: 1, minWidth: 'auto' }}
                      >↑</button>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => move(idx, 1)}
                        disabled={idx === sorted.length - 1}
                        title="Move down"
                        style={{ padding: '0 6px', lineHeight: 1, minWidth: 'auto' }}
                      >↓</button>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      <span style={{ color: 'var(--pbf-muted)', fontWeight: 500, marginRight: 6 }}>{idx + 1}.</span>
                      {t.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost btn-sm" onClick={() => startEdit(t)} title="Edit this template">Edit</button>
                    <button className="btn-danger btn-sm" onClick={() => onDelete(t.id)} title="Delete this template">Delete</button>
                  </div>
                </div>
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.4 }}>{t.body}</pre>
              </div>
            )}
          </div>
        ))}

        {editing === 'new' && (
          <div style={{ marginBottom: 10, padding: 12, background: 'var(--pbf-yellow-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--pbf-border)' }}>
            <SharedTemplateForm form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} isNew={true} />
          </div>
        )}
      </div>
    </div>
  );
}

function SharedTemplateForm({
  form,
  setForm,
  onSave,
  onCancel,
  isNew,
}: {
  form: SharedTemplate;
  setForm: (t: SharedTemplate) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
}) {
  return (
    <div>
      <div className="field-group" style={{ marginBottom: 8 }}>
        <label>Name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="field-group" style={{ marginBottom: 8 }}>
        <label>Body</label>
        <textarea value={form.body} rows={10} onChange={e => setForm({ ...form, body: e.target.value })} style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn-primary btn-sm" onClick={onSave}>{isNew ? 'Create' : 'Save'}</button>
        <button className="btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Send one-off email to a single user ───
function SendUserEmailModal({
  target,
  templates,
  onClose,
}: {
  target: UserRow;
  templates: AdminEmailTemplate[];
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const t = templates.find(x => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setMsg('Subject and body required'); return; }
    setSending(true);
    setMsg('Sending...');
    const token = await getToken();
    const res = await fetch('/api/admin/send-user-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: target.id,
        subject,
        body,
        vars: { FullName: target.full_name || target.email, Email: target.email },
      }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setMsg(`Sent to ${data.to}`);
      setTimeout(onClose, 1200);
    } else {
      setMsg(`Error: ${data.error}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 620 }}>
        <div className="modal-header">
          <h3>Send Email to {target.full_name || target.email}</h3>
          <button className="btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body">
          <div className="field-group" style={{ marginBottom: 10 }}>
            <label>Template (optional)</label>
            <select value={templateId} onChange={e => applyTemplate(e.target.value)}>
              <option value="">— Choose template —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: 11, color: 'var(--pbf-muted)', margin: '0 0 10px 0' }}>
            Placeholders: [FullName], [Email], [LoginUrl], [AdminName], [Code]
          </p>
          <div className="field-group" style={{ marginBottom: 10 }}>
            <label>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="field-group" style={{ marginBottom: 10 }}>
            <label>Body</label>
            <textarea rows={10} value={body} onChange={e => setBody(e.target.value)} style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
          </div>
          {msg && (
            <p style={{ fontSize: 13, color: msg.startsWith('Error') ? 'var(--pbf-red)' : 'var(--pbf-green)', margin: 0 }}>{msg}</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSend} disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}
