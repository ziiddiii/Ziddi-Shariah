export const SHARE_PROFIT_TIERS = [
  { min: 30000, max: 50000, percent: 28.95, label: "KES 30,000 – 50,000" },
  { min: 50000, max: 100000, percent: 43.74, label: "KES 50,001 – 100,000" },
  { min: 100000, max: Infinity, percent: 53.92, label: "KES 100,001+" },
] as const;

export function shareProfitPercent(basis: number): number {
  if (!Number.isFinite(basis) || basis < 30000) return 0;
  if (basis > 100000) return 53.92;
  if (basis > 50000) return 43.74;
  return 28.95;
}

export function shareSaleQuote(quantity: number, averagePrice: number) {
  const basis = quantity * averagePrice;
  const percent = shareProfitPercent(basis);
  const profit = Math.round((basis * percent / 100 + Number.EPSILON) * 100) / 100;
  const proceeds = Math.round((basis + profit + Number.EPSILON) * 100) / 100;
  const sellPrice = quantity > 0 ? proceeds / quantity : 0;
  return { basis, percent, profit, proceeds, sellPrice, tierLabel: percent ? `+${percent.toFixed(2)}%` : "At cost" };
}