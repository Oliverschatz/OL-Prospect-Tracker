import { useMemo, useState } from 'react';
import { Board } from '../types';
import { Mode } from '../lib/prefs';
import { buildObsDiagram } from '../lib/diagram';
import { exportDiagramPng, exportResultPdf, exportResultWord, svgToPngDataUrl } from '../lib/exporters';
import Coach from './Coach';

type Props = {
  board: Board;
  mode: Mode;
  dismissed: Record<string, boolean>;
  onDismiss: (id: string) => void;
};

export default function ObsDiagram({ board, mode, dismissed, onDismiss }: Props) {
  const { svg, width, height, empty } = useMemo(() => buildObsDiagram(board), [board]);
  const [busy, setBusy] = useState('');
  const safe = (board.name || 'kanban-shopfloor').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  async function diagramImgTag(): Promise<string> {
    if (empty) return '';
    const dataUrl = await svgToPngDataUrl(svg, width, height, 2);
    return `<img src="${dataUrl}" width="640" alt="OBS diagram">`;
  }

  async function onPng() { setBusy('png'); try { await exportDiagramPng(svg, width, height, `${safe}-obs.png`); } finally { setBusy(''); } }
  async function onPdf() { setBusy('pdf'); try { exportResultPdf(board, await diagramImgTag()); } finally { setBusy(''); } }
  async function onWord() { setBusy('word'); try { exportResultWord(board, await diagramImgTag()); } finally { setBusy(''); } }

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h2>OBS diagram</h2>
        <p className="muted">A picture of who does the work: your organization in full detail, the others as opaque boxes linked by contracts. Export the picture, or the whole project as a report.</p>
      </div>

      <Coach id="diagram" mode={mode} dismissed={dismissed} onDismiss={onDismiss}>
        This view is generated from the <strong>Organization</strong> step. Edit the structure there and it redraws here.
        Use <strong>Download PNG</strong> for the picture, or <strong>Export PDF / Word</strong> for the full project report (diagram included).
      </Coach>

      <div className="diagram-actions">
        <button className="btn btn-primary btn-sm" disabled={empty || !!busy} onClick={onPng}>{busy === 'png' ? '…' : 'Download PNG'}</button>
        <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={onPdf}>{busy === 'pdf' ? '…' : 'Export PDF'}</button>
        <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={onWord}>{busy === 'word' ? '…' : 'Export Word'}</button>
      </div>

      <div className="panel diagram-panel">
        {empty
          ? <p className="muted">Add your organization in the Organization step to see the diagram.</p>
          : <div className="diagram-scroll" dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
    </div>
  );
}
