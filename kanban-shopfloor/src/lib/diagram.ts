// Build an SVG diagram of the OBS in the style of the reference drawing:
// the home organization is drawn as a nested box (units → sub-units, with
// people icons), external organizations hang below via labelled "Contract"
// edges, and an optional customer sits above. Pure string output so it can be
// both injected into the DOM and rasterised to PNG.

import { Board, ObsNode } from '../types';
import { childrenOf, homeOrg, nodeById } from './board';

const PAD = 14;
const TITLE_H = 26;
const ICON = 16, ICON_GAP = 6, ICONS_H = 24;
const GAP = 14;          // gap between sibling boxes (nested)
const MIN_W = 116;
const EXT_W = 150, EXT_H = 60, EXT_VGAP = 48, EXT_HGAP = 26;
const MARGIN = 24;

function esc(s: string): string {
  return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// A small black "person" glyph; (cx) horizontal centre, (top) top edge.
function person(cx: number, top: number, s = ICON): string {
  const hr = s * 0.26;
  const hy = top + hr;
  return `<circle cx="${cx}" cy="${hy}" r="${hr}" fill="#1c1c1c"/>` +
    `<path d="M ${cx - s * 0.46} ${top + s} a ${s * 0.46} ${s * 0.5} 0 0 1 ${s * 0.92} 0 Z" fill="#1c1c1c"/>`;
}

function icons(cx: number, top: number, count: number): string {
  if (count <= 0) return '';
  const totalW = count * ICON + (count - 1) * ICON_GAP;
  let x = cx - totalW / 2 + ICON / 2;
  let out = '';
  for (let i = 0; i < count; i++) { out += person(x, top); x += ICON + ICON_GAP; }
  return out;
}

// ── Nested layout (home organization side) ──────────────────────────────────
type Nest = { node: ObsNode; w: number; h: number; kids: Nest[]; indCount: number };

function layNested(board: Board, node: ObsNode): Nest {
  const children = childrenOf(board, node.id);
  const units = children.filter(k => k.kind === 'unit');
  const indCount = children.filter(k => k.kind === 'individual').length;
  const kids = units.map(u => layNested(board, u));
  const kidsW = kids.reduce((s, k) => s + k.w, 0) + GAP * Math.max(0, kids.length - 1);
  const iconsW = indCount * (ICON + ICON_GAP);
  const innerW = Math.max(kidsW, iconsW, MIN_W);
  const w = innerW + PAD * 2;
  const iconsH = indCount > 0 ? ICONS_H : 0;
  const kidsH = kids.length ? Math.max(...kids.map(k => k.h)) : 0;
  const h = TITLE_H + iconsH + (kidsH ? kidsH + PAD : 8) + PAD;
  return { node, w, h, kids, indCount };
}

function renderNested(n: Nest, x: number, y: number, isRoot: boolean): string {
  const stroke = isRoot ? (n.node.color || '#1a2744') : '#9aa3b2';
  const sw = isRoot ? 3 : 1.5;
  const label = n.node.kind === 'organization'
    ? `${n.node.org_code ? n.node.org_code + ' · ' : ''}${n.node.name}`
    : n.node.name;
  let out = `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="12" fill="#ffffff" stroke="${stroke}" stroke-width="${sw}"/>`;
  out += `<text x="${x + n.w / 2}" y="${y + 17}" text-anchor="middle" font-size="13" font-weight="700" fill="#1c2636">${esc(label)}</text>`;
  const cx = x + n.w / 2;
  const contentY = y + TITLE_H;
  if (n.indCount > 0) out += icons(cx, contentY + 2, n.indCount);
  const kidsY = contentY + (n.indCount > 0 ? ICONS_H : 0);
  const kidsW = n.kids.reduce((s, k) => s + k.w, 0) + GAP * Math.max(0, n.kids.length - 1);
  let kx = cx - kidsW / 2;
  for (const k of n.kids) { out += renderNested(k, kx, kidsY, false); kx += k.w + GAP; }
  return out;
}

// ── External tree (contractors / subcontractors hang downward) ───────────────
type Ext = { org: ObsNode; w: number; h: number; subs: Ext[]; indCount: number };

function layExternal(board: Board, org: ObsNode): Ext {
  const subs = childrenOf(board, org.id).filter(k => k.kind === 'organization').map(o => layExternal(board, o));
  const indCount = childrenOf(board, org.id).filter(k => k.kind === 'individual').length;
  const subsW = subs.reduce((s, k) => s + k.w, 0) + EXT_HGAP * Math.max(0, subs.length - 1);
  const w = Math.max(EXT_W, subsW, indCount * (ICON + ICON_GAP) + PAD * 2);
  const subsH = subs.length ? Math.max(...subs.map(k => k.h)) : 0;
  const h = EXT_H + (subs.length ? EXT_VGAP + subsH : 0);
  return { org, w, h, subs, indCount };
}

function edge(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2;
  const path = `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`;
  let out = `<path d="${path}" fill="none" stroke="#6b7686" stroke-width="1.5"/>`;
  const lx = (x1 + x2) / 2, lw = 62;
  out += `<rect x="${lx - lw / 2}" y="${my - 9}" width="${lw}" height="18" rx="3" fill="#ffffff" stroke="#6b7686" stroke-width="1"/>`;
  out += `<text x="${lx}" y="${my + 4}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#3a4250">Contract</text>`;
  return out;
}

function renderExternal(e: Ext, x: number, y: number): string {
  const boxX = x + (e.w - EXT_W) / 2;
  const stroke = e.org.color || '#2f6fb0';
  let out = `<rect x="${boxX}" y="${y}" width="${EXT_W}" height="${EXT_H}" rx="12" fill="#ffffff" stroke="${stroke}" stroke-width="2.5"/>`;
  const cx = boxX + EXT_W / 2;
  const label = `${e.org.org_code ? e.org.org_code + ' · ' : ''}${e.org.name}`;
  out += `<text x="${cx}" y="${y + 18}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${stroke}">${esc(label)}</text>`;
  if (e.indCount > 0) out += icons(cx, y + 28, Math.min(e.indCount, 8));
  if (e.subs.length) {
    const subsY = y + EXT_H + EXT_VGAP;
    const subsW = e.subs.reduce((s, k) => s + k.w, 0) + EXT_HGAP * Math.max(0, e.subs.length - 1);
    let sx = x + (e.w - subsW) / 2;
    for (const sub of e.subs) {
      const subCx = sx + (sub.w) / 2;
      const subBoxTop = subsY;
      out += edge(cx, y + EXT_H, subCx, subBoxTop);
      out += renderExternal(sub, sx, subsY);
      sx += sub.w + EXT_HGAP;
    }
  }
  return out;
}

export interface DiagramResult { svg: string; width: number; height: number; empty: boolean; }

export function buildObsDiagram(board: Board): DiagramResult {
  const home = homeOrg(board);
  if (!home) return { svg: '', width: 0, height: 0, empty: true };

  const homeLay = layNested(board, home);
  const contractors = childrenOf(board, home.id).filter(k => k.kind === 'organization').map(o => layExternal(board, o));
  const customer = home.parent_id ? nodeById(board, home.parent_id) : undefined;

  const contractorsW = contractors.reduce((s, c) => s + c.w, 0) + EXT_HGAP * Math.max(0, contractors.length - 1);
  const rootW = Math.max(homeLay.w, contractorsW, customer ? EXT_W : 0);
  const centerX = MARGIN + rootW / 2;

  let body = '';
  let yCursor = MARGIN;

  if (customer) {
    const cx = centerX, cy = yCursor;
    const boxX = cx - EXT_W / 2;
    const stroke = customer.color || '#1a2744';
    body += `<rect x="${boxX}" y="${cy}" width="${EXT_W}" height="${EXT_H}" rx="12" fill="#ffffff" stroke="${stroke}" stroke-width="2.5"/>`;
    body += `<text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${stroke}">${esc(`${customer.org_code ? customer.org_code + ' · ' : ''}${customer.name}`)}</text>`;
    body += `<text x="${cx}" y="${cy + 42}" text-anchor="middle" font-size="10" fill="#6b7686">Customer</text>`;
    body += edge(cx, cy + EXT_H, cx, cy + EXT_H + EXT_VGAP);
    yCursor += EXT_H + EXT_VGAP;
  }

  const homeX = centerX - homeLay.w / 2;
  const homeY = yCursor;
  body += renderNested(homeLay, homeX, homeY, true);
  yCursor += homeLay.h;

  if (contractors.length) {
    const cy = yCursor + EXT_VGAP;
    let sx = centerX - contractorsW / 2;
    for (const c of contractors) {
      const subCx = sx + c.w / 2;
      body += edge(centerX, homeY + homeLay.h, subCx, cy);
      body += renderExternal(c, sx, cy);
      sx += c.w + EXT_HGAP;
    }
    yCursor = cy + Math.max(...contractors.map(c => c.h));
  }

  const width = rootW + MARGIN * 2;
  const height = yCursor + MARGIN;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'Source Sans 3', system-ui, sans-serif">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>` +
    body +
    `</svg>`;
  return { svg, width, height, empty: false };
}
