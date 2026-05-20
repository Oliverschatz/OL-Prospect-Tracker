'use client';

/**
 * Safe rich-text editor & renderer for Kanban cards.
 *
 * Storage format: a small markdown-like subset stored as plain text.
 * Rendering ALWAYS goes through a custom parser that emits React
 * elements — `dangerouslySetInnerHTML` is never used, so pasted HTML
 * cannot inject markup.
 *
 * Supported syntax:
 *   **bold**, *italic*, _italic_, `code`
 *   # heading, ## subheading
 *   - bullet list      |   1. numbered list
 *   [label](url)        — hyperlink
 *   ![alt](url)         — embedded image (one per line)
 *   blank line          — paragraph break
 *
 * On paste, the editor strips all HTML and keeps only the plain text.
 */

import { useId, useRef, type ReactNode, type ClipboardEvent } from 'react';

// ─── Renderer ────────────────────────────────────────────────────────────

function renderInline(text: string, keyBase: string): ReactNode[] {
  // Walk the string, matching the highest-priority token at each position.
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < text.length) {
    // Image: ![alt](url)
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec(text.slice(i));
    if (img) {
      // Only allow http(s) and the signed Supabase URLs (also http(s)).
      const url = img[2];
      if (/^https?:\/\//i.test(url)) {
        out.push(
          <img
            key={`${keyBase}-${k++}`}
            src={url}
            alt={img[1]}
            style={{ maxWidth: '100%', borderRadius: 4, margin: '6px 0', display: 'block' }}
          />
        );
        i += img[0].length;
        continue;
      }
    }

    // Link: [label](url)
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
    if (link) {
      const url = link[2];
      if (/^(https?:|mailto:|tel:)/i.test(url)) {
        out.push(
          <a key={`${keyBase}-${k++}`} href={url} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>
        );
        i += link[0].length;
        continue;
      }
    }

    // Bold: **text**
    const bold = /^\*\*([^*]+)\*\*/.exec(text.slice(i));
    if (bold) {
      out.push(<strong key={`${keyBase}-${k++}`}>{bold[1]}</strong>);
      i += bold[0].length;
      continue;
    }

    // Italic: *text* or _text_
    const ital = /^(\*([^*]+)\*|_([^_]+)_)/.exec(text.slice(i));
    if (ital) {
      out.push(<em key={`${keyBase}-${k++}`}>{ital[2] || ital[3]}</em>);
      i += ital[0].length;
      continue;
    }

    // Inline code: `text`
    const code = /^`([^`]+)`/.exec(text.slice(i));
    if (code) {
      out.push(
        <code
          key={`${keyBase}-${k++}`}
          style={{ background: 'var(--pbf-light)', padding: '1px 5px', borderRadius: 3, fontSize: '0.92em' }}
        >
          {code[1]}
        </code>
      );
      i += code[0].length;
      continue;
    }

    // Plain char: consume until next special starter or end.
    const next = text.slice(i).search(/(\*|_|`|\[|!\[)/);
    const slice = next === -1 ? text.slice(i) : text.slice(i, i + Math.max(next, 1));
    out.push(slice);
    i += slice.length;
  }
  return out;
}

export function RichTextView({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const h2 = /^##\s+(.*)$/.exec(line);
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1) {
      blocks.push(<h3 key={key++} style={{ fontFamily: "'Source Serif 4', serif", fontSize: 16, margin: '8px 0 4px' }}>{renderInline(h1[1], `h-${key}`)}</h3>);
      i++; continue;
    }
    if (h2) {
      blocks.push(<h4 key={key++} style={{ fontSize: 14, fontWeight: 700, margin: '6px 0 4px' }}>{renderInline(h2[1], `h-${key}`)}</h4>);
      i++; continue;
    }

    // Unordered list
    if (/^-\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        const content = lines[i].replace(/^-\s+/, '');
        items.push(<li key={`u-${i}`}>{renderInline(content, `u-${i}`)}</li>);
        i++;
      }
      blocks.push(<ul key={key++} style={{ paddingLeft: 22, margin: '4px 0' }}>{items}</ul>);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\d+\.\s+/, '');
        items.push(<li key={`o-${i}`}>{renderInline(content, `o-${i}`)}</li>);
        i++;
      }
      blocks.push(<ol key={key++} style={{ paddingLeft: 22, margin: '4px 0' }}>{items}</ol>);
      continue;
    }

    // Blank line = paragraph separator
    if (line.trim() === '') { i++; continue; }

    // Paragraph: gather consecutive non-empty, non-special lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#|##)\s+/.test(lines[i]) &&
      !/^-\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>
        {renderInline(para.join('\n'), `p-${key}`)}
      </p>
    );
  }
  return <div className="rich-text-view">{blocks}</div>;
}

