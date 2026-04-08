'use client';

import { STAGES } from '@/lib/constants';
import { today } from '@/lib/helpers';
import type { Company, StageKey } from '@/lib/types';

interface Props {
  companies: Company[];
  onSelectCompany?: (id: string) => void;
}

export default function Reports({ companies, onSelectCompany }: Props) {
  const todayStr = today();

  // Per-stage stats
  type StageStat = { stage: StageKey; label: string; color: string; count: number; value: number; weighted: number };
  const stageStats: StageStat[] = STAGES.map(s => {
    const list = companies.filter(c => c.stage === s.key);
    const value = list.reduce((sum, c) => sum + (c.expected_value || 0), 0);
    const weighted = list.reduce((sum, c) => sum + ((c.expected_value || 0) * (c.probability || 0) / 100), 0);
    return { stage: s.key, label: s.label, color: s.color, count: list.length, value, weighted };
  });

  const openStages = stageStats.filter(s => s.stage !== 'won' && s.stage !== 'lost');
  const totalOpen = openStages.reduce((a, b) => a + b.count, 0);
  const totalValue = openStages.reduce((a, b) => a + b.value, 0);
  const totalWeighted = openStages.reduce((a, b) => a + b.weighted, 0);
  const wonValue = stageStats.find(s => s.stage === 'won')?.value || 0;
  const wonCount = stageStats.find(s => s.stage === 'won')?.count || 0;

  // Activities per week (last 8 weeks)
  const weeks: { label: string; start: string; end: string; count: number }[] = [];
  const now = new Date();
  // Start of this week (Mon)
  const day = now.getDay() || 7; // Sunday = 0 -> 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  for (let i = 7; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    weeks.push({ label: startStr.slice(5), start: startStr, end: endStr, count: 0 });
  }
  for (const co of companies) {
    const all = [...co.activities, ...co.contacts.flatMap(ct => ct.activities || [])];
    for (const a of all) {
      const w = weeks.find(w => a.date >= w.start && a.date <= w.end);
      if (w) w.count++;
    }
  }
  const maxWeek = Math.max(1, ...weeks.map(w => w.count));

  // Follow-ups summary
  let overdue = 0, dueToday = 0, next7 = 0;
  const next7End = new Date();
  next7End.setDate(next7End.getDate() + 7);
  const next7Str = next7End.toISOString().slice(0, 10);
  for (const co of companies) {
    const all = [...(co.planned_events || []), ...co.contacts.flatMap(ct => ct.planned_events || [])];
    for (const e of all) {
      if (e.done) continue;
      if (e.event_date < todayStr) overdue++;
      else if (e.event_date === todayStr) dueToday++;
      else if (e.event_date <= next7Str) next7++;
    }
  }

  // Top 5 companies by weighted value
  const topByWeighted = [...companies]
    .filter(c => (c.expected_value || 0) > 0 && c.stage !== 'lost')
    .map(c => ({ co: c, weighted: (c.expected_value || 0) * (c.probability || 0) / 100 }))
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 5);

  const fmt = (n: number) => '€' + Math.round(n).toLocaleString();

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', color: 'var(--pbf-navy)', marginTop: 0 }}>Reports</h2>

      {/* KPI cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Kpi label="Open companies" value={String(totalOpen)} sub={`${companies.length} total`} />
        <Kpi label="Pipeline value" value={fmt(totalValue)} sub="Sum of expected values" />
        <Kpi label="Weighted pipeline" value={fmt(totalWeighted)} sub="Value × probability" highlight />
        <Kpi label="Won" value={fmt(wonValue)} sub={`${wonCount} companies`} />
        <Kpi label="Overdue follow-ups" value={String(overdue)} sub={`${dueToday} due today · ${next7} next 7 days`} alert={overdue > 0} />
      </div>

      {/* Pipeline by stage */}
      <div className="section">
        <div className="section-header"><h3>Pipeline by Stage</h3></div>
        <div className="section-body">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--pbf-border)', textAlign: 'left', color: 'var(--pbf-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 4px' }}>Stage</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Companies</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Pipeline value</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Weighted</th>
              </tr>
            </thead>
            <tbody>
              {stageStats.map(s => (
                <tr key={s.stage} style={{ borderBottom: '1px solid var(--pbf-light)' }}>
                  <td style={{ padding: '6px 4px' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: s.color, marginRight: 6, verticalAlign: 'middle' }} />
                    {s.label}
                  </td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{s.count}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{s.value > 0 ? fmt(s.value) : '—'}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{s.weighted > 0 ? fmt(s.weighted) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activities per week */}
      <div className="section">
        <div className="section-header"><h3>Activities (last 8 weeks)</h3></div>
        <div className="section-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '8px 0' }}>
            {weeks.map(w => (
              <div key={w.start} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--pbf-muted)' }}>{w.count}</div>
                <div
                  style={{
                    width: '100%',
                    height: `${(w.count / maxWeek) * 100}%`,
                    minHeight: 2,
                    background: 'var(--pbf-navy)',
                    borderRadius: '2px 2px 0 0',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--pbf-muted)' }}>{w.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top companies */}
      <div className="section">
        <div className="section-header"><h3>Top 5 by Weighted Value</h3></div>
        <div className="section-body">
          {topByWeighted.length === 0 && (
            <div style={{ color: 'var(--pbf-muted)', fontSize: 13, padding: 8 }}>
              No companies with expected value yet. Set "Expected Value" and "Probability" on a company to populate this.
            </div>
          )}
          {topByWeighted.map(({ co, weighted }) => (
            <div
              key={co.id}
              onClick={() => onSelectCompany?.(co.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 4px', borderBottom: '1px solid var(--pbf-light)', cursor: 'pointer', fontSize: 13,
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{co.name}</span>
                <span style={{ marginLeft: 8, color: 'var(--pbf-muted)', fontSize: 11 }}>
                  {STAGES.find(s => s.key === co.stage)?.label} · {co.probability ?? 0}%
                </span>
              </div>
              <div style={{ fontWeight: 600 }}>{fmt(weighted)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, highlight, alert }: { label: string; value: string; sub?: string; highlight?: boolean; alert?: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 180px',
        minWidth: 180,
        padding: 14,
        background: highlight ? 'var(--pbf-navy)' : alert ? 'var(--pbf-red-bg)' : 'var(--pbf-white)',
        color: highlight ? 'white' : alert ? 'var(--pbf-red)' : 'var(--pbf-text)',
        border: `1px solid ${highlight ? 'var(--pbf-navy)' : 'var(--pbf-border)'}`,
        borderRadius: 'var(--radius)',
      }}
    >
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
