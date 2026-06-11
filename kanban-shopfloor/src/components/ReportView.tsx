import { useEffect, useMemo, useState } from 'react';
import { Board } from '../types';
import { Mode } from '../lib/prefs';
import { buildObsDiagram } from '../lib/diagram';
import { exportResultPdf, exportResultWord, resultHtml, svgToPngDataUrl } from '../lib/exporters';
import Coach from './Coach';
import Footer from './Footer';

type Props = {
  board: Board;
  mode: Mode;
  dismissed: Record<string, boolean>;
  onDismiss: (id: string) => void;
};

// Final step: a live preview of the report (same document that is exported),
// shown in a style-isolated iframe, with PDF / Word export.
export default function ReportView({ board, mode, dismissed, onDismiss }: Props) {
  const { svg, width, height, empty } = useMemo(() => buildObsDiagram(board), [board]);
  const [diagramImg, setDiagramImg] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (empty) { setDiagramImg(''); return; }
    svgToPngDataUrl(svg, width, height, 2)
      .then(d => { if (!cancelled) setDiagramImg(`<img src="${d}" width="640" alt="OBS diagram">`); })
      .catch(() => { if (!cancelled) setDiagramImg(''); });
    return () => { cancelled = true; };
  }, [svg, width, height, empty]);

  const html = useMemo(() => resultHtml(board, diagramImg), [board, diagramImg]);

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h2>Report</h2>
        <p className="muted">A preview of the full project report — exactly what gets printed or exported. It updates as you change the board.</p>
      </div>

      <Coach id="report" mode={mode} dismissed={dismissed} onDismiss={onDismiss}>
        This is the whole project on one page: details, the OBS diagram, stories, and the board by column.
        Use <strong>Export PDF</strong> (opens a print window — “Save as PDF”) or <strong>Export DOCX</strong> (opens in Word).
      </Coach>

      <div className="report-actions">
        <button className="btn btn-primary btn-sm" onClick={() => exportResultPdf(board, diagramImg)}>Export PDF</button>
        <button className="btn btn-secondary btn-sm" onClick={() => exportResultWord(board, diagramImg)}>Export DOCX</button>
      </div>

      <iframe className="report-frame" title="Report preview" srcDoc={html} />

      <Footer />
    </div>
  );
}
