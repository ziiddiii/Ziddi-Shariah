import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tradingLimitState, TRADING_THRESHOLD_MESSAGE, type TradingLimit } from "@/lib/trading-limits";

export function TradingLimitSummary({ limit, amount = 0 }: { limit: TradingLimit | null; amount?: number }) {
  if (limit?.max_amount == null) return null;
  const state = tradingLimitState(limit, amount);
  return (
    <div className="my-4 space-y-2 border-y border-border py-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-muted-foreground">Trading total</span>
        <span className="font-mono text-foreground">KES {limit.used_amount.toLocaleString()} / {limit.max_amount.toLocaleString()}</span>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Buying + selling · since last approved withdrawal</span>
        <span>KES {state.remaining?.toLocaleString()} remaining</span>
      </div>
      {state.near && (
        <div role="alert" className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p>{TRADING_THRESHOLD_MESSAGE}</p>
            <Button asChild variant="link" size="sm" className="h-auto p-0"><Link to="/withdraw">Initiate withdrawal</Link></Button>
          </div>
        </div>
      )}
    </div>
  );
}