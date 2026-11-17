import { Link } from "@tanstack/react-router";
import { ArrowDownToLine, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { investmentProgress, investmentCountdown } from "@/lib/investment-status";
import type { Database } from "@/integrations/supabase/types";

export type InvestmentPositionData = Database["public"]["Tables"]["investments"]["Row"];
const money = (value: number) => `KSH ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function InvestmentPosition({ investment, now, claiming, onClaim }: {
  investment: InvestmentPositionData;
  now: number;
  claiming: boolean;
  onClaim: () => void;
}) {
  const state = investmentProgress(investment, now);
  return (
    <article className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label={investment.plan_name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{investment.plan_name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Reference {investment.id.slice(0, 8).toUpperCase()} · {investment.duration_hours}h</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          {state.claimed ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          {state.claimed ? "Claimed" : state.claimable ? "Ready to claim" : investment.status === "active" ? "Active" : investment.status}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Invested</dt><dd className="mt-1 break-words text-sm font-semibold">{money(investment.amount)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">ROI</dt><dd className="mt-1 break-words text-sm font-semibold text-primary">{money(investment.expected_return - investment.amount)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Total return</dt><dd className="mt-1 break-words text-sm font-semibold">{money(investment.claimed_amount ?? investment.expected_return)}</dd></div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {state.claimed ? `Credited ${investment.claimed_at ? new Date(investment.claimed_at).toLocaleString() : "to balance"}` : state.claimable ? "Investment completed" : `Completes ${new Date(investment.matures_at).toLocaleString()}`}
          {!state.claimed && !state.claimable && investment.status === "active" && <span className="mt-1 block font-mono font-semibold text-foreground">{investmentCountdown(state.remainingSeconds)} remaining</span>}
        </p>
        {state.claimable && <Button onClick={onClaim} disabled={claiming}><>{claiming ? <Loader2 className="animate-spin" /> : <ArrowDownToLine />}{claiming ? "Claiming…" : "Claim return"}</></Button>}
        {state.claimed && <Button asChild variant="outline" size="sm"><Link to="/withdraw"><ArrowDownToLine /> Withdraw</Link></Button>}
      </div>
    </article>
  );
}