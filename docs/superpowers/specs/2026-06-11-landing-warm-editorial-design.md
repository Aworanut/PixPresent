# Landing redesign — "Warm Editorial" (A+B fusion)

- **Date:** 2026-06-11
- **Status:** Approved (design) — implementing
- **Surface:** `app/page.tsx` (public marketing landing) only
- **Built with:** ui-ux-pro-max skill (design intelligence)

## Goal

Push the public landing to a top-tier, premium look ("แบบสุดๆ") while keeping
PixPresent's warm, friendly identity. Trigger: user request + reference demo
(skill-built pet-grooming demo) as a quality bar.

## Direction

Fusion of two skill-derived directions:
- **A · Elevated Cozy** — Storytelling-Driven style, warm linen/espresso/orange palette (current brand).
- **B · Editorial Luxe** — Bold Editorial Typography + Exaggerated Minimalism: oversized Cormorant display, dramatic whitespace, gold accents.

Keep A's **light, warm, approachable base** (do not go full-dark — would distance general event guests); borrow B's **editorial scale + gold** for drama.

## Visual language

- **Base:** linen `#FDFBF7` / espresso `#271A12` (unchanged brand).
- **New accent — editorial gold:** `#A16207` (WCAG-safe on linen) for eyebrows, hairlines, key-word accents. Add as token.
- **Type:** Cormorant Garamond at editorial scale (hero `clamp(3rem, 6vw, 6.5rem)`, tight tracking, generous whitespace); Kanit / IBM Plex Sans Thai for Thai. All already loaded via `next/font`.
- **Primary CTA:** keep orange gradient `#FB923C→#EA580C`. **Secondary:** editorial gold underline.
- **Motion (skill: Storytelling-Driven effects):** reuse `photoReveal` keyframe for photo grids; add `scroll-reveal` (IntersectionObserver, client `_reveal.tsx`) for section entrances — fade + translateY, ease-out `cubic-bezier(0.16, 1, 0.3, 1)`, 150–300ms. Gate all motion behind `prefers-reduced-motion`.

## Section plan (evolve existing structure — do not rebuild from scratch)

| Section | Change |
|---|---|
| Nav | Refine: gold hairline, tighter spacing. |
| Hero | Rebuild: oversized Cormorant headline, gold eyebrow, asymmetric layout, replace icon-card with a **photo-grid reveal** mock (communicates the product + uses reveal motion), serif stat numerals. |
| Vibe (features) | Elevate cards: gold hairline borders, more whitespace, scroll-reveal. |
| Journey (3 steps) | Oversized serif numerals, connecting line, scroll-reveal. |
| Demo teaser | Apply real reveal motion to the face-search mock. |
| Stories | Editorial quote treatment (large serif quote marks, gold). |
| Final CTA | Keep dramatic gradient panel; refine type scale. |
| Footer | Minor refine. |

## Technical approach

- `app/page.tsx` stays a server component; extract scroll-reveal into a small client `app/_reveal.tsx` (IntersectionObserver wrapper).
- `app/globals.css`: add gold token(s) + a `scroll-reveal` keyframe/utility (same pattern as the existing `photoReveal`).
- Fonts already loaded — **no new dependencies**.
- Responsive at 375 / 768 / 1024 / 1440.

## Scope / non-goals

- Landing only. Do **not** touch other routes (dashboard/guest are being edited in parallel).
- No backend, no real imagery — refined gradient/placeholder visuals.
- Keep existing copy; only sharpen headlines.

## Skill a11y / pre-delivery checklist

- [ ] No emoji-as-icon (SVG / lucide only)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover transitions 150–300ms
- [ ] Text contrast ≥ 4.5:1 (verify gold on linen, white on gradient)
- [ ] Visible focus states for keyboard nav
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375 / 768 / 1024 / 1440

## Implementation order

Hero first → preview-verify → remaining sections (checkpoint between).
