import { describe, expect, it } from "vitest";
import { lockAmountError, lockLimitsError } from "./lock-limits";

describe("admin-configured lock amounts", () => {
  it("accepts a valid minimum and maximum and rejects reversed limits", () => {
    expect(lockLimitsError(100, 10000000)).toBeNull();
    expect(lockLimitsError(10000000, 100)).not.toBeNull();
    expect(lockLimitsError(0, 100)).not.toBeNull();
    expect(lockLimitsError(100, Infinity)).not.toBeNull();
  });
  it("enforces the minimum inclusively", () => {
    expect(lockAmountError(100, 100, 10000000)).toBeNull();
    expect(lockAmountError(99.99, 100, 10000000)).not.toBeNull();
  });
  it("enforces the maximum inclusively", () => {
    expect(lockAmountError(10000000, 100, 10000000)).toBeNull();
    expect(lockAmountError(10000000.01, 100, 10000000)).not.toBeNull();
  });
});
