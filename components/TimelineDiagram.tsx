'use client';

import { StageBadge } from '@/components/ui';
import type { Company, PlannedEvent } from '@/lib/types';

interface TimelineEntry {
  id: string;
  label: string;
  sublabel?: string;
  companyId: string;
  eventDate: string;
  description: string;
  stage: Company['stage'];
  done: boolean;
  type: 'company' | 'contact';
}

function getStatus(entry: TimelineEntry, todayStr: string): 'future' | 'today' | 'overdue' | 'completed' {
  if (entry.done) return 'completed';
  if (entry.eventDate < todayStr) return 'overdue';
  if (entry.eventDate === todayStr) return 'today';
  return 'future';
}

function statusColor(status: string): string {
  switch (status) {
    case 'future': return 'var(--pbf-text)';
    case 'today': return '#d69e2e';
    case 'completed': return 'var(--stage-won)';
    case 'overdue': return 'var(--pbf-red)';
    default: return 'var(--pbf-text)';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'future': return 'var(--pbf-light)';
    case 'today': return 'var(--pbf-yellow-bg)';
    case 'completed': return 'var(--pbf-green-bg)';
    case 'overdue': return 'var(--pbf-red-bg)';
    default: return 'var(--pbf-light)';
  }
}

function statusDot(status: string): string {
  switch (status) {
    case 'future': return 'var(--pbf-text)';
    case 'today': return '#d69e2e';
    case 'completed': return 'var(--stage-won)';
    case 'overdue': return 'var(--pbf-red)';
    default: return 'var(--pbf-text)';
  }
}

