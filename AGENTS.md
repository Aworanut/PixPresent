# AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->
## Next.js Version Warning

This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

A **single, self-contained HTML file** — `facefind_spec.html` — that renders the *FaceFind* PRD (an event-photo-distribution SaaS with face recognition) as an interactive spec: sticky sidebar nav, collapsible sections, priority/status badges, syntax-highlighted DB schema tables, and a Next-Steps timeline. All CSS and JS are embedded; there are **no dependencies, no build system, no tests, and no git repo**. Editing the spec = editing this one file.

The content is derived from `~/Downloads/FaceFind_PRD_v1.2.docx` (a bilingual Thai/English Word doc).

## Commands

There is no build/lint/test pipeline. Working with this file means:

- **Preview:** open directly — `open facefind_spec.html` — or serve for tooling-based preview: `python3 -m http.server 4178` then visit `/facefind_spec.html`.
- **Re-extract from the source PRD** (note: `pandoc` is *not* installed here): unzip the docx and parse the XML —
  `unzip -o ~/Downloads/FaceFind_PRD_v1.2.docx -d /tmp/prd/` then read `/tmp/prd/word/document.xml` (paragraphs in `<w:p>`, tables in `<w:tbl>`, text in `<w:t>`).

## Architecture (all inside `facefind_spec.html`)

**Sections & nav.** 13 collapsible `<section class="section" id="...">` blocks in this order: `overview, users, tech, schema, features, image, mvp, nfr, commerce, payment, questions, cost, next`. The section *numbers shown in the UI* mirror the source PRD's own numbering (1–8, then 11–15 — the PRD skips 9–10). The `.nav` list is hand-maintained and must stay in sync with section ids/order; scrollspy maps each `href="#id"` to its section.

**Theme.** `data-theme="light|dark"` on `<html>`, persisted to `localStorage['ff-theme']`, set pre-paint by an inline `<head>` script to avoid FOUC. Every color is a CSS custom property defined under `:root` (light) and `[data-theme="dark"]` — change colors there, not inline.

**Behavior** lives in one IIFE at the bottom of `<body>`: collapse toggles (`.section.collapsed`, `#expandAll`/`#collapseAll`), `IntersectionObserver` scrollspy (sets `.nav a.active`), `#search` nav filter, `#progress` reading bar, `#toTop`, and the mobile off-canvas sidebar (`#menuBtn` toggles `body.nav-open`).

**Schema tables are authored as plain text and colorized by JS — do not hand-write highlight spans.** Write rows as:
```html
<td class="col">tenant_id</td><td class="type">UUID FK</td><td class="def">NULL</td><td class="desc">References tenants.id</td>
```
On load the script rewrites each cell from its `textContent`:
- `hlType` tokenizes the **type** cell: SQL types (`UUID TEXT BOOLEAN TIMESTAMPTZ DATE NUMERIC INT`) → colored spans; `PK`/`FK` → badges; trailing `[]` → array marker.
- `hlDef` colors the optional **Default** column (`NULL`/`TRUE`/`FALSE`/literals).
- `hlDesc` turns `a | b | c` into enum chips, `Phase 1`/`Phase 2` into phase chips, and `References table.col` into a code ref.

So a 3-column schema uses `col/type/desc`; a 4-column one adds `def`.

**Reusable component vocabulary** — reuse these classes rather than inventing new patterns:
- `.badge` variants: `p0 p1 ph1 ph2 ok warn muted info`
- `.schema-wrap` + `table.schema` (DB tables) · `.feature` (F-xx feature blocks) · `ol.steps` (numbered journeys/flows)
- `.timeline`/`.tnode` with phase classes `setup|dev|gate|launch` (Next Steps)
- `.q` + `.q.resolved`/`.q.pending` and the `.qstats` summary (Open Questions)
- `.card`/`.tech`/`.role`/`.plan` · `.note` (`.ok`/`.warn`) · `.paths`/`.pathrow`

## Editing conventions

- **Bilingual style:** English for structural labels, headings, and section titles; Thai for body/description text; keep technical terms (schema types, stack names, feature names) in English. Match this when adding content.
- **Open Questions counts are manual:** the `.qstats` line (`✅ N Resolved` / `🔲 N Pending`) is hardcoded — update it whenever you add or resolve a question, and set the item's `.q.resolved`/`.q.pending` class + badge accordingly.
- **"Phase 2 / paid-feature" prep pattern:** new monetized features follow the doc's Commerce-Readiness approach — add *nullable* schema columns (default `NULL`/`FALSE`), an R2 storage path, a Backlog entry (§7.2), and Open Questions; gate behind paid tiers. Provider/engine choices are wrapped in a swappable interface (e.g. `PaymentService` §12.2, `ReelRenderer` §11.4) so they can be replaced without touching business logic.
