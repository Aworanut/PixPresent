// Single source of truth for WHICH photo visibilities each face-search path may
// read. This invariant is the whole security boundary of ADR 0002, so it lives
// in one tested place instead of being implied by two separate query call sites.
// See docs/adr/0002-liveness-restricted-distribution.md.
//
// - "ordinary" (file-upload selfie search): a matched photo may only be
//   `match_only`. `hidden` — the restricted subset (blacklisted people, VIP
//   handover shots) — must NEVER be served on this path.
// - "liveness" (verified live face scan): may additionally read `hidden`,
//   because a *verified* recipient is allowed to reach their own restricted
//   handover shot. Liveness binds the search to a live face, so only the real
//   person can surface it.
//
// `public` photos are fetched by both paths in a separate query and are not
// governed by this matched-visibility filter.

export type SearchMode = "ordinary" | "liveness";

export type MatchedVisibility = "match_only" | "hidden";

export function matchedVisibilities(mode: SearchMode): MatchedVisibility[] {
  return mode === "liveness" ? ["match_only", "hidden"] : ["match_only"];
}
