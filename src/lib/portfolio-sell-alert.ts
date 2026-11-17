export const PORTFOLIO_SELL_ALERT_DELAY_MS = 5000;

export function schedulePortfolioSellAlert(onAlert: () => void) {
  const timer = setTimeout(onAlert, PORTFOLIO_SELL_ALERT_DELAY_MS);
  return () => clearTimeout(timer);
}