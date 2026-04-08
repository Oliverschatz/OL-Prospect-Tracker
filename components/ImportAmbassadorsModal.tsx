'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ParsedRow {
  name: string;
  email: string;
  location: string;
  country: string;
  linkedin: string;
  valid: boolean;
  reason?: string;
}

interface RowResult {
  email: string;
  status: 'created' | 'updated' | 'error';
  error?: string;
  email_sent?: boolean;
  email_error?: string;
}

interface ImportResponse {
  total: number;
  created: number;
  updated: number;
  errors: number;
  results: RowResult[];
}

// Map many possible header variants to our canonical field names.
// Lookup is case-insensitive, whitespace-collapsed.
const HEADER_MAP: Record<string, keyof Omit<ParsedRow, 'valid' | 'reason'>> = {
  'ambassadorname': 'name',
  'ambassador name': 'name',
  'name': 'name',
  'full name': 'name',
  'fullname': 'name',
  'email': 'email',
  'e-mail': 'email',
  'mail': 'email',
  'location': 'location',
  'city': 'location',
  'country': 'country',
  'linkedin contact': 'linkedin',
  'linkedin': 'linkedin',
  'linkedin url': 'linkedin',
  'linkedin profile': 'linkedin',
};

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function getToken(): Promise<string> {
  if (!supabase) return '';
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

export default function ImportAmbassadorsModal({ onClose }: { onClose: () => void }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [sendWelcome, setSendWelcome] = useState(true);
  const [importing, setImporting] = useState(false);
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [networkError, setNetworkError] = useState('');

  const handleFile = async (file: File) => {
    setParseError('');
    setRows([]);
    setResponse(null);
    setFileName(file.name);
    try {
      // Dynamic import — only load xlsx when the user actually picks a file.
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        setParseError('The file has no sheets.');
        return;
      }
      const sheet = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });

      const parsed: ParsedRow[] = [];
      for (const r of raw) {
        const rec: ParsedRow = { name: '', email: '', location: '', country: '', linkedin: '', valid: false };
        for (const [key, val] of Object.entries(r)) {
          const field = HEADER_MAP[normaliseHeader(key)];
          if (field) rec[field] = String(val ?? '').trim();
        }
        // Skip fully empty trailing rows
        if (!rec.email && !rec.name && !rec.location && !rec.country && !rec.linkedin) continue;
        if (!rec.email) {
          rec.valid = false;
          rec.reason = 'Missing email';
        } else if (!isValidEmail(rec.email)) {
          rec.valid = false;
          rec.reason = 'Invalid email';
        } else {
          rec.valid = true;
        }
        parsed.push(rec);
      }

      if (parsed.length === 0) {
        setParseError('No rows found. Make sure the sheet has a header row with at least an "Email" column.');
        return;
      }
      setRows(parsed);
    } catch (e: unknown) {
      setParseError(`Could not parse the file: ${(e as Error).message || 'unknown error'}`);
    }
  };

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  const handleImport = async () => {
    if (validCount === 0 || importing) return;
    setImporting(true);
    setNetworkError('');
    setResponse(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/import-ambassadors', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows
            .filter((r) => r.valid)
            .map((r) => ({ name: r.name, email: r.email, location: r.location, country: r.country, linkedin: r.linkedin })),
          send_welcome: sendWelcome,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNetworkError(data?.error || `HTTP ${res.status}`);
      } else {
        setResponse(data as ImportResponse);
      }
    } catch (e: unknown) {
      setNetworkError((e as Error).message || 'Network error');
    }
    setImporting(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(26,39,68,0.5)', zIndex: 1200,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 'var(--radius)', width: '100%', maxWidth: 900,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 20px', background: 'var(--pbf-navy)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'Georgia, "Source Serif 4", serif', fontSize: 16 }}>Import Brand Ambassadors from XLSX</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {!response && (
            <>
              <p style={{ fontSize: 13, color: 'var(--pbf-muted)', marginTop: 0 }}>
                Expected columns: <strong>AmbassadorName</strong>, <strong>Email</strong>, <strong>Location</strong>, <strong>Country</strong>, <strong>LinkedIn Contact</strong>.
                Existing users will be updated; new users will receive the welcome email with an auto-generated password.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <label className="btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                  Choose XLSX file…
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    style={{ display: 'none' }}
                  />
                </label>
                {fileName && <span style={{ fontSize: 12, color: 'var(--pbf-muted)' }}>{fileName}</span>}
              </div>

              {parseError && <p style={{ color: 'var(--pbf-red)', fontSize: 13 }}>{parseError}</p>}

              {rows.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--pbf-muted)', marginBottom: 6 }}>
                    {rows.length} rows parsed — {validCount} valid, {invalidCount} invalid.
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--pbf-light)' }}>
                        <tr>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Name</th>
                          <th style={thStyle}>Email</th>
                          <th style={thStyle}>Location</th>
                          <th style={thStyle}>Country</th>
                          <th style={thStyle}>LinkedIn</th>
                          <th style={thStyle}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--pbf-light)' }}>
                            <td style={tdStyle}>{i + 1}</td>
                            <td style={tdStyle}>{r.name || <em style={{ color: 'var(--pbf-muted)' }}>—</em>}</td>
                            <td style={tdStyle}>{r.email || <em style={{ color: 'var(--pbf-muted)' }}>—</em>}</td>
                            <td style={tdStyle}>{r.location}</td>
                            <td style={tdStyle}>{r.country}</td>
                            <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.linkedin}>{r.linkedin}</td>
                            <td style={tdStyle}>
                              {r.valid
                                ? <span style={{ color: 'var(--pbf-green)', fontWeight: 600 }}>OK</span>
                                : <span style={{ color: 'var(--pbf-red)' }}>{r.reason}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--pbf-muted)', marginTop: 12 }}>
                    <input type="checkbox" checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />
                    Send the &apos;welcome&apos; email to each newly created user
                  </label>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button className="btn-ghost btn-sm" onClick={onClose} disabled={importing}>Cancel</button>
                    <button
                      className="btn-primary"
                      onClick={handleImport}
                      disabled={validCount === 0 || importing}
                    >
                      {importing ? 'Importing…' : `Import ${validCount} ambassador${validCount === 1 ? '' : 's'}`}
                    </button>
                  </div>

                  {importing && (
                    <p style={{ fontSize: 12, color: 'var(--pbf-muted)', marginTop: 8 }}>
                      Creating accounts and sending welcome emails. Larger sheets can take a minute — please don&apos;t close this window.
                    </p>
                  )}
                  {networkError && <p style={{ color: 'var(--pbf-red)', fontSize: 13, marginTop: 8 }}>Error: {networkError}</p>}
                </>
              )}
            </>
          )}

          {response && (
            <>
              <div style={{
                padding: 12, marginBottom: 12, borderRadius: 'var(--radius)',
                background: 'var(--pbf-blue-bg)', border: '1px solid var(--pbf-blue)', fontSize: 13,
              }}>
                <strong>Done.</strong> {response.created} created, {response.updated} updated, {response.errors} error{response.errors === 1 ? '' : 's'} (of {response.total}).
              </div>

              <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--pbf-border)', borderRadius: 'var(--radius)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--pbf-light)' }}>
                    <tr>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Welcome email</th>
                      <th style={thStyle}>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.results.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--pbf-light)' }}>
                        <td style={tdStyle}>{r.email}</td>
                        <td style={tdStyle}>
                          {r.status === 'created' && <span style={{ color: 'var(--pbf-green)', fontWeight: 600 }}>Created</span>}
                          {r.status === 'updated' && <span style={{ color: 'var(--pbf-blue)', fontWeight: 600 }}>Updated</span>}
                          {r.status === 'error' && <span style={{ color: 'var(--pbf-red)', fontWeight: 600 }}>Error</span>}
                        </td>
                        <td style={tdStyle}>
                          {r.status !== 'created'
                            ? <span style={{ color: 'var(--pbf-muted)' }}>—</span>
                            : r.email_sent
                              ? <span style={{ color: 'var(--pbf-green)' }}>Sent</span>
                              : r.email_error
                                ? <span style={{ color: 'var(--pbf-red)' }}>Failed</span>
                                : <span style={{ color: 'var(--pbf-muted)' }}>Not sent</span>}
                        </td>
                        <td style={tdStyle}>
                          {r.error || r.email_error || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn-primary" onClick={onClose}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--pbf-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  verticalAlign: 'top',
};
