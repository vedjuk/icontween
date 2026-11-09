import { segmentsToD, type Segment } from '@icontween/core';

// The check mark is stored as canonical segments and serialized by core,
// so the placeholder already exercises the real data path.
const CHECK: Segment[] = [
  { cmd: 'M', x: 4, y: 12 },
  { cmd: 'L', x: 9, y: 17 },
  { cmd: 'L', x: 20, y: 6 },
];

export function Landing() {
  return (
    <main className="placeholder">
      <svg
        className="mark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={segmentsToD(CHECK)} pathLength={1} />
      </svg>
      <h1 className="wordmark">
        <span className="wordmark-icon">icon</span>
        <span className="wordmark-tween">tween</span>
      </h1>
      <p className="tagline">Motion for the moments that matter.</p>
      <p className="note">
        A browser-based tool for crafting purposeful animations for SVG icons. In the workshop.
      </p>
      <a className="link" href="/prepare">
        Try the prepare step
      </a>
      <a className="link link-quiet" href="https://github.com/vedjuk/icontween">
        Follow along on GitHub
      </a>
    </main>
  );
}