// ─── Editor ──────────────────────────────────────────────────────────────

type Tool =
  | { kind: 'wrap';   label: string; open: string; close: string; title: string }
  | { kind: 'prefix'; label: string; prefix: string; title: string }
  | { kind: 'link';   label: string; title: string }
  | { kind: 'image';  label: string; title: string };

const TOOLS: Tool[] = [
  { kind: 'wrap',   label: 'B', open: '**', close: '**', title: 'Bold' },
  { kind: 'wrap',   label: 'I', open: '*',  close: '*',  title: 'Italic' },
  { kind: 'wrap',   label: '<>', open: '`', close: '`',  title: 'Inline code' },
  { kind: 'prefix', label: 'H',  prefix: '# ', title: 'Heading' },
  { kind: 'prefix', label: '•',  prefix: '- ', title: 'Bullet list' },
  { kind: 'prefix', label: '1.', prefix: '1. ', title: 'Numbered list' },
  { kind: 'link',   label: '🔗', title: 'Insert link' },
  { kind: 'image',  label: '🖼', title: 'Insert image (paste URL)' },
];

export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  placeholder,
  rows = 8,
}: {
  value: string;
  onChange: (v: string) => void;
  onUploadImage?: (file: File) => Promise<string>; // returns public/signed URL
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileInputId = useId();

  function applyTool(tool: Tool) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);

    if (tool.kind === 'wrap') {
      const inner = sel || 'text';
      const next = `${before}${tool.open}${inner}${tool.close}${after}`;
      onChange(next);
      const caret = start + tool.open.length + inner.length + tool.close.length;
      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
      return;
    }
    if (tool.kind === 'prefix') {
      // Apply prefix to each selected line (or to the current line).
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const region = value.slice(lineStart, end || start);
      const lines = region.length ? region.split('\n') : [''];
      const prefixed = lines.map(l => (l.startsWith(tool.prefix) ? l : tool.prefix + l)).join('\n');
      const next = value.slice(0, lineStart) + prefixed + value.slice(end || start);
      onChange(next);
      requestAnimationFrame(() => ta.focus());
      return;
    }
    if (tool.kind === 'link') {
      const url = window.prompt('Hyperlink URL (https://…)');
      if (!url) return;
      const label = sel || window.prompt('Link text', 'link') || url;
      const md = `[${label}](${url})`;
      onChange(`${before}${md}${after}`);
      requestAnimationFrame(() => ta.focus());
      return;
    }
    if (tool.kind === 'image') {
      // Inserts an image by URL. For uploads, see the file input below.
      const url = window.prompt('Image URL (https://…)');
      if (!url) return;
      const alt = window.prompt('Alt text', '') || '';
      const md = `\n![${alt}](${url})\n`;
      onChange(`${before}${md}${after}`);
      requestAnimationFrame(() => ta.focus());
    }
  }

  // Strip HTML on paste — we only want plain text in storage.
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData('text/plain');
    if (text == null) return;
    e.preventDefault();
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    onChange(value.slice(0, start) + text + value.slice(end));
    const caret = start + text.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  }

  async function handleImageUpload(file: File) {
    if (!onUploadImage) return;
    const url = await onUploadImage(file);
    const md = `\n![${file.name}](${url})\n`;
    const ta = ref.current;
    const pos = ta ? ta.selectionStart : value.length;
    onChange(value.slice(0, pos) + md + value.slice(pos));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {TOOLS.map(t => (
          <button
            key={t.title}
            type="button"
            onClick={() => applyTool(t)}
            title={t.title}
            className="btn-ghost btn-sm"
            style={{ minWidth: 30, padding: '2px 6px' }}
          >
            {t.label}
          </button>
        ))}
        {onUploadImage && (
          <>
            <label
              htmlFor={fileInputId}
              className="btn-ghost btn-sm"
              style={{ cursor: 'pointer', padding: '2px 6px' }}
              title="Upload image"
            >
              📤
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onPaste={onPaste}
        placeholder={placeholder}
        rows={rows}
        style={{ width: '100%', fontFamily: "'Source Sans 3', sans-serif", fontSize: 14 }}
      />
    </div>
  );
}
