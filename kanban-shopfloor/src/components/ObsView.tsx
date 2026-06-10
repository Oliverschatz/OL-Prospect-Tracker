import { useEffect } from 'react';
import { Board, Contact, ObsNode, ObsTreatment, UNIT_TYPE_LABELS, UnitType } from '../types';
import { childrenOf, homeOrg, nodePath, organizations } from '../lib/board';
import { addCustomerAbove, addObs, deleteObs, updateObs } from '../lib/mutations';

const TREATMENTS: ObsTreatment[] = ['solid', 'dashed', 'dotted', 'double', 'monogram'];
const UNIT_TYPES: UnitType[] = ['unit', 'managed_team', 'scrum_team'];

type Common = {
  board: Board;
  actor: string;
  apply: (fn: (b: Board) => Board) => void;
};

function ContactFields({ node, actor, apply }: Common & { node: ObsNode }) {
  const c: Contact = node.contact ?? {};
  const setC = (patch: Partial<Contact>) => apply(b => updateObs(b, node.id, { contact: { ...c, ...patch } }, actor));
  return (
    <div className="contact-row">
      <input placeholder="email" value={c.email ?? ''} onChange={e => setC({ email: e.target.value })} />
      <input placeholder="phone / WhatsApp" value={c.phone ?? ''} onChange={e => setC({ phone: e.target.value })} />
      <input placeholder="LinkedIn" value={c.linkedin ?? ''} onChange={e => setC({ linkedin: e.target.value })} />
    </div>
  );
}

// Recursive editor for the HOME organization (full internal detail).
function HomeNode({ board, node, actor, apply, depth }: Common & { node: ObsNode; depth: number }) {
  const isOrg = node.kind === 'organization';
  const isUnit = node.kind === 'unit';
  const isIndividual = node.kind === 'individual';
  const canContain = isOrg || isUnit;
  return (
    <div className="obs-node" id={`obs-node-${node.id}`} style={{ marginLeft: depth * 18 }}>
      <div className="obs-line">
        {isOrg && <input type="color" value={node.color ?? '#1a2744'} title="Colour" onChange={e => apply(b => updateObs(b, node.id, { color: e.target.value }, actor))} />}
        <span className={`obs-kind k-${node.kind}`}>{isOrg ? '▣' : isUnit ? '▤' : '•'}</span>
        {isOrg && <input className="obs-code" value={node.org_code ?? ''} placeholder="CODE" onChange={e => apply(b => updateObs(b, node.id, { org_code: e.target.value.toUpperCase() }, actor))} />}
        <input className="obs-name" value={node.name} onChange={e => apply(b => updateObs(b, node.id, { name: e.target.value }, actor))} />
        {isUnit && (
          <select value={node.unit_type ?? 'unit'} onChange={e => apply(b => updateObs(b, node.id, { unit_type: e.target.value as UnitType }, actor))}>
            {UNIT_TYPES.map(t => <option key={t} value={t}>{UNIT_TYPE_LABELS[t]}</option>)}
          </select>
        )}
        {isOrg && (
          <select value={node.treatment ?? 'solid'} title="Non-colour cue" onChange={e => apply(b => updateObs(b, node.id, { treatment: e.target.value as ObsTreatment }, actor))}>
            {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {canContain && <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addObs(b, { kind: 'unit', parent_id: node.id }, actor).board)}>+ business unit</button>}
        {canContain && <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addObs(b, { kind: 'individual', parent_id: node.id }, actor).board)}>+ person</button>}
        {!node.is_home && <button className="icon-btn danger" title="Delete" onClick={() => apply(b => deleteObs(b, node.id, actor))}>✕</button>}
      </div>
      <ContactFields board={board} node={node} actor={actor} apply={apply} />
      {isIndividual && (
        <textarea className="obs-info" rows={1} placeholder="Notes / organizational info…" value={node.info ?? ''} onChange={e => apply(b => updateObs(b, node.id, { info: e.target.value }, actor))} />
      )}
      {childrenOf(board, node.id).filter(n => n.kind !== 'organization').map(child => (
        <HomeNode key={child.id} board={board} node={child} actor={actor} apply={apply} depth={depth + 1} />
      ))}
    </div>
  );
}

