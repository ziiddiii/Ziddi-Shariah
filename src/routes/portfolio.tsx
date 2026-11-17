import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Briefcase, TrendingUp, ArrowUpRight, X, CheckCircle2, Loader2 } from "lucide-react";
import { schedulePortfolioSellAlert } from "@/lib/portfolio-sell-alert";
import { shareSaleQuote } from "@/lib/share-profit";
import { TickerLogo } from "@/components/ticker-logo";
import { useTradingLimit } from "@/hooks/use-trading-limit";
import { TradingLimitSummary } from "@/components/trading-limit-summary";
import { tradingLimitState, TRADING_THRESHOLD_MESSAGE, type TradingLimit } from "@/lib/trading-limits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — ZIIDI Shari'ah" },
      { name: "description", content: "View your purchased share holdings and sell shares into your available ZIIDI Shari'ah balance." },
      { property: "og:title", content: "Portfolio — ZIIDI Shari'ah" },
      { property: "og:description", content: "Monitor your holdings and sell shares on ZIIDI Shari'ah." },
      { property: "og:url", content: "/portfolio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/portfolio" }],
  }),
  component: PortfolioPage,
});

type Holding = {
  id: string;
  ticker: string;
  company_name: string | null;
  quantity: number;
  avg_price: number;
};

