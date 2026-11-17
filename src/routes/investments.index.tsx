import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Search, TrendingUp, ChevronRight, Wallet, Clock } from "lucide-react";
import { InvestmentPosition, type InvestmentPositionData } from "@/components/investment-position";

export const Route = createFileRoute("/investments/")({
  head: () => ({
    meta: [
      { title: "Investment Plans — ZIIDI Shari'ah" },
      { name: "description", content: "Pick an investment plan and grow your capital with fixed returns." },
      { property: "og:title", content: "Investment Plans — ZIIDI Shari'ah" },
      { property: "og:description", content: "Pick an investment plan and grow your capital with fixed returns." },
      { property: "og:url", content: "/investments" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/investments" }],
  }),
  component: InvestmentsPage,
});

type Plan = {
  id: string;
  name: string;
  description: string;
  interest_rate: number;
  duration_hours: number;
  min_amount: number;
  max_amount: number;
  active: boolean;
  sort_order: number;
};

function InvestmentsPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<InvestmentPositionData[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [packages, positions] = await Promise.all([
      supabase.from("investment_plans").select("*").eq("active", true).order("sort_order"),
      user ? supabase.from("investments").select("*").eq("user_id", user.id).order("invested_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (packages.error || positions.error) toast.error(packages.error?.message ?? positions.error?.message ?? "Could not load investments");
    setPlans((packages.data ?? []) as Plan[]);
    setMine(positions.data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
    setNow(Date.now());
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => { void load(); }, 10000);
    return () => { window.clearInterval(clock); window.clearInterval(refresh); };
  }, [load]);

  const claim = async (id: string) => {
    if (claiming) return;
    setClaiming(id);
    const { data, error } = await supabase.rpc("claim_investment_return", { _id: id });
    setClaiming(null);
    if (error || !data) { toast.error(error?.message ?? "Could not claim your investment"); return; }
    setMine((positions) => positions.map((position) => position.id === id ? data : position));
    window.dispatchEvent(new Event("balance-updated"));
    toast.success(`KSH ${Number(data.claimed_amount ?? data.expected_return).toLocaleString(undefined, { minimumFractionDigits: 2 })} credited to your balance — ready for withdrawal.`);
  };

  const filtered = useMemo(() => {
    if (!q.trim()) return plans;
    const s = q.toLowerCase();
    return plans.filter((p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
  }, [q, plans]);

  return (
    <main className="mx-auto max-w-4xl py-4 md:py-8">
      <section className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Available Packages</h1>
          <p className="text-xs text-muted-foreground">Pick an investment plan that fits your capital and time horizon.</p>
        </div>
      </section>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search packages..."
          className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-3">
        {loading && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading plans…</div>}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No plans available right now. Please check again shortly.
          </div>
        )}
        {filtered.map((p) => (
          <Link
            key={p.id}
            to="/investments/$id"
            params={{ id: p.id }}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold">{p.name}</div>
              <div className="line-clamp-1 text-sm text-muted-foreground">{p.description}</div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[11px] text-muted-foreground">Min. Invest</div>
              <div className="whitespace-nowrap text-sm font-bold text-primary">KSH {Number(p.min_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Your Investments</h2>
        {mine.length === 0 ? (
          <div className="text-sm text-muted-foreground">No investments yet.</div>
        ) : (
          <div className="space-y-2">
            {mine.map((investment) => <InvestmentPosition key={investment.id} investment={investment} now={now} claiming={claiming === investment.id} onClaim={() => { void claim(investment.id); }} />)}
          </div>
        )}
      </section>
    </main>
  );
}
