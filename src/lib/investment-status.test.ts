import { describe, expect, it } from "vitest";
import { investmentProgress } from "./investment-status";

const end = Date.parse("2026-11-13T20:30:00Z");
const investment = { status: "active", invested_at: "2026-11-12T20:30:00Z", matures_at: "2026-11-13T20:30:00Z", claimed_at: null };
describe("investment claim availability", () => {
  it("does not allow early claims", () => { expect(investmentProgress(investment, end - 1).claimable).toBe(false); });
  it("opens claims at the exact completion time even before the next job run", () => { expect(investmentProgress(investment, end).claimable).toBe(true); });
  it("does not expose a second claim after the return is credited", () => { expect(investmentProgress({ ...investment, status: "claimed", claimed_at: investment.matures_at }, end + 1000).claimable).toBe(false); });
});