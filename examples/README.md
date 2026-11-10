# Starter set

Pre-prepared, pre-animated example icons (`.icontween.json` + source SVGs).

- `source/` — unmodified SVGs from [Lucide](https://lucide.dev) v1.70.0 (`lucide-static`), ISC
  (see `THIRD_PARTY_LICENSES.md`). Several starter animations are pairs (play ↔ pause,
  lock ↔ lock-open…), so there are more sources than examples. Kept byte-for-byte as published
  (excluded from Prettier); a test checks that every one prepares cleanly.
- `starters.icontween.json` — the 12 animated starters as one project file (decision 019). The
  landing page plays it. To tune them, import it in the editor, edit, Export project, and save
  the export over this file. Written by the app, so Prettier leaves it alone.
