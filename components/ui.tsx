'use client';

import { STAGES } from '@/lib/constants';
import { stageInfo, calcFitScore, fitColor } from '@/lib/helpers';
import type { StageKey, FitScores, Company } from '@/lib/types';

export function StageBadge({ stage }: { stage: StageKey }) {
  const info = stageInfo(stage);
  return <span className={`stage-badge ${info.cls}`}>{info.label}</span>;
}

export function FitScoreDisplay({ scores }: { scores: FitScores }) {
  const score = calcFitScore(scores);
  return (
    <div className="fit-score-display">
      <div className="fit-score-bar">
        <div className="fit-score-fill" style={{ width: `${score}%`, background: fitColor(score) }} />
      </div>
      <div className="fit-score-num" style={{ color: fitColor(score) }}>{score}</div>
    </div>
  );
}

export function PipelineBar({ companies }: { companies: Company[] }) {
  const total = companies.length || 1;
  const counts: Record<string, number> = {};
  STAGES.forEach(s => (counts[s.key] = 0));
  companies.forEach(c => {
    if (counts[c.stage] !== undefined) counts[c.stage]++;
  });
  return (
    <div>
      <div className="pipeline-bar">
        {STAGES.map(s => (
          <div
            key={s.key}
            className="pipeline-segment"
            style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${counts[s.key]}`}
          />
        ))}
      </div>
      <div className="stats-row">
        {STAGES.map(s => (
          <div key={s.key} className="stat-item">
            <div className="stat-num" style={{ color: s.color }}>{counts[s.key]}</div>
            <div className="stat-label">{s.short || s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
