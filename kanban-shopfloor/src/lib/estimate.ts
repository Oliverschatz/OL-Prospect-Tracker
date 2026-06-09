import {
  Card, Estimate, EstimateMethod, ThreePoint, TshirtSize, TSHIRT5, TSHIRT7,
} from '../types';

// ─── 3-point (PERT) ─────────────────────────────────────────────────────────
export function pertExpected(tp: ThreePoint): number {
  return (tp.o + 4 * tp.m + tp.p) / 6;
}
export function pertStdDev(tp: ThreePoint): number {
  return (tp.p - tp.o) / 6;
}

export function tshirtScaleFor(method: EstimateMethod): readonly TshirtSize[] {
  return method === 'tshirt7' ? TSHIRT7 : TSHIRT5;
}

export function isThreePoint(method: EstimateMethod): boolean {
  return method === 'three_point';
}

// ─── Aggregation ─────────────────────────────────────────────────────────────
// T-shirt sizes are ordinal — they are COUNTED per size, never summed.
export function tshirtDistribution(
  cards: Card[], method: EstimateMethod,
): { size: TshirtSize; count: number }[] {
  const scale = tshirtScaleFor(method);
  const counts = new Map<TshirtSize, number>(scale.map(s => [s, 0]));
  for (const c of cards) {
    const size = c.estimate?.size;
    if (size && counts.has(size)) counts.set(size, counts.get(size)! + 1);
  }
  return scale.map(size => ({ size, count: counts.get(size) ?? 0 }));
}

// Story points are additive.
export function pointsTotal(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + (c.estimate?.points ?? 0), 0);
}

// 3-point rolls up as the sum of expected values per dimension.
export interface ThreePointTotals { time: number; workload: number; cost: number; }
export function threePointTotals(cards: Card[]): ThreePointTotals {
  const acc: ThreePointTotals = { time: 0, workload: 0, cost: 0 };
  for (const c of cards) {
    const e = c.estimate;
    if (!e) continue;
    if (e.time) acc.time += pertExpected(e.time);
    if (e.workload) acc.workload += pertExpected(e.workload);
    if (e.cost) acc.cost += pertExpected(e.cost);
  }
  return acc;
}

// Human-readable one-liner for a card's estimate under the active method.
export function formatEstimate(estimate: Estimate | null | undefined, method: EstimateMethod): string {
  if (!estimate) return '—';
  if (method === 'points') return estimate.points != null ? `${estimate.points} pt` : '—';
  if (method === 'three_point') {
    const parts: string[] = [];
    if (estimate.time) parts.push(`t≈${round(pertExpected(estimate.time))}`);
    if (estimate.workload) parts.push(`w≈${round(pertExpected(estimate.workload))}`);
    if (estimate.cost) parts.push(`c≈${round(pertExpected(estimate.cost))}`);
    return parts.length ? parts.join(' · ') : '—';
  }
  return estimate.size ?? '—'; // tshirt
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
