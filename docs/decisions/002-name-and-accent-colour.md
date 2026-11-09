# 002 — Name styling and accent colour

Date: 2026-11-09

## Context

The brand needs one consistent way to write the name and an accent colour. The first
placeholder used a violet accent (#5b5bf0), which the owner found overused on the web.

## Decision

**Name**

- **IconTween** in running text: titles, README, meta tags, docs.
- **icontween** (lowercase) only in the logo, where weight and colour split the word:
  `icon` regular in the text colour, `tween` bold in the accent. This avoids the
  capital-I / lowercase-l ambiguity.
- **icontween** in code and addresses: domain, npm package, `.icontween.json`.

**Accent: vermilion**

| Token           | Light     | Dark      | Use                                    |
| --------------- | --------- | --------- | -------------------------------------- |
| `--accent`      | `#d9432a` | `#ff6b4e` | Wordmark, icons, large text, focus     |
| `--accent-text` | `#c23a22` | `#ff6b4e` | Small text and links (WCAG AA ≥ 4.5:1) |

Contrast on the page background: `#d9432a` 4.24:1 (fine for large text and graphics, just under
AA for body text, hence `--accent-text` at 5.17:1); dark `#ff6b4e` 6.70:1.

## Alternatives

Deep teal, ochre, forest, signal cyan and ink-only were compared on light and dark backgrounds.
Vermilion was chosen as warm, confident and uncommon for tool sites. Teal was the runner-up.
