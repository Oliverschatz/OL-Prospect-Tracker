// Produces two embeddable artifacts from the Vite build in ./dist :
//   dist/embed/kanban-shopfloor.html       — single self-contained file (CSS+JS
//                                             inlined); drop into an <iframe src>.
//   dist/embed/kanban-shopfloor.embed.js    — a widget you call from any page:
//                                             KanbanShopfloor.mount('#el', {height})
//                                             mounts the app inside a style-isolated
//                                             iframe (via srcdoc), no other files.
//
// Run `npm run build` first, then `node scripts/build-embed.mjs` (or `npm run embed`).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const dist = join(root, 'dist');
const assets = join(dist, 'assets');
const outDir = join(dist, 'embed');

function findAsset(ext) {
  const f = readdirSync(assets).find(n => n.endsWith(ext));
  if (!f) throw new Error(`No ${ext} asset found in ${assets} — run "npm run build" first.`);
  return readFileSync(join(assets, f), 'utf8');
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = findAsset('.js');
const css = findAsset('.css');

// Inline the external <script> and <link rel=stylesheet> into the HTML.
// NOTE: pass replacement FUNCTIONS, not strings — minified JS/CSS contain `$`
// sequences (e.g. $&, $', $1) that string replacements would interpret.
const scriptTag = `<script type="module">${js.replace(/<\/script>/gi, '<\\/script>')}</script>`;
const styleTag = `<style>${css.replace(/<\/style>/gi, '<\\/style>')}</style>`;
const inlined = html
  .replace(/<script\b[^>]*\bsrc=("|')\.?\/assets\/[^"']+\1[^>]*><\/script>/, () => scriptTag)
  .replace(/<link\b[^>]*\bhref=("|')\.?\/assets\/[^"']+\1[^>]*>/, () => styleTag);

if (inlined.includes('/assets/')) {
  throw new Error('Inlining failed — an /assets/ reference remained. Check the build markup.');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'kanban-shopfloor.html'), inlined);

// Wrap the self-contained HTML in a tiny mount() widget. The app lives in an
// iframe (srcdoc) so its family-chrome CSS can never collide with the host page;
// srcdoc keeps the host origin, so localStorage persistence still works.
const embed = `/*! Kanban Shopfloor — embeddable widget (Project Business Foundation).
 * Usage:
 *   <div id="kanban"></div>
 *   <script src="kanban-shopfloor.embed.js"></script>
 *   <script>KanbanShopfloor.mount('#kanban', { height: '860px' });</script>
 */
(function () {
  var HTML = ${JSON.stringify(inlined)};
  function mount(target, opts) {
    opts = opts || {};
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('KanbanShopfloor.mount: target "' + target + '" not found');
    var iframe = document.createElement('iframe');
    iframe.title = 'Kanban Shopfloor';
    iframe.style.display = 'block';
    iframe.style.width = opts.width || '100%';
    // Fill the viewport by default so the board (which scrolls internally) is
    // the only scroll region — no second, page-level scrollbar beside it. Pass
    // e.g. { height: 'calc(100dvh - 80px)' } if the host page has its own header.
    iframe.style.height = opts.height || '100dvh';
    iframe.style.border = opts.border || '0';
    iframe.setAttribute('loading', 'lazy');
    iframe.srcdoc = HTML;
    el.appendChild(iframe);
    return iframe;
  }
  var api = { mount: mount, html: HTML, version: '1.11.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.KanbanShopfloor = api;
})();
`;
writeFileSync(join(outDir, 'kanban-shopfloor.embed.js'), embed);

const kb = n => (n / 1024).toFixed(1) + ' kB';
console.log('Wrote dist/embed/kanban-shopfloor.html      ', kb(Buffer.byteLength(inlined)));
console.log('Wrote dist/embed/kanban-shopfloor.embed.js  ', kb(Buffer.byteLength(embed)));
