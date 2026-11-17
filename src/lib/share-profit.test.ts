import { describe, expect, it } from "vitest";
import { shareSaleQuote } from "./share-profit";

describe("share sale profit tiers", () => {
  it("credits 28.95% profit from KES 30,000 through 50,000", () => {
    expect(shareSaleQuote(1, 30000)).toMatchObject({ percent: 28.95, profit: 8685, proceeds: 38685 });
    expect(shareSaleQuote(1, 50000)).toMatchObject({ percent: 28.95, profit: 14475, proceeds: 64475 });
  });
  it("credits 43.74% from KES 50,001 through 100,000", () => {
    expect(shareSaleQuote(1, 50001)).toMatchObject({ percent: 43.74, profit: 21870.44, proceeds: 71871.44 });
    expect(shareSaleQuote(1, 100000)).toMatchObject({ percent: 43.74, profit: 43740, proceeds: 143740 });
  });
  it("credits 53.92% from KES 100,001 upwards", () => {
    expect(shareSaleQuote(1, 100001)).toMatchObject({ percent: 53.92, profit: 53920.54, proceeds: 153921.54 });
    expect(shareSaleQuote(1, 200000).proceeds).toBe(307840);
  });
  it("returns cost below 30,000 and uses the sold quantity's cost basis", () => {
    expect(shareSaleQuote(1, 29999).proceeds).toBe(29999);
    expect(shareSaleQuote(3, 10000).proceeds).toBe(38685);
    expect(shareSaleQuote(2, 10000).proceeds).toBe(20000);
  });
});