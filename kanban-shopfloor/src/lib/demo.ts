import { Board, Card, Estimate, ThreePoint } from '../types';
import { createBoard, homeOrg } from './board';
import {
  addCard, addCustomerAbove, addObs, addStory, addSubtask, patchBoardMeta, patchCard,
  setAssignees, setConstraintNote, toggleConstraint, updateObs, updateSettings,
} from './mutations';
import { uid } from './board';

const A = 'system';

// "Castle Falkenhorst" — a four-tier cross-corporate conversion project. The
// home org (STB) is fully detailed; everyone else is opaque (box + known people).
export function buildDemo(): Board {
  let b = createBoard({ name: 'Sample: Castle Falkenhorst Hotel' });
  b = patchBoardMeta(b, {
    description: 'Conversion of the 16th-century Falkenhorst Castle into a 48-room boutique hotel — a cross-corporate project with an owner, a general contractor, specialist contractors, and their subcontractors.',
    image: 'https://project-business.org/tools/tool_files/falkenhorst-castle.png',
    start_date: '2026-03-02',
    end_date: '2027-04-30',
  }, A);

  b = updateSettings(b, {
    estimate_method: 'three_point',
    wip_limit: 6,
    definition_of_ready: ['Acceptance criteria agreed', 'Estimated', 'Heritage clearance checked', 'Owner/assignee identified'],
    definition_of_done: ['Work reviewed on site', 'Accepted by the customer', 'As-built documentation updated'],
    constraints: [
      { id: 'safety_critical', label: 'Safety-critical' },
      { id: 'heritage', label: 'Heritage-protected (approval required)' },
      { id: 'customer_decision', label: 'Customer decision required' },
    ],
  }, A);

  // ── Home org (tier 1) ──
  const home = homeOrg(b)!;
  b = updateObs(b, home.id, { name: 'Steinbrecher Construction & Restoration Ltd.', org_code: 'STB', color: '#1a2744', industry: 'General contractor — heritage construction' }, A);

  const obs = (kind: 'organization' | 'unit' | 'individual', parent: string, name: string, extra?: Partial<Parameters<typeof updateObs>[2]>): string => {
    const r = addObs(b, { kind, parent_id: parent, name, unit_type: kind === 'unit' ? 'department' : undefined }, A);
    b = r.board;
    if (extra) b = updateObs(b, r.id, extra, A);
    return r.id;
  };

  const office = obs('unit', home.id, 'Project Office');
  const theresa = obs('individual', office, 'Theresa Vogel', { info: 'Project manager — the user of this board', is_pm: true, contact: { email: 't.vogel@steinbrecher-bau.example' } });
  obs('individual', office, 'Markus Steinbrecher', { info: 'Managing director (owner)' });
  const robert = obs('individual', office, 'Robert Kuhn', { info: 'Commercial manager — claims & change orders' });
  const siteOps = obs('unit', home.id, 'Site Operations', { unit_type: 'managed_team' });
  const aylin = obs('individual', siteOps, 'Aylin Demir', { info: 'Site manager' });
  const qadoc = obs('unit', home.id, 'Quality & Documentation');
  obs('individual', qadoc, 'Sofia Marek', { info: 'QA / heritage documentation' });

  // ── Customer above (tier 0) ──
  b = addCustomerAbove(b, home.id, A);
  const customerId = homeOrg(b)!.parent_id!;
  b = updateObs(b, customerId, { name: 'Falkenhorst Hospitality Inc.', org_code: 'FHG', color: '#7a4fb0', contract_label: 'GC-2026-001 (general contract)', industry: 'Hotel owner & operator' }, A);
  const jonas = obs('individual', customerId, 'Jonas Brandt', { info: "Owner's representative & project manager — acceptance decisions", is_pm: true });
  const priya = obs('individual', customerId, 'Priya Raman', { info: 'Interior & brand concept — sample selections' });
  const eilers = obs('individual', customerId, 'Dr. Konrad Eilers', { info: 'State heritage conservator. No contract with any contractor — approval authority only. Reachable via the owner\'s rep.' });

  // ── Contractors (tier 2) ──
  const frc = obs('organization', home.id, 'Atelier Fresco Conservation Inc.', { org_code: 'FRC', color: '#b0532f', contract_label: 'C-2026-031 (unit price)', treatment: 'dashed', industry: 'Fresco & decorative-surface conservation' });
  obs('individual', frc, 'Giulia Ferraro', { info: 'Lead conservator & PM', is_pm: true });
  obs('individual', frc, 'Tomas Hlaváček', { info: 'Stonemason' });
  const alp = obs('organization', home.id, 'AlpenTech Building Services Ltd.', { org_code: 'ALP', color: '#2f6fb0', contract_label: 'C-2026-027 (fixed price)', industry: 'MEP / building technology' });
  obs('individual', alp, 'Stefan Maier', { info: 'Lead MEP engineer & PM', is_pm: true });
  obs('individual', alp, 'Fatima El-Sayed', { info: 'Electrical foreman' });
  const hlz = obs('organization', home.id, 'Holzer Roofing & Carpentry Ltd.', { org_code: 'HLZ', color: '#2f9e6f', contract_label: 'C-2026-019 (fixed price)', industry: 'Roofing & timber framing' });
  const lorenz = obs('individual', hlz, 'Lorenz Holzer', { info: 'Master carpenter, owner & PM', is_pm: true });

  // ── Subcontractors (tier 3) ──
  const brd = obs('organization', hlz, 'Brandl Scaffolding Ltd.', { org_code: 'BRD', color: '#c98a18', contract_label: 'SC-7 (time & material)', treatment: 'dotted', industry: 'Scaffolding & access' });
  obs('individual', brd, 'Hannes Brandl', { info: 'Foreman / PM', is_pm: true });
  const fts = obs('organization', hlz, 'Falk Timber Supply Ltd.', { org_code: 'FTS', color: '#7a6f1f', contract_label: 'SC-8 (supply)', industry: 'Structural timber supply' });
  obs('individual', fts, 'Greta Falk', { info: 'Sales lead / PM', is_pm: true });
  const adl = obs('organization', hlz, 'Adler Sheet Metal Inc.', { org_code: 'ADL', color: '#9e4f6b', contract_label: 'SC-11 (unit price)', industry: 'Roof flashing & metalwork' });
  obs('individual', adl, 'Bruno Adler', { info: 'Foreman' });
  const gld = obs('organization', frc, 'Goldgrund Gilding Inc.', { org_code: 'GLD', color: '#e0a020', contract_label: 'SC-12 (unit price)', industry: 'Gold leaf & gilding' });
  obs('individual', gld, 'Beate Goldgrund', { info: 'Master gilder / PM', is_pm: true });
  const lft = obs('organization', alp, 'LiftPlan Elevator Technology Ltd.', { org_code: 'LFT', color: '#1f8a8a', contract_label: 'SC-3 (fixed price)', industry: 'Elevator installation' });
  obs('individual', lft, 'Daniel Roth', { info: 'Installation lead / PM', is_pm: true });
  obs('individual', lft, 'Sabine Vogt', { info: 'Commissioning lead / PM (job-share)', is_pm: true });

  // ── Stories ──
  let s = addStory(b, A, { title: 'Open as a 48-room boutique hotel', role: 'hotel owner', goal: 'the castle converted on schedule for the 2027 season', benefit: 'bookings can open in spring' }); b = s.board; const hotel = s.id;
  s = addStory(b, A, { title: 'Pass heritage compliance', role: "owner's representative", goal: 'every intervention on protected fabric approved and documented', benefit: 'the operating permit is not at risk' }); b = s.board; const heritage = s.id;

  // ── Cards ──
  // Map the rough sizes from the spec onto three-point (PERT) day estimates.
  const SIZE_TRI: Record<string, ThreePoint> = {
    XS: { o: 1, m: 2, p: 4 }, S: { o: 2, m: 3, p: 6 }, M: { o: 4, m: 6, p: 12 },
    L: { o: 8, m: 12, p: 20 }, XL: { o: 15, m: 25, p: 40 },
  };
  function card(o: {
    title: string; column: string; assignees?: string[]; size?: Estimate['size']; story_id?: string;
    flags?: { id: string; note?: string }[]; deadline?: string; milestone?: string;
    links?: { label: string; url: string }[]; dod?: string[];
  }): string {
    b = addCard(b, { title: o.title, column: o.column }, A);
    const id = b.cards[b.cards.length - 1].id;
    const patch: Partial<Card> = {};
    if (o.size && SIZE_TRI[o.size]) patch.estimate = { time: SIZE_TRI[o.size] };
    if (o.story_id) patch.story_id = o.story_id;
    if (o.deadline) patch.deadline = o.deadline;
    if (o.milestone) patch.milestone = o.milestone;
    if (o.links) patch.links = o.links.map(l => ({ id: uid(), ...l }));
    if (o.dod) patch.dod = o.dod;
    b = patchCard(b, id, patch, A);
    if (o.assignees) b = setAssignees(b, id, o.assignees, A);
    for (const f of o.flags ?? []) { b = toggleConstraint(b, id, f.id, A); if (f.note) b = setConstraintNote(b, id, f.id, f.note, A); }
    return id;
  }

  card({ title: 'Survey & 3D scan of existing fabric', column: 'done', assignees: [qadoc], size: 'M', story_id: hotel });
  card({ title: 'Winterization of open roof sections', column: 'done', assignees: [aylin], size: 'S' });
  card({ title: 'Renovation master schedule v3', column: 'wip', assignees: [theresa], size: 'S', story_id: hotel });

  const truss = card({ title: 'Roof truss replacement, north wing', column: 'wip', assignees: [hlz], size: 'XL', story_id: hotel, flags: [{ id: 'safety_critical' }] });
  b = addSubtask(b, truss, 'Erect scaffolding, north facade', A);
  let subId = b.cards[b.cards.length - 1].id; b = setAssignees(b, subId, [brd], A);
  b = addSubtask(b, truss, 'Replace truss segments 4–9', A);
  subId = b.cards[b.cards.length - 1].id; b = setAssignees(b, subId, [lorenz], A);

  card({ title: 'Electrical riser routing, west wing', column: 'wip', assignees: [alp], size: 'L', story_id: hotel });

  card({
    title: 'Fresco cleaning method statement, banquet hall', column: 'review', assignees: [frc, eilers], size: 'M', story_id: heritage,
    flags: [{ id: 'heritage' }], deadline: '2026-06-01',
    links: [{ label: 'Method statement v2', url: 'https://example.org/falkenhorst/ms-fresco-v2' }],
    dod: ['Conservator counter-signature on file'],
  });
  card({ title: 'Mock-up room 204 acceptance', column: 'review', assignees: [jonas], size: 'S', story_id: hotel, flags: [{ id: 'customer_decision' }], milestone: '2026-06-22' });

  card({ title: 'Elevator shaft core drilling', column: 'todo', assignees: [lft], size: 'L', story_id: heritage, flags: [{ id: 'safety_critical' }, { id: 'heritage' }] });
  card({ title: 'Gilding sample boards for ballroom', column: 'todo', assignees: [gld], size: 'S', story_id: heritage, flags: [{ id: 'customer_decision', note: "Waiting on Priya Raman's selection" }] });
  card({ title: 'Select gilding sample', column: 'todo', assignees: [priya], size: 'XS', story_id: heritage, flags: [{ id: 'customer_decision' }] });
  card({ title: 'Change order: walled-up staircase discovered, east wing', column: 'todo', assignees: [robert], size: 'M', story_id: hotel });
  card({ title: 'Bat colony relocation, attic', column: 'todo', size: 'S', story_id: heritage, flags: [{ id: 'heritage' }], deadline: '2026-09-30' });

  return b;
}