// Opaque editor for an EXTERNAL organization: box + contract + known people.
function ExternalOrg({ board, org, actor, apply }: Common & { org: ObsNode }) {
  const people = childrenOf(board, org.id).filter(n => n.kind === 'individual');
  const parentName = org.parent_id ? nodePath(board, org.parent_id) : '';
  return (
    <div className="ext-org" id={`obs-node-${org.id}`} style={{ borderColor: org.color }}>
      <div className="obs-line">
        <input type="color" value={org.color ?? '#2f6fb0'} title="Colour" onChange={e => apply(b => updateObs(b, org.id, { color: e.target.value }, actor))} />
        <input className="obs-code" value={org.org_code ?? ''} placeholder="CODE" onChange={e => apply(b => updateObs(b, org.id, { org_code: e.target.value.toUpperCase() }, actor))} />
        <input className="obs-name" value={org.name} onChange={e => apply(b => updateObs(b, org.id, { name: e.target.value }, actor))} />
        <button className="icon-btn danger" title="Delete organization" onClick={() => apply(b => deleteObs(b, org.id, actor))}>✕</button>
      </div>
      <div className="ext-meta">
        <span className="edge-tag contract">Contract</span>
        <input className="contract-label" placeholder="Contract / PO no." value={org.contract_label ?? ''} onChange={e => apply(b => updateObs(b, org.id, { contract_label: e.target.value }, actor))} />
        {parentName && <span className="muted small">engaged by {parentName}</span>}
      </div>
      <div className="ext-meta">
        <span className="edge-tag">Industry / function</span>
        <input className="industry-input" placeholder="What this company does in the project" value={org.industry ?? ''} onChange={e => apply(b => updateObs(b, org.id, { industry: e.target.value }, actor))} />
      </div>
      <ContactFields board={board} node={org} actor={actor} apply={apply} />
      <div className="ext-people">
        <div className="muted small">Known people (structure otherwise unknown):</div>
        {people.map(p => (
          <div className="ext-person" id={`obs-node-${p.id}`} key={p.id}>
            <div className="obs-line">
              <span className="obs-kind k-individual">•</span>
              <input className="obs-name" value={p.name} onChange={e => apply(b => updateObs(b, p.id, { name: e.target.value }, actor))} />
              <button className="icon-btn danger" title="Delete" onClick={() => apply(b => deleteObs(b, p.id, actor))}>✕</button>
            </div>
            <ContactFields board={board} node={p} actor={actor} apply={apply} />
            <textarea className="obs-info" rows={1} placeholder="Notes / organizational info…" value={p.info ?? ''} onChange={e => apply(b => updateObs(b, p.id, { info: e.target.value }, actor))} />
          </div>
        ))}
        <div className="ext-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addObs(b, { kind: 'individual', parent_id: org.id }, actor).board)}>+ person</button>
          <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addObs(b, { kind: 'organization', parent_id: org.id }, actor).board)}>+ subcontractor</button>
        </div>
      </div>
    </div>
  );
}

export default function ObsView({ board, actor, apply, focusId, onFocusHandled }: Common & { focusId?: string | null; onFocusHandled?: () => void }) {
  const home = homeOrg(board);
  const external = organizations(board).filter(o => !o.is_home);
  const homeHasCustomer = home?.parent_id != null;

  // When arriving from a diagram click, scroll to and highlight the node.
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`obs-node-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('obs-focus');
      window.setTimeout(() => { (el.querySelector('input.obs-name') as HTMLInputElement | null)?.focus(); }, 300);
      window.setTimeout(() => el.classList.remove('obs-focus'), 2400);
    }
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h2>Organizational structure</h2>
        <p className="muted">You detail <strong>your own organization</strong> in full. Other organizations are opaque — a box, a contract, and the people you happen to know.</p>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Your organization {home && <span className="home-tag">home</span>}</h3>
          {home && !homeHasCustomer && (
            <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addCustomerAbove(b, home.id, actor))}>+ Customer above</button>
          )}
          {home && (
            <button className="btn btn-secondary btn-sm" onClick={() => apply(b => addObs(b, { kind: 'organization', parent_id: home.id }, actor).board)}>+ Contractor</button>
          )}
        </div>
        {home ? <HomeNode board={board} node={home} actor={actor} apply={apply} depth={0} /> : <p className="muted">No home organization.</p>}
      </section>

      {external.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h3>Other organizations ({external.length})</h3></div>
          {external.map(o => <ExternalOrg key={o.id} board={board} org={o} actor={actor} apply={apply} />)}
        </section>
      )}
    </div>
  );
}
