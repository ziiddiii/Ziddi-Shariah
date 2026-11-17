import { afterEach, expect, it, vi } from "vitest";
import { schedulePortfolioSellAlert } from "./portfolio-sell-alert";

afterEach(() => vi.useRealTimers());

it("alerts to sell after exactly five seconds, not earlier", () => {
  vi.useFakeTimers();
  const alert = vi.fn();
  schedulePortfolioSellAlert(alert);
  vi.advanceTimersByTime(4999);
  expect(alert).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(alert).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(5000);
  expect(alert).toHaveBeenCalledTimes(1);
});

it("cancels the pending alert when the portfolio is left", () => {
  vi.useFakeTimers();
  const alert = vi.fn();
  const cancel = schedulePortfolioSellAlert(alert);
  cancel();
  vi.advanceTimersByTime(5000);
  expect(alert).not.toHaveBeenCalled();
});