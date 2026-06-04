import { describe, it, expect } from "vitest";
import { isDriveRetryable } from "@/lib/google-drive-api";

describe("isDriveRetryable", () => {
  it("retries on 429 and 5xx (status / code / response.status)", () => {
    expect(isDriveRetryable({ status: 429 })).toBe(true);
    expect(isDriveRetryable({ status: 500 })).toBe(true);
    expect(isDriveRetryable({ status: 503 })).toBe(true);
    expect(isDriveRetryable({ code: 500 })).toBe(true);
    expect(isDriveRetryable({ response: { status: 502 } })).toBe(true);
  });

  it("retries on 403 only with a rate-limit reason", () => {
    // Classic googleapis error shape: numeric code + top-level errors[].reason
    expect(
      isDriveRetryable({ code: 403, errors: [{ reason: "userRateLimitExceeded" }] }),
    ).toBe(true);
    // Gaxios shape: response.data.error.errors[].reason
    expect(
      isDriveRetryable({
        response: { status: 403, data: { error: { errors: [{ reason: "rateLimitExceeded" }] } } },
      }),
    ).toBe(true);
    // 403 for a real permission problem must NOT retry
    expect(
      isDriveRetryable({ code: 403, errors: [{ reason: "insufficientFilePermissions" }] }),
    ).toBe(false);
    expect(isDriveRetryable({ status: 403 })).toBe(false);
  });

  it("retries on transient network errors", () => {
    expect(isDriveRetryable({ code: "ECONNRESET" })).toBe(true);
    expect(isDriveRetryable({ code: "ETIMEDOUT" })).toBe(true);
    expect(isDriveRetryable({ code: "EAI_AGAIN" })).toBe(true);
  });

  it("does not retry on other 4xx / unknown / malformed errors", () => {
    expect(isDriveRetryable({ status: 400 })).toBe(false);
    expect(isDriveRetryable({ status: 401 })).toBe(false);
    expect(isDriveRetryable({ status: 404 })).toBe(false);
    expect(isDriveRetryable({ code: "EUNKNOWN" })).toBe(false);
    expect(isDriveRetryable({})).toBe(false);
    expect(isDriveRetryable(null)).toBe(false);
    expect(isDriveRetryable(new Error("boom"))).toBe(false);
  });
});
