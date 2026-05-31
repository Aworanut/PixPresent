import { describe, expect, it } from "vitest";
import {
  matchedVisibilities,
  type SearchMode,
} from "@/lib/face-search-visibility";

describe("matchedVisibilities", () => {
  it("ordinary search reads only match_only — never hidden", () => {
    const v = matchedVisibilities("ordinary");
    expect(v).toEqual(["match_only"]);
    expect(v).not.toContain("hidden");
  });

  it("liveness search additionally reads hidden (the restricted subset)", () => {
    const v = matchedVisibilities("liveness");
    expect(v).toContain("match_only");
    expect(v).toContain("hidden");
  });

  // The core ADR 0002 invariant: `hidden` is reachable on the liveness path and
  // ONLY the liveness path. If this ever flips, restricted photos leak.
  it("hidden is exclusive to the liveness path", () => {
    const modes: SearchMode[] = ["ordinary", "liveness"];
    const withHidden = modes.filter((m) =>
      matchedVisibilities(m).includes("hidden"),
    );
    expect(withHidden).toEqual(["liveness"]);
  });
});
