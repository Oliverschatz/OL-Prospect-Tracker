import { Board, Card, Estimate } from '../types';
import { createBoard, homeOrg } from './board';
import { addCard, addObs, addStory, addSubtask, patchCard, setAssignees, toggleConstraint, updateObs, updateSettings } from './mutations';

const A = 'system';

// A fully populated cross-corporate example (owner + units/people, two
// contractors and a subcontractor, stories, and cards across the flow).
export function buildDemo(): Board {
  let b = createBoard({ name: 'Sample: Plant Upgrade' });
  b = updateSettings(b, {
    definition_of_ready: ['Acceptance criteria agreed', 'Estimated', 'Owner/assignee identified'],
    definition_of_done: ['Work reviewed', 'Accepted by the customer', 'Documentation updated'],
  }, A);

  const home = homeOrg(b)!;
  b = updateObs(b, home.id, { name: 'Northwind Owner', org_code: 'NWO' }, A);

  // Home internal structure: one unit with three sub-units + people.
  let r = addObs(b, { kind: 'unit', parent_id: home.id, name: 'Project Office' }, A); b = r.board; const office = r.id;
  r = addObs(b, { kind: 'unit', parent_id: office, name: 'Engineering', unit_type: 'managed_team' }, A); b = r.board; const eng = r.id;
  r = addObs(b, { kind: 'unit', parent_id: office, name: 'Procurement' }, A); b = r.board; const proc = r.id;
  r = addObs(b, { kind: 'unit', parent_id: office, name: 'Commissioning', unit_type: 'scrum_team' }, A); b = r.board; const comm = r.id;
  r = addObs(b, { kind: 'individual', parent_id: office, name: 'Dana (PM)' }, A); b = r.board; const dana = r.id;
  r = addObs(b, { kind: 'individual', parent_id: eng, name: 'Ravi' }, A); b = r.board; const ravi = r.id;
  r = addObs(b, { kind: 'individual', parent_id: eng, name: 'Mei' }, A); b = r.board;
  r = addObs(b, { kind: 'individual', parent_id: comm, name: 'Tom' }, A); b = r.board; const tom = r.id;

  // External organizations (opaque) joined by contracts.
  r = addObs(b, { kind: 'organization', parent_id: home.id, name: 'BuildCo', is_home: false }, A); b = r.board; const buildco = r.id;
  b = updateObs(b, buildco, { org_code: 'BLD', contract_label: 'C-2024-017', color: '#9b1d8f' }, A);
  r = addObs(b, { kind: 'individual', parent_id: buildco, name: 'Site lead' }, A); b = r.board;
  r = addObs(b, { kind: 'individual', parent_id: buildco, name: 'Foreman' }, A); b = r.board;

  r = addObs(b, { kind: 'organization', parent_id: home.id, name: 'MechCorp', is_home: false }, A); b = r.board; const mech = r.id;
  b = updateObs(b, mech, { org_code: 'MEC', contract_label: 'C-2024-022', color: '#0e6b7a' }, A);
  r = addObs(b, { kind: 'organization', parent_id: mech, name: 'WeldPro', is_home: false }, A); b = r.board; const weld = r.id;
  b = updateObs(b, weld, { org_code: 'WLD', contract_label: 'SC-9', color: '#e0a020' }, A);
  r = addObs(b, { kind: 'individual', parent_id: weld, name: 'Welder A' }, A); b = r.board;
  r = addObs(b, { kind: 'individual', parent_id: weld, name: 'Welder B' }, A); b = r.board;

  // Stories.
  let s = addStory(b, A, { title: 'Reduce downtime during upgrade', role: 'plant manager', goal: 'minimal production downtime', benefit: 'we keep delivering to customers' }); b = s.board; const story1 = s.id;
  s = addStory(b, A, { title: 'Meet new safety regulation', role: 'safety officer', goal: 'the line to pass the 2026 audit', benefit: 'we stay compliant' }); b = s.board; const story2 = s.id;

  const tshirt = (size: Estimate['size']): Estimate => ({ size });
  function card(opts: { title: string; column: string; story_id?: string; assignees?: string[]; size?: Estimate['size']; milestone?: string; deadline?: string; constraint?: string }): string {
    b = addCard(b, { title: opts.title, column: opts.column }, A);
    const id = b.cards[b.cards.length - 1].id;
    const patch: Partial<Card> = {};
    if (opts.story_id) patch.story_id = opts.story_id;
    if (opts.size) patch.estimate = tshirt(opts.size);
    if (opts.milestone) patch.milestone = opts.milestone;
    if (opts.deadline) patch.deadline = opts.deadline;
    b = patchCard(b, id, patch, A);
    if (opts.assignees) b = setAssignees(b, id, opts.assignees, A);
    if (opts.constraint) b = toggleConstraint(b, id, opts.constraint, A);
    return id;
  }

  card({ title: 'Survey existing line', column: 'done', assignees: [eng], size: 'M', story_id: story1 });
  card({ title: 'Procure long-lead valves', column: 'wip', assignees: [proc], size: 'L', deadline: '2026-08-01', story_id: story1 });
  const install = card({ title: 'Install new conveyor', column: 'wip', assignees: [buildco], size: 'XL', story_id: story1 });
  b = addSubtask(b, install, 'Pour foundation', A);
  b = addSubtask(b, install, 'Anchor frame', A);
  card({ title: 'Weld pressure manifold', column: 'todo', assignees: [weld], size: 'L', constraint: 'safety_critical', story_id: story2 });
  card({ title: 'Commission control software', column: 'todo', assignees: [comm, tom], size: 'M', constraint: 'no_ai', story_id: story2 });
  card({ title: 'Safety sign-off', column: 'review', assignees: [dana], size: 'S', deadline: '2026-09-15', constraint: 'safety_critical', story_id: story2 });
  card({ title: 'Punch-list fixes', column: 'todo', assignees: [ravi, mech], size: 'S' });

  return b;
}
