import { describe, expect, it } from "vitest";
import { stockMinimumEntry } from "./stock-minimum";

describe("admin stock minimum entry", () => {
  it("uses the admin minimum instead of the former KSH 30,000 example", () => {
    expect(stockMinimumEntry({ min_total: 38421 })).toBe(38421);
    expect(stockMinimumEntry({ min_total: 2000000 })).toBe(2000000);
  });

  it("does not invent a minimum before settings are available", () => {
    expect(stockMinimumEntry(null)).toBeNull();
    expect(stockMinimumEntry({ min_total: 0 })).toBeNull();
  });
});