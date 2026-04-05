'use client';

import { StageBadge } from '@/components/ui';
import type { Company } from '@/lib/types';

interface TimelineEntry {
  id: string;
  companyName: string;
  companyId: string;
  followUpDate: string;
  nextAction: string;
  stage: Company['stage'];
  completed: boolean;
  displayDate: string; // The date shown on the arrow (completed early → today)
}

function getStatus(entry: TimelineEntry, todayStr: string): 'future' | 'today' | 'overdue' | 'completed' {
  if (entry.completed && entry.followUpDate > todayStr) return 'completed'; // completed early
  if (entry.completed) return 'completed';
  if (entry.displayDate < todayStr) return 'overdue';
  if (entry.displayDate === todayStr) return 'today';
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

function isCompleted(company: Company, todayStr: string): boolean {
  // A follow-up is "completed" if:
  // 1. Stage is 'won' or 'lost' (terminal)
  // 2. An activity was logged on or after the follow-up date
  if (company.stage === 'won' || company.stage === 'lost') return true;
  if (!company.follow_up_date) return false;

  const allActivities = [
    ...company.activities,
    ...company.contacts.flatMap(ct => ct.activities || []),
  ];
  return allActivities.some(a => a.date >= company.follow_up_date);
}

export default function TimelineDiagram({ companies, onSelectCompany }: {
  companies: Company[];
  onSelectCompany: (id: string) => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Build entries from companies with follow-up dates
  const entries: TimelineEntry[] = companies
    .filter(c => c.follow_up_date)
    .map(c => {
      const completed = isCompleted(c, todayStr);
      // Completed early: display at today instead of future date
      const displayDate = (completed && c.follow_up_date > todayStr) ? todayStr : c.follow_up_date;
      return {
        id: c.id,
        companyName: c.name,
        companyId: c.id,
        followUpDate: c.follow_up_date,
        nextAction: c.next_action || '',
        stage: c.stage,
        completed,
        displayDate,
      };
    })
    .sort((a, b) => a.displayDate.localeCompare(b.displayDate));

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <h3>Timeline</h3>
        <p style={{ maxWidth: 360 }}>No follow-up dates set. Add follow-up dates to your companies to see them here.</p>
      </div>
    );
  }

  // Group by displayDate
  const dateGroups: Record<string, TimelineEntry[]> = {};
  for (const e of entries) {
    if (!dateGroups[e.displayDate]) dateGroups[e.displayDate] = [];
    dateGroups[e.displayDate].push(e);
  }
  const sortedDates = Object.keys(dateGroups).sort();

  // Find today's position for the "NOW" marker
  const todayIdx = sortedDates.findIndex(d => d >= todayStr);

  // Format date for display
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
    if (diff > 0) return `In ${diff} days`;
    return `${Math.abs(diff)} days ago`;
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <h2 style={{ fontFamily: "'Source Serif 4', serif", fontSize: 20, fontWeight: 700, marginBottom: 24, paddingLeft: 60 }}>
        Follow-up Timeline
      </h2>

      <div style={{ position: 'relative', paddingLeft: 60 }}>
        {/* Vertical line (the time arrow) */}
        <div style={{
          position: 'absolute', left: 28, top: 0, bottom: 0, width: 2,
          background: 'linear-gradient(to bottom, var(--pbf-border), var(--pbf-navy), var(--pbf-border))',
        }} />

        {/* Arrow head at top */}
        <div style={{
          position: 'absolute', left: 22, top: -8,
          width: 0, height: 0,
          borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
          borderBottom: '10px solid var(--pbf-border)',
        }} />

        {sortedDates.map((date, idx) => {
          const group = dateGroups[date];
          const isToday = date === todayStr;

          // Insert "TODAY" marker if we passed it
          const showTodayBefore = idx === todayIdx && !isToday && todayIdx > 0;

          return (
            <div key={date}>
              {/* TODAY marker between past and future */}
              {showTodayBefore && (
                <div style={{ position: 'relative', margin: '16px 0', paddingLeft: 20 }}>
                  <div style={{
                    position: 'absolute', left: -38, top: '50%', transform: 'translateY(-50%)',
                    width: 14, height: 14, borderRadius: '50%', background: '#d69e2e',
                    border: '3px solid var(--pbf-yellow-bg)', zIndex: 2,
                  }} />
                  <div style={{
                    padding: '4px 14px', background: 'var(--pbf-yellow-bg)', borderRadius: 4,
                    fontSize: 11, fontWeight: 700, color: '#d69e2e', textTransform: 'uppercase',
                    letterSpacing: '0.08em', display: 'inline-block',
                    border: '1px solid #ecc94b',
                  }}>
                    Today &mdash; {fmtDate(todayStr)}
                  </div>
                </div>
              )}

              {/* Date group */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                {/* Date label */}
                <div style={{
                  position: 'relative', paddingLeft: 20, marginBottom: 4, marginTop: idx === 0 ? 0 : 12,
                }}>
                  {/* Dot on the line */}
                  <div style={{
                    position: 'absolute', left: -35, top: '50%', transform: 'translateY(-50%)',
                    width: isToday ? 14 : 10, height: isToday ? 14 : 10,
                    borderRadius: '50%',
                    background: isToday ? '#d69e2e' : 'var(--pbf-border)',
                    border: isToday ? '3px solid var(--pbf-yellow-bg)' : '2px solid var(--pbf-white)',
                    zIndex: 2,
                  }} />
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: isToday ? '#d69e2e' : (date < todayStr ? 'var(--pbf-muted)' : 'var(--pbf-text)'),
                  }}>
                    {fmtDate(date)}
                    <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11, color: 'var(--pbf-muted)' }}>
                      {daysDiff(date)}
                    </span>
                  </div>
                </div>

                {/* Entries for this date */}
                {group.map(entry => {
                  const status = getStatus(entry, todayStr);
                  return (
                    <div key={entry.id}
                      onClick={() => onSelectCompany(entry.companyId)}
                      style={{
                        position: 'relative', marginLeft: 20, marginBottom: 4, padding: '8px 14px',
                        background: statusBg(status), borderRadius: 'var(--radius)',
                        border: `1px solid ${status === 'overdue' ? 'var(--pbf-red)' : status === 'today' ? '#ecc94b' : status === 'completed' ? 'var(--stage-won)' : 'var(--pbf-border)'}`,
                        cursor: 'pointer', transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      {/* Status dot connector */}
                      <div style={{
                        position: 'absolute', left: -27, top: 14,
                        width: 8, height: 2, background: statusDot(status),
                      }} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        {/* Status indicator */}
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          background: statusDot(status), flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 600, fontSize: 14, color: statusColor(status) }}>
                          {entry.companyName}
                        </span>
                        <StageBadge stage={entry.stage} />
                        {entry.completed && entry.followUpDate > todayStr && (
                          <span style={{ fontSize: 10, color: 'var(--stage-won)', fontWeight: 600 }}>completed early</span>
                        )}
                      </div>
                      {entry.nextAction && (
                        <div style={{ fontSize: 12, color: 'var(--pbf-muted)', marginLeft: 16 }}>
                          {entry.nextAction}
                        </div>
                      )}
                      {entry.followUpDate !== entry.displayDate && (
                        <div style={{ fontSize: 11, color: 'var(--stage-won)', marginLeft: 16, fontStyle: 'italic' }}>
                          Originally scheduled: {entry.followUpDate}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Bottom arrow */}
        <div style={{
          position: 'absolute', left: 22, bottom: -8,
          width: 0, height: 0,
          borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
          borderTop: '10px solid var(--pbf-border)',
        }} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 32, paddingLeft: 60, flexWrap: 'wrap' }}>
        {[
          { color: 'var(--pbf-text)', bg: 'var(--pbf-light)', label: 'Future' },
          { color: '#d69e2e', bg: 'var(--pbf-yellow-bg)', label: 'Today' },
          { color: 'var(--stage-won)', bg: 'var(--pbf-green-bg)', label: 'Completed' },
          { color: 'var(--pbf-red)', bg: 'var(--pbf-red-bg)', label: 'Overdue' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: item.color }} />
            <span style={{ color: 'var(--pbf-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
