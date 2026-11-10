/**
 * "Export code": the open animation as HTML + runtime, a React component, SVG + SMIL or
 * JSON, ready to copy or download (decisions 016, 017). The code comes from core's
 * exporters; the runtime is the same build the preview runs (rule 9), loaded only when the
 * dialog opens. The SVG export plays without it, so its preview shows the file itself.
 */
import {
  exportHtml,
  exportJson,
  exportReact,
  exportSvg,
  formatBytes,
  measureExport,
  reducedMotionSummary,
  SVG_TRIGGER_SUPPORT,
  svgTriggerSummary,
  triggerSummary,
  type Animation,
  type ExportFile,
  type ExportSize,
  type MotionTokens,
} from '@icontween/core';
import { useEffect, useRef, useState } from 'react';
import { useEditor } from './store';

type Format = 'html' | 'react' | 'svg' | 'json';

const FORMATS: { id: Format; label: string }[] = [
  { id: 'html', label: 'HTML + runtime' },
  { id: 'react', label: 'React' },
  { id: 'svg', label: 'SVG (no JS)' },
  { id: 'json', label: 'JSON' },
];

const ABOUT: Record<Format, string> = {
  html:
    'A web page with the icon as inline SVG and the runtime built in. It works when opened ' +
    'straight from disk. To use it in a site, copy the <svg> and the two scripts.',
  react:
    'A typed component. Put it next to icontween.js and icontween.d.ts (the runtime, one ' +
    'copy for all your icons) and import it like any component.',
  svg:
    'One .svg file that animates with SMIL, no JavaScript. Paste the <svg> into a page, or ' +
    'use the file as an <img> or CSS background. Loop and appear play everywhere; the other ' +
    'triggers need the SVG inline.',
  json: 'The animation data, for playing it with the runtime yourself: createPlayer(svg, data.animation).',
};

type Runtime = typeof import('virtual:icontween-runtime');

export function ExportButton({ animation }: { animation: Animation }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  const close = () => {
    dialog.current?.close();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="button title-button"
        onClick={() => setOpen(true)}
        title="Export this animation as code"
      >
        Export code
      </button>
      <dialog
        ref={dialog}
        className="app-dialog export-dialog"
        aria-labelledby="export-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {open && <ExportPanel animation={animation} onClose={close} />}
      </dialog>
    </>
  );
}

