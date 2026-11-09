# IconTween

**Motion for the moments that matter.**

A browser-based tool for designers to craft purposeful, state-based animations for individual SVG
icons, and hand them off as clean, developer-friendly code. Everything runs in the browser; icons
never leave your machine.

> Early days: milestone M0 (foundations). See [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the plan.

## Development

Requires Node 24 and pnpm 10.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test
pnpm lint
pnpm build
```

## Repository

- `apps/web` — editor and landing page (Vite, React, TypeScript)
- `packages/core` — data model, validation, geometry, prepare pipeline
- `packages/runtime` — tiny playback library
- `packages/react` — React wrapper
- `examples/` — starter set
- `docs/` — decisions and devlog

## License

MIT. Starter icons derived from [Lucide](https://lucide.dev) (ISC), see
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
