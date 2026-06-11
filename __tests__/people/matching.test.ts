import { describe, it, expect, vi } from "vitest";

// matching.ts imports rekognition.ts (which has `import "server-only"`, throwing
// under vitest) and r2 + service-role. Mock them so the pure helpers load clean.
vi.mock("@/lib/aws/rekognition", () => ({ searchFacesByImage: vi.fn() }));
vi.mock("@/lib/r2", () => ({ downloadFromR2: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));

describe("buildFaceToSimilarityMap", () => {
  it("keeps the highest similarity when a faceId appears across multiple ref faces", async () => {
    const { buildFaceToSimilarityMap } = await import("@/lib/people/matching");
    const map = buildFaceToSimilarityMap([
      { faceId: "face-a", similarity: 85 },
      { faceId: "face-a", similarity: 93 },
      { faceId: "face-b", similarity: 88 },
    ]);
    expect(map.get("face-a")).toBe(93);
    expect(map.get("face-b")).toBe(88);
    expect(map.size).toBe(2);
  });

  it("returns an empty map for no matches", async () => {
    const { buildFaceToSimilarityMap } = await import("@/lib/people/matching");
    expect(buildFaceToSimilarityMap([]).size).toBe(0);
  });
});

describe("matchStatus", () => {
  it("confirms at/above 90, pends below", async () => {
    const { matchStatus, CONFIRMED_THRESHOLD } = await import("@/lib/people/matching");
    expect(CONFIRMED_THRESHOLD).toBe(90);
    expect(matchStatus(90)).toBe("confirmed");
    expect(matchStatus(99.9)).toBe("confirmed");
    expect(matchStatus(89.9)).toBe("pending");
    expect(matchStatus(0)).toBe("pending");
  });
});
