export const TRADING_THRESHOLD_MESSAGE = "Youve reached the maximum trading threashold please initiate a withdrawal to refresh your trades.";

export type TradingLimit = {
  user_id: string;
  max_amount: number | null;
  used_amount: number;
  cycle_started_at: string;
};

export function tradingLimitState(limit: TradingLimit | null, amount = 0) {
  const maximum = limit?.max_amount;
  const used = Number(limit?.used_amount ?? 0);
  if (maximum == null) return { remaining: null, blocked: false, near: false };
  const max = Number(maximum);
  const projected = Math.round((used + amount) * 100) / 100;
  return {
    remaining: Math.max(0, max - used),
    blocked: projected > max,
    near: projected >= max * 0.9,
  };
}