export default function TimelineDiagram({ companies, onSelectCompany, filter = 'pending', title = 'Follow-up Timeline' }: {
  companies: Company[];
  onSelectCompany: (id: string, eventId?: string) => void;
  filter?: 'pending' | 'history';
  title?: string;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Build entries from planned_events (and from the activity log for the history view)
  const entries: TimelineEntry[] = [];

  for (const co of companies) {
    for (const ev of co.planned_events || []) {
      entries.push({
        id: ev.id, label: co.name, companyId: co.id,
        eventDate: ev.event_date, description: ev.title || ev.description, stage: co.stage,
        done: ev.done, type: 'company',
      });
    }
    for (const ct of co.contacts) {
      for (const ev of ct.planned_events || []) {
        entries.push({
          id: ev.id, label: ct.name || 'Contact', sublabel: co.name, companyId: co.id,
          eventDate: ev.event_date, description: ev.title || ev.description, stage: co.stage,
          done: ev.done, type: 'contact',
        });
      }
    }

    if (filter === 'history') {
      for (const a of co.activities || []) {
        entries.push({
          id: `act-${a.id}`, label: co.name, companyId: co.id,
          eventDate: a.date, description: a.text, stage: co.stage,
          done: true, type: 'company',
        });
      }
      for (const ct of co.contacts) {
        for (const a of ct.activities || []) {
          entries.push({
            id: `act-${a.id}`, label: ct.name || 'Contact', sublabel: co.name, companyId: co.id,
            eventDate: a.date, description: a.text, stage: co.stage,
            done: true, type: 'contact',
          });
        }
      }
    }
  }

  // Apply filter:
  //  - pending: not done (overdue + today + future)
  //  - history: completed OR overdue (overdue appears in both views)
  const filtered = filter === 'history'
    ? entries.filter(e => e.done || e.eventDate < todayStr)
    : entries.filter(e => !e.done);

  filtered.sort((a, b) =>
    filter === 'history' ? b.eventDate.localeCompare(a.eventDate) : a.eventDate.localeCompare(b.eventDate)
  );
  // Replace the entries variable below with filtered
  entries.length = 0;
  entries.push(...filtered);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <h3>{title}</h3>
        <p style={{ maxWidth: 360 }}>
          {filter === 'history'
            ? 'No completed or overdue events yet.'
            : 'No events planned. Add planned events to your companies or contacts to see them here.'}
        </p>
      </div>
    );
  }

  // Group by date
  const dateGroups: Record<string, TimelineEntry[]> = {};
  for (const e of entries) {
    if (!dateGroups[e.eventDate]) dateGroups[e.eventDate] = [];
    dateGroups[e.eventDate].push(e);
  }
  const sortedDates = Object.keys(dateGroups).sort((a, b) => filter === 'history' ? b.localeCompare(a) : a.localeCompare(b));

  const fmtDateShort = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    const day = dt.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[dt.getMonth()]}`;
  };

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    const day = dt.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${weekdays[dt.getDay()]}, ${day} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const daysDiff = (d: string) => {
    const diff = Math.round((new Date(d).getTime() - new Date(todayStr).getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 0) return `In ${diff}d`;
    return `${Math.abs(diff)}d ago`;
  };

  // Determine the dominant status for each date (for coloring the horizontal timeline)
  const dateStatus = (date: string): string => {
    const group = dateGroups[date];
    if (group.every(e => getStatus(e, todayStr) === 'completed')) return 'completed';
    if (date === todayStr) return 'today';
    if (date < todayStr && group.some(e => getStatus(e, todayStr) === 'overdue')) return 'overdue';
    if (date > todayStr) return 'future';
    return 'future';
  };

  return (
    <div style={{ padding: '24px 20px' }}>
      <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        {title}
      </h2>

      {/* ─── Horizontal timeline bar ─── */}
      <div style={{ position: 'relative', marginBottom: 32, padding: '0 8px' }}>
        {/* The horizontal line */}
        <div style={{
          position: 'absolute', top: 14, left: 0, right: 0, height: 3,
          background: 'linear-gradient(to right, var(--pbf-border), var(--pbf-navy), var(--pbf-border))',
          borderRadius: 2,
        }} />

        {/* Arrow at right end */}
        <div style={{
          position: 'absolute', top: 9, right: -6,
          width: 0, height: 0,
          borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
          borderLeft: '9px solid var(--pbf-border)',
        }} />

        {/* Date markers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', minHeight: 50, overflowX: 'auto' }}>
          {sortedDates.map((date, idx) => {
            const status = dateStatus(date);
            const isToday = date === todayStr;
            const count = dateGroups[date].length;

            // Insert today marker if today is between dates
            const prevDate = idx > 0 ? sortedDates[idx - 1] : null;
            const showTodayGap = !sortedDates.includes(todayStr) && prevDate && prevDate < todayStr && date > todayStr;

            return (
              <div key={date} style={{ display: 'flex', alignItems: 'flex-start' }}>
                {showTodayGap && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, marginRight: 4 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#d69e2e',
                      border: '3px solid var(--pbf-yellow-bg)', zIndex: 2, marginTop: 6,
                    }} />
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#d69e2e', marginTop: 4, textTransform: 'uppercase' }}>Today</div>
                  </div>
                )}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52, cursor: 'pointer',
                }}
                  onClick={() => {
                    const firstEntry = dateGroups[date][0];
                    if (firstEntry) onSelectCompany(firstEntry.companyId, firstEntry.id);
                  }}
                >
                  <div style={{
                    width: isToday ? 16 : 12, height: isToday ? 16 : 12, borderRadius: '50%',
                    background: statusDot(status),
                    border: isToday ? '3px solid var(--pbf-yellow-bg)' : '2px solid white',
                    zIndex: 2, marginTop: isToday ? 6 : 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                  <div style={{
                    fontSize: 10, fontWeight: 700, marginTop: 4,
                    color: statusColor(status),
                    whiteSpace: 'nowrap',
                  }}>
                    {fmtDateShort(date)}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--pbf-muted)' }}>{daysDiff(date)}</div>
                  {count > 1 && (
                    <div style={{
                      fontSize: 9, fontWeight: 600, color: 'white', background: statusDot(status),
                      borderRadius: 8, padding: '0 5px', marginTop: 1,
                    }}>{count}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Legend ─── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--pbf-text)', label: 'Future' },
          { color: '#d69e2e', label: 'Today' },
          { color: 'var(--stage-won)', label: 'Completed' },
          { color: 'var(--pbf-red)', label: 'Overdue' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: item.color }} />
            <span style={{ color: 'var(--pbf-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ─── Event list below ─── */}
      {sortedDates.map(date => {
        const group = dateGroups[date];
        const isToday = date === todayStr;

        return (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, padding: '6px 0', borderBottom: '1px solid var(--pbf-border)',
              color: isToday ? '#d69e2e' : (date < todayStr ? 'var(--pbf-muted)' : 'var(--pbf-text)'),
            }}>
              {fmtDate(date)}
              <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11, color: 'var(--pbf-muted)' }}>
                {daysDiff(date)}
              </span>
            </div>
            {group.map(entry => {
              const status = getStatus(entry, todayStr);
              return (
                <div key={entry.id}
                  onClick={() => onSelectCompany(entry.companyId, entry.id)}
                  style={{
                    padding: '8px 14px', marginTop: 4,
                    background: statusBg(status), borderRadius: 'var(--radius)',
                    border: `1px solid ${status === 'overdue' ? 'var(--pbf-red)' : status === 'today' ? '#ecc94b' : status === 'completed' ? 'var(--stage-won)' : 'var(--pbf-border)'}`,
                    cursor: 'pointer', transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: statusDot(status), flexShrink: 0,
                    }} />
                    {entry.type === 'contact' && (
                      <span style={{ color: 'var(--pbf-blue)', fontSize: 10, fontWeight: 600 }}>&#9679;</span>
                    )}
                    <span style={{ fontWeight: 600, fontSize: 13, color: statusColor(status) }}>
                      {entry.label}
                    </span>
                    {entry.sublabel && (
                      <span style={{ fontSize: 11, color: 'var(--pbf-muted)' }}>@ {entry.sublabel}</span>
                    )}
                    <StageBadge stage={entry.stage} />
                    {entry.done && (
                      <span style={{ fontSize: 10, color: 'var(--stage-won)', fontWeight: 600 }}>&#10003; done</span>
                    )}
                  </div>
                  {entry.description && (
                    <div style={{ fontSize: 12, color: 'var(--pbf-muted)', marginLeft: 16 }}>
                      {entry.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
