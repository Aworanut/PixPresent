import { describe, it, expect } from "vitest";
import { getProvider } from "@/lib/storage";

describe("getProvider", () => {
  it("rejects an unknown source type", async () => {
    // @ts-expect-error — testing the runtime guard
    await expect(getProvider("bogus", {})).rejects.toThrow(/unknown source/i);
  });
  it("rejects gdrive without a Google refresh token", async () => {
    await expect(
      getProvider("gdrive", { googleRefreshToken: null }),
    ).rejects.toThrow(/google drive not connected/i);
  });
  it("rejects dropbox without a Dropbox refresh token", async () => {
    await expect(
      getProvider("dropbox", { dropboxRefreshToken: null }),
    ).rejects.toThrow(/dropbox not connected/i);
  });
});