function ExportPanel({ animation, onClose }: { animation: Animation; onClose: () => void }) {
  const tokens = useEditor((s) => s.tokens);
  const [format, setFormat] = useState<Format>('html');
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [size, setSize] = useState<ExportSize | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [replays, setReplays] = useState(0);
  const code = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let live = true;
    void import('virtual:icontween-runtime').then((r) => live && setRuntime(r));
    return () => {
      live = false;
    };
  }, []);

  const file = runtime ? makeFile(format, animation, tokens, runtime) : null;
  const text = file?.text ?? null;

  useEffect(() => {
    if (text === null) return;
    let live = true;
    void measureExport(text).then((s) => live && setSize(s));
    return () => {
      live = false;
    };
  }, [text]);

  const choose = (f: Format) => {
    setFormat(f);
    setSize(null);
    setStatus(null);
  };

  const copy = async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.text);
      setStatus('Copied');
    } catch {
      // Some embedded browsers block the clipboard; select the code for ⌘C instead.
      const range = document.createRange();
      if (code.current) range.selectNodeContents(code.current);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      setStatus(`Press ${isMac ? '⌘' : 'Ctrl+'}C to copy`);
    }
  };

  const downloadRuntime = () => {
    if (!runtime) return;
    download({ fileName: 'icontween.js', type: 'text/javascript', text: runtime.runtimeEsm });
    download({ fileName: 'icontween.d.ts', type: 'text/plain', text: runtime.runtimeTypes });
  };

  const empty = animation.sequence.steps.length === 0;

  return (
    <form
      method="dialog"
      onSubmit={(e) => {
        e.preventDefault();
        void copy();
      }}
    >
      <h2 id="export-dialog-title">Export {animation.name}</h2>
      <div className="segmented export-formats" role="group" aria-label="Format">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={format === f.id}
            onClick={() => choose(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p>{ABOUT[format]}</p>
      <ul className="export-facts">
        <li>
          {format === 'svg' ? svgTriggerSummary(animation) : triggerSummary(animation)}
          {format === 'json' || format === 'svg' ? '' : ' Every trigger works in this format.'}
        </li>
        <li>{reducedMotionSummary(animation)}</li>
        {empty && (
          <li>There’s no motion yet: add a state and a step, or this exports a still icon.</li>
        )}
      </ul>

      {format === 'svg' && <SvgTriggerTable current={animation.trigger.type} />}

      {format === 'svg' && file && (
        <iframe
          key={replays}
          className="export-try"
          title="The exported SVG, inline and as an image"
          sandbox=""
          srcDoc={svgPreviewPage(exportSvg(animation, tokens, { size: 48 }).text)}
        />
      )}

      {format === 'html' && file && <ExportedPage html={file.text} />}

      <pre ref={code} className="export-code" tabIndex={0} aria-label="Exported code">
        {text ?? 'Loading the runtime…'}
      </pre>

      <p className="export-size" aria-live="polite">
        {file && (
          <>
            {file.fileName}
            {size && ` · ${formatBytes(size.bytes)}, ${formatBytes(size.gzipped)} gzipped`}
            {format === 'react' &&
              runtime &&
              ` · plus the runtime, about ${formatBytes(runtime.runtimeMinifiedGzip)} gzipped once your bundler minifies it`}
          </>
        )}
      </p>

      <div className="app-dialog-buttons">
        <span className="share-copied" role="status">
          {status}
        </span>
        {format === 'svg' && (
          <button
            type="button"
            className="button"
            onClick={() => setReplays((n) => n + 1)}
            title="Reload the preview, to see loop and appear start again"
          >
            Replay
          </button>
        )}
        {format === 'react' && (
          <button
            type="button"
            className="button"
            disabled={!runtime}
            onClick={downloadRuntime}
            title="icontween.js and icontween.d.ts: one copy serves every exported icon"
          >
            Download runtime
          </button>
        )}
        <button
          type="button"
          className="button"
          disabled={!file}
          onClick={() => file && download(file)}
        >
          Download
        </button>
        <button type="submit" className="button is-primary" disabled={!file}>
          Copy
        </button>
        <button type="button" className="button" onClick={onClose}>
          Done
        </button>
      </div>
    </form>
  );
}

function makeFile(
  format: Format,
  animation: Animation,
  tokens: MotionTokens,
  runtime: Runtime,
): ExportFile {
  if (format === 'html') return exportHtml(animation, tokens, { runtime: runtime.runtimeIife });
  if (format === 'react') return exportReact(animation, tokens);
  if (format === 'svg') return exportSvg(animation, tokens);
  return exportJson(animation, tokens);
}

/** Where each trigger plays in the SVG export, with this icon's trigger marked. */
function SvgTriggerTable({ current }: { current: Animation['trigger']['type'] }) {
  return (
    <table className="export-triggers">
      <caption>Which triggers work</caption>
      <thead>
        <tr>
          <th scope="col">Trigger</th>
          <th scope="col">Inline &lt;svg&gt;</th>
          <th scope="col">As &lt;img&gt;</th>
          <th scope="col">Note</th>
        </tr>
      </thead>
      <tbody>
        {SVG_TRIGGER_SUPPORT.map((s) => (
          <tr key={s.trigger} aria-current={s.trigger === current ? 'true' : undefined}>
            <th scope="row">
              {s.trigger}
              {s.trigger === current && <span className="export-triggers-this"> · this icon</span>}
            </th>
            <td>{s.inline ? 'Yes' : 'No'}</td>
            <td>{s.image ? 'Yes' : 'First state'}</td>
            <td>{s.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const PREVIEW_READY = 'icontween-export-preview-ready';

/**
 * Plays the HTML + runtime file as exported. A srcdoc frame would inherit the site's CSP,
 * which blocks the file's inline scripts, so the frame loads /export-preview.html (its own
 * policy, no network) and the file is sent to it once it's ready (decision 022).
 */
function ExportedPage({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const target = frame.current?.contentWindow;
      if (!target || event.source !== target || event.data !== PREVIEW_READY) return;
      // The sandboxed frame's origin is opaque, so '*' is the only target that reaches it.
      target.postMessage(html, '*');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [html]);
  return (
    <iframe
      key={html}
      ref={frame}
      className="export-try"
      title="The exported page, running"
      sandbox="allow-scripts"
      src="/export-preview.html"
    />
  );
}

/**
 * A page showing the exported SVG twice: inline (its trigger works there) and as an <img>
 * (only loop and appear play). Shown in a sandboxed iframe without scripts: SMIL needs none.
 */
function svgPreviewPage(svg: string): string {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root { color-scheme: light dark; font: 12px/1.4 system-ui, sans-serif; }
      body { display: flex; justify-content: center; gap: 48px; margin: 0; padding: 16px; }
      figure { display: grid; justify-items: center; gap: 8px; margin: 0; }
      figcaption { color: GrayText; }
      .image { padding: 4px; border-radius: 6px; background: #fff; }
    </style>
  </head>
  <body>
    <figure>
      ${svg}
      <figcaption>Inline: try the trigger</figcaption>
    </figure>
    <figure>
      <img class="image" src="${src}" width="48" height="48" alt="" />
      <figcaption>As &lt;img&gt;: black, on white</figcaption>
    </figure>
  </body>
</html>`;
}

function download(file: ExportFile) {
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName;
  a.click();
  // Give the browser a moment to start the download before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
