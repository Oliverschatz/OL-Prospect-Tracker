// Dependency-free exporters, modelled on Risk Foundry:
//  • PNG  — rasterise an SVG string via canvas
//  • PDF  — open a print-ready window (browser "Save as PDF"), @page styled
//  • Word — HTML wrapped with Word MIME (opens & saves as .docx in Word)

import { Board } from '../types';
import {
  assigneeLabel, cardsInColumn, liveStories, nodePath, organizations, projectManagersOf, storyById, subtasksOf,
} from './board';
import { formatEstimate } from './estimate';
import { cardWarnings } from './dates';

function esc(s: string): string {
  return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Rasterise an SVG string to a PNG (returns a data URL). scale > 1 = sharper.
export function svgToPngDataUrl(svg: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no canvas context')); return; }
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg render failed')); };
    img.src = url;
  });
}

export async function exportDiagramPng(svg: string, width: number, height: number, filename: string): Promise<void> {
  const dataUrl = await svgToPngDataUrl(svg, width, height, 2);
  const res = await fetch(dataUrl);
  downloadBlob(await res.blob(), filename);
}

// ── Document export ──────────────────────────────────────────────────────────
const DOC_CSS = `
  *{box-sizing:border-box} body{font-family:'Source Sans 3',Segoe UI,sans-serif;color:#1c2636;margin:0;padding:32px;font-size:13px;line-height:1.5}
  h1{font-family:'Source Serif 4',Georgia,serif;font-size:24px;margin:0 0 4px}
  h2{font-family:'Source Serif 4',Georgia,serif;font-size:17px;margin:22px 0 6px;border-bottom:2px solid #e07b2c;padding-bottom:3px}
  h3{font-size:14px;margin:14px 0 4px}
  .eyebrow{color:#e07b2c;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
  table{border-collapse:collapse;width:100%;margin:6px 0 12px}
  th,td{border:1px solid #d7dce5;padding:5px 8px;text-align:left;vertical-align:top;font-size:12px}
  th{background:#f4f6f9}
  .meta{display:flex;gap:24px;flex-wrap:wrap;background:#f4f6f9;border:1px solid #e1e6ee;border-radius:6px;padding:10px 14px;margin:8px 0 4px}
  .muted{color:#6b7686}
  .diagram{margin:10px 0}.diagram img{max-width:100%;height:auto;border:1px solid #e1e6ee;border-radius:6px}
  .project-img img{max-width:60%;height:auto;border:1px solid #e1e6ee;border-radius:6px;margin:8px 0}
  ul{margin:4px 0 10px 18px}
  .tag{display:inline-block;border:1px solid #c0392b;color:#c0392b;border-radius:10px;padding:0 7px;font-size:10px;font-weight:700;margin-right:4px}
  .foot{margin-top:28px;border-top:1px solid #e1e6ee;padding-top:10px;color:#6b7686;font-size:11px;text-align:center}
  @page{size:A4;margin:16mm}
  @media print{.no-print{display:none}}
`;

