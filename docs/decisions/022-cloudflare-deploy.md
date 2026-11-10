# 022 — Deploying icontween.com on Cloudflare

Date: 2026-11-10

## Context

M5 is done when icontween.com is live (brief §14). Decision 001 picked Cloudflare (static
output from `apps/web/dist`, build command `pnpm build`), and `_headers` has set a strict CSP
since M0. Hosting itself was put off at M0 (owner decision), so nothing in the repo deployed
anything. There was no Cloudflare project, Wrangler config, SPA fallback or social preview.

## Decision

- **An assets-only Worker,** set up in `wrangler.jsonc` at the repo root. It has no `main`
  script, so nothing runs on a server (rule 5). Cloudflare now recommends Workers for new
  static sites over Pages, and the config file keeps the setup in the repo instead of in
  dashboard fields. Workers Builds runs `pnpm build`, then `npx wrangler deploy`. Wrangler
  is not a dependency: `npx` fetches it in Cloudflare's build only.
- **SPA fallback:** `"not_found_handling": "single-page-application"`. `/editor`, `/prepare`,
  `/runtime`, trailing slashes and unknown paths get `index.html` with 200, and `main.tsx`
  picks the page as before. Real files (`/assets/…`, `/favicon.svg`, `/og-image.png`) are
  served as they are.
- **The custom domain is added in the dashboard,** not with `routes` in the config, so a
  deploy never creates or changes DNS records.
- **`_headers` stays the one place for headers.** Workers static assets read it like Pages
  did. It gains `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, since
  Vite puts a content hash in those file names.
- **The export preview gets its own page.** Testing the build with the real headers showed
  that the HTML + runtime preview in Export code didn't play. A `srcdoc` frame inherits
  the editor's CSP, which blocks the export's inline scripts. It worked in `pnpm dev` only
  because Vite sends no CSP. Now the frame loads `/export-preview.html` with
  `sandbox="allow-scripts"`, and the editor posts the exported file to it. The page writes
  the file over itself, so what plays is the file byte for byte (rule 9). `_headers` drops
  the site CSP for that page (`! Content-Security-Policy`, a separate block as in
  Cloudflare's docs). The page sets its own policy in a `<meta>` tag: inline scripts and
  styles only, `default-src 'none'`, so it can't load anything. Before it writes anything,
  it checks that it is sandboxed (opaque origin), that the message came from its parent and
  that the sender is our own origin. `X-Frame-Options: SAMEORIGIN` stops other sites
  framing it at all. The app keeps its strict CSP. The SVG preview has no scripts and still
  uses `srcdoc`.
- **Social preview:** `og:` and `twitter:` tags in `index.html` with a 1200 × 630
  `og-image.png` (the wordmark, the tagline, six starters). Built by
  `swift docs/media/og-image.swift` from `docs/media/og-image.svg`. That's a macOS-only
  script with no dependencies, run once by hand. The text is drawn by the script because
  macOS's SVG renderer ignores font weights. The title is now "IconTween: motion for the
  moments that matter", and the description is the landing page's lede. The same tags serve
  every path, since there's one `index.html`.

## Alternatives

- **Cloudflare Pages:** serves a SPA fallback when there's no top-level `404.html`, with no
  config at all. That's fine too, but the behaviour is implicit, and Cloudflare is moving new
  static sites to Workers. If the owner prefers Pages, `wrangler.jsonc` can be deleted and
  the same build command and output directory used.
- **Relax the CSP to allow inline scripts** so `srcdoc` works: one line, but it removes the
  main protection against script in an imported SVG (rule 6) across the whole app.
- **Per-script CSP hashes:** the data script differs for every icon, so a static header
  can't list them.
- **A separate origin for the preview** (another domain): the strongest isolation, but a
  second site to run for one frame.

## Open

- `_headers` behaviour on Cloudflare (the detach rule, and headers on the
  `/export-preview.html` → `/export-preview` redirect) was tested only with a local server
  that mimics it. Check it on the live site.
- Node and pnpm versions in Workers Builds: the docs read didn't say whether `.nvmrc` and
  `packageManager` are honoured. Check the first build log, and set `NODE_VERSION` /
  `PNPM_VERSION` build variables if needed.