function PortfolioPage() {
  const { user, loading } = useAuth();
  const trading = useTradingLimit(user?.id);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selling, setSelling] = useState<Holding | null>(null);
  const [surge, setSurge] = useState<Holding | null>(null);
  const latestHoldings = useRef<Holding[]>([]);
  const surgeFired = useRef(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("holdings")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setHoldings((data ?? []) as Holding[]);
  };

  useEffect(() => {
    if (loading) return;
    load();
    if (!user) return;
    const ch = supabase
      .channel(`holdings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "holdings", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  useEffect(() => {
    latestHoldings.current = holdings;
  }, [holdings]);

  const hasHoldings = holdings.length > 0;
  useEffect(() => {
    if (!user || !hasHoldings) {
      surgeFired.current = false;
      setSurge(null);
      return;
    }
    if (surgeFired.current) return;
    return schedulePortfolioSellAlert(() => {
      const target = [...latestHoldings.current].sort(
        (a, b) => b.quantity * Number(b.avg_price) - a.quantity * Number(a.avg_price),
      )[0];
      if (!target) return;
      surgeFired.current = true;
      setSurge(target);
    });
  }, [user?.id, hasHoldings]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user)
    return (
      <div className="p-8 text-center text-muted-foreground">Sign in to view your portfolio.</div>
    );

  const totalValue = holdings.reduce((s, h) => s + h.quantity * Number(h.avg_price), 0);
  const totalQuote = holdings.reduce((s, h) => s + shareSaleQuote(h.quantity, Number(h.avg_price)).proceeds, 0);
  return (
    <main className="mx-auto max-w-7xl min-w-0 py-6 md:py-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Briefcase className="h-4 w-4 text-primary" /> Your holdings</div>
          <h1 className="mt-2 font-heading text-3xl font-semibold">Portfolio</h1>
          <p className="mt-2 text-sm text-muted-foreground">Shares released to you land here. Sell them to convert back to available balance.</p>
        </div>
        <Button variant="outline" asChild><Link to="/deposit">Buy shares <ArrowUpRight className="h-4 w-4" /></Link></Button>
      </header>
      <div className="mb-7 grid grid-cols-2 gap-4 border-y border-border py-5 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Purchase cost</p><p className="mt-2 break-words font-mono text-xl font-semibold text-portfolio-money">KES {totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
        <div><p className="text-xs text-muted-foreground">Projected profit</p><p className="mt-2 break-words font-mono text-xl font-semibold text-portfolio-gain">+{(totalQuote - totalValue).toLocaleString(undefined, { maximumFractionDigits: 2 })} KES</p></div>
        <div className="col-span-2 sm:col-span-1"><p className="text-xs text-muted-foreground">Sale proceeds · all holdings</p><p className="mt-2 break-words font-mono text-xl font-semibold text-portfolio-money">KES {totalQuote.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
      </div>
      <TradingLimitSummary limit={trading.limit} />
      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">Your shares <span className="ml-2 text-sm font-normal text-muted-foreground">{holdings.length}</span></h2>
        {holdings.length === 0 ? <div className="border-t border-border py-8 text-sm text-muted-foreground">No shares yet. Buy from the Trade market — released shares appear here.</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{holdings.map(h => {
          const positionQuote = shareSaleQuote(h.quantity, Number(h.avg_price));
          return <div key={h.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3"><TickerLogo ticker={h.ticker} size={40} /><div className="min-w-0 flex-1"><div className="font-mono text-lg font-semibold">{h.ticker}</div><div className="text-xs text-muted-foreground">{h.company_name}</div></div></div>
            <dl className="my-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Shares</dt><dd className="font-mono">{h.quantity.toLocaleString()}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Avg cost</dt><dd className="font-mono text-portfolio-money">KES {Number(h.avg_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Profit</dt><dd className="font-mono text-portfolio-gain">+{positionQuote.percent}%</dd></div>
              <div className="border-t border-border pt-3"><dt className="text-xs text-muted-foreground">Sale proceeds</dt><dd className="mt-2 break-words font-mono text-lg font-semibold text-portfolio-money">KES {positionQuote.proceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })}</dd></div>
            </dl>
            <Button className="w-full" onClick={() => setSelling(h)}><TrendingUp className="h-4 w-4" /> Sell shares</Button>
          </div>;
        })}</div>}
      </section>

      {selling && (
        <SellDialog
          holding={selling}
          tradingLimit={trading.limit}
          refreshTradingLimit={trading.refresh}
          onClose={() => setSelling(null)}
          onSold={() => {
            setSelling(null);
            setSurge(null);
            load();
          }}
        />
      )}

      {surge && !selling && (
        <SurgeAlert
          holding={surge}
          onClose={() => setSurge(null)}
          onSell={() => {
            setSelling(surge);
            setSurge(null);
          }}
        />
      )}
    </main>
  );
}

function SurgeAlert({
  holding,
  onClose,
  onSell,
}: {
  holding: Holding;
  onClose: () => void;
  onSell: () => void;
}) {
  const quote = shareSaleQuote(holding.quantity, Number(holding.avg_price));
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-portfolio-overlay p-4 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" aria-label="Sell shares alert" className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
      <Button variant="ghost" size="icon" aria-label="Dismiss alert" onClick={onClose} className="absolute right-2 top-2"><X className="h-4 w-4" /></Button>
      <TrendingUp className="h-7 w-7 text-primary" /><h3 className="mt-3 text-lg font-semibold">Your {holding.ticker} shares are ready to sell</h3>
      <p className="mt-2 text-sm text-muted-foreground">{holding.quantity} shares · {quote.percent.toFixed(2)}% platform profit tier</p>
      <p className="mt-4 font-mono text-xl font-semibold text-portfolio-money">KES {quote.proceeds.toLocaleString()}</p>
      <div className="mt-5 flex gap-2"><Button variant="outline" onClick={onClose} className="flex-1">Later</Button><Button onClick={onSell} className="flex-1">Sell now</Button></div>
    </div>
  </div>;
}

function SellDialog({
  holding,
  tradingLimit,
  refreshTradingLimit,
  onClose,
  onSold,
}: {
  holding: Holding;
  tradingLimit: TradingLimit | null;
  refreshTradingLimit: () => Promise<TradingLimit | null>;
  onClose: () => void;
  onSold: () => void;
}) {
  const [qty, setQty] = useState(holding.quantity);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);
  const [step, setStep] = useState(0);


  const avg = Number(holding.avg_price);
  const { basis: costBasis, tierLabel, sellPrice, proceeds: proceedsPreview, profit: saleProfit } = shareSaleQuote(qty, avg);

  const submit = async () => {
    if (qty <= 0 || qty > holding.quantity) {
      toast.error("Invalid quantity");
      return;
    }
    try {
      const currentLimit = await refreshTradingLimit();
      if (tradingLimitState(currentLimit, proceedsPreview).blocked) { toast.error(TRADING_THRESHOLD_MESSAGE); return; }
    } catch { toast.error("Could not check your trading limit. Please try again."); return; }
    setBusy(true);
    setSettling(true);
    setStep(0);
    const startedAt = Date.now();
    const SETTLE_MS = 5000;
    const stepTimers = [
      setTimeout(() => setStep(1), 1300),
      setTimeout(() => setStep(2), 2700),
      setTimeout(() => setStep(3), 4000),
    ];
    const { data, error } = await supabase.rpc("sell_from_holdings", {
      _ticker: holding.ticker,
      _quantity: qty,
      _price: sellPrice,
    });
    if (error) {
      stepTimers.forEach(clearTimeout);
      setBusy(false);
      setSettling(false);
      toast.error(error.message);
      return;
    }
    await new Promise((r) => setTimeout(r, Math.max(0, SETTLE_MS - (Date.now() - startedAt))));
    stepTimers.forEach(clearTimeout);
    setStep(4);
    await new Promise((r) => setTimeout(r, 500));
    setBusy(false);
    setSettling(false);

    const proceeds = Number(data ?? proceedsPreview);
    toast.success(`Sold ${qty} × ${holding.ticker} — KES ${proceeds.toFixed(2)} credited to your balance.`);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const { notify } = await import("@/lib/notify");
        await notify(
          uid,
          "sale",
          `Shares sold — ${holding.ticker}`,
          `You sold ${qty} × ${holding.ticker} at ${tierLabel}. KES ${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been credited to your available balance and is ready for withdrawal.`,
          {
            reference: holding.id.slice(0, 8).toUpperCase(),
            details: [
              { label: "Stock", value: holding.ticker },
              { label: "Quantity sold", value: `${qty} shares` },
              { label: "Buy price", value: `KES ${avg.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Sell price", value: `KES ${sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Profit tier", value: tierLabel },
              { label: "Proceeds credited", value: `KES ${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
              { label: "Date", value: new Date().toLocaleString() },
            ],
          },
        );
      }
    } catch {}
    onSold();
  };

  if (settling) {
    return <SellingOverlay ticker={holding.ticker} qty={qty} proceeds={proceedsPreview} step={step} />;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-portfolio-overlay p-4 backdrop-blur-sm">

      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Sell {holding.ticker}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sell up to {holding.quantity} shares. Proceeds are credited to your available balance instantly.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Quantity</span>
            <input
              type="number"
              min={1}
              max={holding.quantity}
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value || "0", 10))}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="rounded-lg border border-border bg-secondary p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg cost</span>
              <span className="font-mono">KES {avg.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Cost basis</span>
              <span className="font-mono">KES {costBasis.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Profit tier</span>
              <span className="font-semibold text-portfolio-gain">{tierLabel}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Sell price / share</span>
              <span className="font-mono font-semibold">KES {sellPrice.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold">You receive</span>
              <span className="font-mono font-semibold text-portfolio-gain">KES {proceedsPreview.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-sm font-mono text-portfolio-gain">Profit: +KES {saleProfit.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">
            Profit is added to the purchase cost: KES 30,000–50,000 at 28.95%; above 50,000–100,000 at 43.74%; above 100,000 at 53.92%.
          </p>
        </div>
        <TradingLimitSummary limit={tradingLimit} amount={proceedsPreview} />
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            disabled={busy || tradingLimitState(tradingLimit, proceedsPreview).blocked}
            onClick={submit}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Selling…" : "Sell now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
function SellingOverlay({
  ticker,
  qty,
  proceeds,
  step,
}: {
  ticker: string;
  qty: number;
  proceeds: number;
  step: number;
}) {
  const TOTAL_MS = 5000;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.min(TOTAL_MS, Date.now() - startedAt)), 80);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, (elapsed / TOTAL_MS) * 100);
  const secondsLeft = Math.max(0, Math.ceil((TOTAL_MS - elapsed) / 1000));
  const done = step >= 4;

  const steps = [
    "Confirming your share holding",
    `Matching ${qty} × ${ticker} at the platform profit tier`,
    "Settling the sale",
    "Crediting proceeds to your available balance",
  ];

  const R = 42;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-portfolio-overlay p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex flex-col items-center px-6 pt-7 text-center">
          <div className="relative grid h-28 w-28 place-items-center">
            <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
              <circle cx="50" cy="50" r={R} className="fill-none stroke-muted" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r={R}
                className="fill-none stroke-primary transition-[stroke-dashoffset] duration-100 ease-linear"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (C * pct) / 100}
              />
            </svg>
            <span className="absolute grid place-items-center">
              {done ? (
                <CheckCircle2 className="h-9 w-9 text-primary" />
              ) : (
                <span className="font-mono text-2xl font-semibold tabular-nums">{secondsLeft}s</span>
              )}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {done ? "Sale complete!" : "Processing your sale…"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {done
              ? `KES ${proceeds.toLocaleString(undefined, { minimumFractionDigits: 2 })} credited to your available balance.`
              : `Selling ${qty} × ${ticker}. Please keep this window open.`}
          </p>
        </div>
        <div className="mt-5 space-y-2 px-6 pb-6">
          {steps.map((label, i) => {
            const state = done || step > i ? "done" : step === i ? "active" : "idle";
            return (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  state === "idle"
                    ? "border-border text-muted-foreground opacity-60"
                    : state === "active"
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border text-foreground"
                }`}
              >
                {state === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Loader2 className={`h-4 w-4 shrink-0 ${state === "active" ? "animate-spin text-primary" : ""}`} />
                )}
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
