export type InvestmentProgress = {
  status: string;
  matures_at: string;
  invested_at: string;
  claimed_at: string | null;
};

export function investmentProgress(investment: InvestmentProgress, now: number) {
  const end = new Date(investment.matures_at).getTime();
  const start = new Date(investment.invested_at).getTime();
  const claimed = investment.claimed_at != null || investment.status === "claimed";
  const completed = end <= now && ["active", "matured"].includes(investment.status);
  const remainingSeconds = Math.max(0, Math.ceil((end - now) / 1000));
  const progress = claimed || completed ? 100 : Math.max(0, Math.min(100, ((now - start) / Math.max(1, end - start)) * 100));
  return { claimed, claimable: !claimed && completed, remainingSeconds, progress };
}

export function investmentCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}