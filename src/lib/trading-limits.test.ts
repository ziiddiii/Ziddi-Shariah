import { describe, expect, it } from "vitest";
import { tradingLimitState, type TradingLimit } from "./trading-limits";

const limit = (used: number): TradingLimit => ({ user_id: "test", max_amount: 2000000, used_amount: used, cycle_started_at: "2026-11-12" });

describe("per-user share trading threshold", () => {
  it("allows an order exactly at the KES 2,000,000 maximum", () => {
    expect(tradingLimitState(limit(1000000), 1000000).blocked).toBe(false);
  });
  it("blocks an order exceeding KES 2,000,000 even by a cent", () => {
    expect(tradingLimitState(limit(1000000), 1000000.01).blocked).toBe(true);
  });
  it("warns when the projected combined total reaches 90%", () => {
    expect(tradingLimitState(limit(1700000), 100000).near).toBe(true);
    expect(tradingLimitState(limit(1700000), 99999).near).toBe(false);
  });
  it("does not impose a cap on users without an admin-set maximum", () => {
    expect(tradingLimitState(null, 2000001).blocked).toBe(false);
  });
});