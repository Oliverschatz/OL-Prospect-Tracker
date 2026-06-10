import { Board, BoardFile, FILE_VERSION, SCHEMA } from '../types';
import { normalizeBoard } from './board';
import { BoardMergeResult, mergeBoards } from './merge';

const STORAGE_KEY = 'kanban-shopfloor:board';

// ─── localStorage (the live, purely-local board) ────────────────────────────
export function loadLocal(): Board | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeBoard(JSON.parse(raw) as Board) : null;
  } catch {
    return null;
  }
}

export function saveLocal(board: Board): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function clearLocal(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ─── File envelope ───────────────────────────────────────────────────────────
function stringHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function toFile(board: Board, actor: string): BoardFile {
  return {
    schema: SCHEMA,
    file_version: FILE_VERSION,
    exported_at: new Date().toISOString(),
    exported_by: actor,
    base_hash: stringHash(JSON.stringify(board)),
    board,
  };
}

export function parseFile(text: string): BoardFile {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('Not a valid JSON file.'); }
  const file = data as Partial<BoardFile>;
  if (!file || file.schema !== SCHEMA || !file.board) {
    throw new Error('This file is not a Kanban Shopfloor board.');
  }
  if ((file.file_version ?? 0) > FILE_VERSION) {
    throw new Error('This board was made with a newer version of Kanban Shopfloor. Please update the tool.');
  }
  return file as BoardFile;
}

// ─── Browser download / upload ───────────────────────────────────────────────
export function downloadBoard(board: Board, actor: string): void {
  const blob = new Blob([JSON.stringify(toFile(board, actor), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safe = board.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'board';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Open & MERGE an imported file into the current board (never a blind replace).
// Both sides are normalised first so older (v1) files upgrade cleanly.
export function openAndMerge(current: Board, file: BoardFile): BoardMergeResult {
  const result = mergeBoards(normalizeBoard(current), normalizeBoard(file.board));
  return { ...result, board: normalizeBoard(result.board) };
}

export function summaryText(r: BoardMergeResult): string {
  const s = r.cards;
  return `Cards: ${s.added} added · ${s.updated} updated · ${s.unchanged} unchanged${s.removed ? ` · ${s.removed} removed` : ''}`;
}
