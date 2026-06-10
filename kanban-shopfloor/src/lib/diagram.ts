// Build an SVG diagram of the OBS in the style of the reference drawing:
// the home organization is drawn as a nested box (business units → sub-units,
// with named people), external organizations hang below via labelled "Contract"
// edges, and an optional customer sits above. Pure string output so it can be
// both injected into the DOM and rasterised to PNG.

import { Board, ObsNode } from '../types';
import { childrenOf, homeOrg, nodeById } from './board';

const PAD = 14;
const ICON = 16, ICON_GAP = 10;
const NAME_FS = 9.5, PEOPLE_H = ICON + 16;
const TITLE_FS = 13, TITLE_LH = 16;        // nested (home) box title
const EXT_TITLE_FS = 12, EXT_TITLE_LH = 15; // external box title
const GAP = 14;          // gap between sibling boxes (nested)
const MIN_W = 130;
const EXT_W = 168, EXT_VGAP = 48, EXT_HGAP = 26;
const MARGIN = 24;

function esc(s: string): string {
  return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// Greedy word-wrap to fit a pixel width; hard-breaks over-long single words.
function wrapText(text: string, maxW: number, fontSize: number, maxLines = 3): string[] {
  const charW = fontSize * 0.56;
  const maxChars = Math.max(6, Math.floor(maxW / charW));
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  const pushWord = (w: string) => {
    let word = w;
    while (word.length > maxChars) {
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(word.slice(0, maxChars - 1) + '­'); // soft hyphen marker
      word = word.slice(maxChars - 1);
      if (lines.length >= maxLines) return;
    }
    const tryLine = cur ? cur + ' ' + word : word;
    if (tryLine.length <= maxChars) cur = tryLine;
    else { if (cur) lines.push(cur); cur = word; }
  };
  for (const w of words) { if (lines.length >= maxLines) break; pushWord(w); }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  return lines.length ? lines.map(l => l.replace(/­/g, '-')) : [text];
}

function titleSvg(lines: string[], cx: number, firstBaseline: number, fs: number, lh: number, weight: number, fill: string): string {
  return lines.map((ln, i) => `<text x="${cx}" y="${firstBaseline + i * lh}" text-anchor="middle" font-size="${fs}" font-weight="${weight}" fill="${fill}">${esc(ln)}</text>`).join('');
}

// A small black "person" glyph centred horizontally on cx, top edge at `top`.
function person(cx: number, top: number, s = ICON): string {
  const hr = s * 0.26, hy = top + hr;
  return `<circle cx="${cx}" cy="${hy}" r="${hr}" fill="#1c1c1c"/>` +
    `<path d="M ${cx - s * 0.46} ${top + s} a ${s * 0.46} ${s * 0.5} 0 0 1 ${s * 0.92} 0 Z" fill="#1c1c1c"/>`;
}

function colW(name: string): number { return Math.min(104, Math.max(ICON + 8, name.length * 5.4 + 10)); }
function truncate(name: string, w: number): string {
  const max = Math.floor((w - 6) / 5.2);
  return name.length > max ? name.slice(0, Math.max(1, max - 1)) + '…' : name;
}
function peopleWidth(people: ObsNode[]): number {
  if (!people.length) return 0;
  return people.reduce((s, p) => s + colW(p.name || '?'), 0) + ICON_GAP * (people.length - 1);
}
function peopleRow(people: ObsNode[], cx: number, top: number): string {
  if (!people.length) return '';
  const total = peopleWidth(people);
  let x = cx - total / 2;
  let out = '';
  for (const p of people) {
    const w = colW(p.name || '?');
    const ccx = x + w / 2;
    out += `<g data-node-id="${p.id}">` + person(ccx, top) +
      `<text x="${ccx}" y="${top + ICON + 10}" text-anchor="middle" font-size="${NAME_FS}" fill="#3a4250">${esc(truncate(p.name || '(unnamed)', w))}</text></g>`;
    x += w + ICON_GAP;
  }
  return out;
}

function orgLabel(o: ObsNode): string { return `${o.org_code ? o.org_code + ' · ' : ''}${o.name}`; }

// ── Nested layout (home organization side) ──────────────────────────────────
type Nest = { node: ObsNode; w: number; h: number; titleLines: string[]; titleH: number; kids: Nest[]; people: ObsNode[] };

function layNested(board: Board, node: ObsNode): Nest {
  const children = childrenOf(board, node.id);
  const units = children.filter(k => k.kind === 'unit');
  const people = children.filter(k => k.kind === 'individual');
  const kids = units.map(u => layNested(board, u));
  const kidsW = kids.reduce((s, k) => s + k.w, 0) + GAP * Math.max(0, kids.length - 1);
  const innerW = Math.max(kidsW, peopleWidth(people), MIN_W);
  const w = innerW + PAD * 2;
  const label = node.kind === 'organization' ? orgLabel(node) : node.name;
  const titleLines = wrapText(label, w - 16, TITLE_FS);
  const titleH = titleLines.length * TITLE_LH + 8;
  const peopleH = people.length > 0 ? PEOPLE_H : 0;
  const kidsH = kids.length ? Math.max(...kids.map(k => k.h)) : 0;
  const h = titleH + peopleH + (kidsH ? kidsH + PAD : 8) + PAD;
  return { node, w, h, titleLines, titleH, kids, people };
}

function renderNested(n: Nest, x: number, y: number, isRoot: boolean): string {
  const stroke = isRoot ? (n.node.color || '#1a2744') : '#9aa3b2';
  const sw = isRoot ? 3 : 1.5;
  const cx = x + n.w / 2;
  let out = `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="12" fill="#ffffff" stroke="${stroke}" stroke-width="${sw}"/>`;
  out += titleSvg(n.titleLines, cx, y + 17, TITLE_FS, TITLE_LH, 700, '#1c2636');
  const contentY = y + n.titleH;
  if (n.people.length) out += peopleRow(n.people, cx, contentY + 2);
  const kidsY = contentY + (n.people.length ? PEOPLE_H : 0);
  const kidsW = n.kids.reduce((s, k) => s + k.w, 0) + GAP * Math.max(0, n.kids.length - 1);
  let kx = cx - kidsW / 2;
  for (const k of n.kids) { out += renderNested(k, kx, kidsY, false); kx += k.w + GAP; }
  return `<g data-node-id="${n.node.id}">${out}</g>`;
}

// ── External tree (contractors / subcontractors hang downward) ───────────────
type Ext = { org: ObsNode; w: number; h: number; eh: number; boxW: number; titleLines: string[]; hasIndustry: boolean; subs: Ext[]; people: ObsNode[] };

function layExternal(board: Board, org: ObsNode): Ext {
  const subs = childrenOf(board, org.id).filter(k => k.kind === 'organization').map(o => layExternal(board, o));
  const people = childrenOf(board, org.id).filter(k => k.kind === 'individual');
  const boxW = Math.max(EXT_W, peopleWidth(people) + PAD * 2);
  const titleLines = wrapText(orgLabel(org), boxW - 12, EXT_TITLE_FS);
  const hasIndustry = !!(org.industry && org.industry.trim());
  const eh = 8 + titleLines.length * EXT_TITLE_LH + 4 + (hasIndustry ? 14 : 0) + (people.length ? PEOPLE_H : 4) + 8;
  const subsW = subs.reduce((s, k) => s + k.w, 0) + EXT_HGAP * Math.max(0, subs.length - 1);
  const w = Math.max(boxW, subsW);
  const subsH = subs.length ? Math.max(...subs.map(k => k.h)) : 0;
  const h = eh + (subs.length ? EXT_VGAP + subsH : 0);
  return { org, w, h, eh, boxW, titleLines, hasIndustry, subs, people };
}

function edge(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2;
  let out = `<path d="M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}" fill="none" stroke="#6b7686" stroke-width="1.5"/>`;
  const lx = (x1 + x2) / 2, lw = 62;
  out += `<rect x="${lx - lw / 2}" y="${my - 9}" width="${lw}" height="18" rx="3" fill="#ffffff" stroke="#6b7686" stroke-width="1"/>`;
  out += `<text x="${lx}" y="${my + 4}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#3a4250">Contract</text>`;
  return out;
}

function renderExternal(e: Ext, x: number, y: number): string {
  const boxX = x + (e.w - e.boxW) / 2;
  const stroke = e.org.color || '#2f6fb0';
  const cx = boxX + e.boxW / 2;
  let out = `<rect x="${boxX}" y="${y}" width="${e.boxW}" height="${e.eh}" rx="12" fill="#ffffff" stroke="${stroke}" stroke-width="2.5"/>`;
  out += titleSvg(e.titleLines, cx, y + 19, EXT_TITLE_FS, EXT_TITLE_LH, 700, stroke);
  let cur = y + 8 + e.titleLines.length * EXT_TITLE_LH + 4;
  if (e.hasIndustry) { out += `<text x="${cx}" y="${cur + 9}" text-anchor="middle" font-size="9.5" font-style="italic" fill="#6b7686">${esc(truncate(e.org.industry!, e.boxW - 8))}</text>`; cur += 14; }
  if (e.people.length) out += peopleRow(e.people, cx, cur);
  if (e.subs.length) {
    const subsY = y + e.eh + EXT_VGAP;
    const subsW = e.subs.reduce((s, k) => s + k.w, 0) + EXT_HGAP * Math.max(0, e.subs.length - 1);
    let sx = x + (e.w - subsW) / 2;
    for (const sub of e.subs) {
      out += edge(cx, y + e.eh, sx + sub.w / 2, subsY);
      out += renderExternal(sub, sx, subsY);
      sx += sub.w + EXT_HGAP;
    }
  }
  return `<g data-node-id="${e.org.id}">${out}</g>`;
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
    const custLines = wrapText(orgLabel(customer), EXT_W - 12, EXT_TITLE_FS);
    const custH = 8 + custLines.length * EXT_TITLE_LH + 4 + 16 + 8;
    const boxX = centerX - EXT_W / 2, stroke = customer.color || '#1a2744';
    body += `<g data-node-id="${customer.id}">` +
      `<rect x="${boxX}" y="${yCursor}" width="${EXT_W}" height="${custH}" rx="12" fill="#ffffff" stroke="${stroke}" stroke-width="2.5"/>` +
      titleSvg(custLines, centerX, yCursor + 19, EXT_TITLE_FS, EXT_TITLE_LH, 700, stroke) +
      `<text x="${centerX}" y="${yCursor + 8 + custLines.length * EXT_TITLE_LH + 16}" text-anchor="middle" font-size="10" fill="#6b7686">Customer</text></g>`;
    body += edge(centerX, yCursor + custH, centerX, yCursor + custH + EXT_VGAP);
    yCursor += custH + EXT_VGAP;
  }

  const homeY = yCursor;
  body += renderNested(homeLay, centerX - homeLay.w / 2, homeY, true);
  yCursor += homeLay.h;

  if (contractors.length) {
    const cy = yCursor + EXT_VGAP;
    let sx = centerX - contractorsW / 2;
    for (const c of contractors) {
      body += edge(centerX, homeY + homeLay.h, sx + c.w / 2, cy);
      body += renderExternal(c, sx, cy);
      sx += c.w + EXT_HGAP;
    }
    yCursor = cy + Math.max(...contractors.map(c => c.h));
  }

  const width = rootW + MARGIN * 2;
  const height = yCursor + MARGIN;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'Source Sans 3', system-ui, sans-serif">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>` + body + `</svg>`;
  return { svg, width, height, empty: false };
}