function docShell(title: string, bodyHtml: string, autoPrint: boolean): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${DOC_CSS}</style></head>
<body>${autoPrint ? '<div class="no-print" style="text-align:center;margin-bottom:14px"><button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer">Print / Save as PDF</button></div>' : ''}
${bodyHtml}
<div class="foot">Kanban Shopfloor — a free tool from the Project Business Foundation · project-business.org</div>
${autoPrint ? '<script>window.addEventListener("load",function(){setTimeout(function(){try{window.print()}catch(e){}},350)})<\/script>' : ''}
</body></html>`;
}

// Build the inner HTML body summarising the whole project.
export function buildResultBody(board: Board, diagramImg: string): string {
  const fmtDate = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString() : '—');
  const cols = board.settings.columns;
  const constraintLabel = (id: string) => board.settings.constraints.find(c => c.id === id)?.label ?? id;

  const meta = `<div class="meta">
    <div><strong>Project:</strong> ${esc(board.name)}</div>
    <div><strong>Dates:</strong> ${fmtDate(board.start_date)} – ${fmtDate(board.end_date)}</div>
    <div><strong>Estimation:</strong> ${esc(board.settings.estimate_method)}</div>
    <div><strong>WIP limit:</strong> ${board.settings.wip_limit ?? '∞'}</div>
  </div>${board.image ? `<div class="project-img"><img src="${board.image}" alt="Project picture"></div>` : ''}${board.description ? `<p>${esc(board.description)}</p>` : ''}`;

  const dor = board.settings.definition_of_ready, dod = board.settings.definition_of_done;
  const policies = (dor.length || dod.length) ? `
    <h2>Definitions</h2>
    ${dor.length ? `<h3>Definition of Ready</h3><ul>${dor.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${dod.length ? `<h3>Definition of Done</h3><ul>${dod.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}` : '';

  const orgs = organizations(board);
  const pmCell = (o: typeof orgs[number]) => {
    const pms = projectManagersOf(board, o);
    return pms.length ? esc(pms.map(p => p.name || '(unnamed)').join(', ')) : '<span class="muted">?</span>';
  };
  const obsRows = orgs.map(o => `<tr><td><strong>${esc(o.org_code || '')}</strong> ${esc(o.name)}${o.is_home ? ' <span class="muted">(home)</span>' : ''}</td><td>${esc(o.industry || '')}</td><td>${pmCell(o)}</td><td>${esc(nodePath(board, o.parent_id))}</td><td>${esc(o.contract_label || '')}</td></tr>`).join('');
  const obs = `<h2>Organization (OBS)</h2>
    ${diagramImg ? `<div class="diagram">${diagramImg}</div>` : ''}
    <table><thead><tr><th>Organization</th><th>Industry / function</th><th>Project manager</th><th>Engaged by</th><th>Contract / PO</th></tr></thead><tbody>${obsRows || '<tr><td colspan="5" class="muted">None</td></tr>'}</tbody></table>`;

  const stories = liveStories(board);
  const storyHtml = stories.length ? `<h2>User stories</h2><table><thead><tr><th>Story</th><th>As a / I want / so that</th><th>Cards</th></tr></thead><tbody>${stories.map(s => `<tr><td><strong>${esc(s.title)}</strong></td><td>${esc([s.role, s.goal, s.benefit].filter(Boolean).join(' / '))}</td><td>${board.cards.filter(c => !c.deleted && c.story_id === s.id).length}</td></tr>`).join('')}</tbody></table>` : '';

  const board_ = `<h2>Board</h2>` + cols.map(col => {
    const cards = cardsInColumn(board, col.id).filter(c => !c.parent_id);
    if (!cards.length) return `<h3>${esc(col.label)} <span class="muted">(0)</span></h3>`;
    return `<h3>${esc(col.label)} <span class="muted">(${cards.length})</span></h3>
      <table><thead><tr><th>#</th><th>Title</th><th>Assignees</th><th>Estimate</th><th>Milestone / Deadline</th></tr></thead><tbody>
      ${cards.map((c, i) => {
        const subs = subtasksOf(board, c.id);
        const story = storyById(board, c.story_id);
        const cons = c.constraints.map(x => `<span class="tag">${esc(constraintLabel(x.id))}</span>`).join('');
        const warn = cardWarnings(c).length ? ' ⚠' : '';
        return `<tr><td>${i + 1}</td>
          <td>${cons}${esc(c.title)}${warn}${story ? `<br><span class="muted">📘 ${esc(story.title)}</span>` : ''}${subs.length ? `<br><span class="muted">↳ ${subs.length} subtask(s)</span>` : ''}</td>
          <td>${esc(c.assignees.map(a => assigneeLabel(board, a)).join(', ')) || '<span class="muted">—</span>'}</td>
          <td>${esc(formatEstimate(c.estimate, board.settings.estimate_method))}</td>
          <td>${fmtDate(c.milestone)} / ${fmtDate(c.deadline)}</td></tr>`;
      }).join('')}
      </tbody></table>`;
  }).join('');

  return `<div class="eyebrow">Kanban Shopfloor — Project report</div><h1>${esc(board.name)}</h1>${meta}${policies}${obs}${storyHtml}${board_}`;
}

// The full report as a standalone HTML document (for the in-app preview iframe).
export function resultHtml(board: Board, diagramImg: string): string {
  return docShell(`${board.name} — Kanban Shopfloor`, buildResultBody(board, diagramImg), false);
}

export function exportResultPdf(board: Board, diagramImg: string): void {
  const win = window.open('', '_blank');
  if (!win) { alert('The export window could not be opened. Allow pop-ups for this page and try again.'); return; }
  win.document.open();
  win.document.write(docShell(`${board.name} — Kanban Shopfloor`, buildResultBody(board, diagramImg), true));
  win.document.close();
}

export function exportResultWord(board: Board, diagramImg: string): void {
  const html = docShell(`${board.name} — Kanban Shopfloor`, buildResultBody(board, diagramImg), false);
  const wordHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    html.replace(/^<!DOCTYPE[^>]*>\s*<html[^>]*>/i, '') + '</html>';
  const safe = (board.name || 'kanban-shopfloor').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadBlob(new Blob(['﻿', wordHtml], { type: 'application/msword' }), `${safe}.doc`);
}
