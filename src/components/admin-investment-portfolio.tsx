import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LineChart, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Investment = Tables<"investments">;
type Investor = Pick<Tables<"profiles">, "id" | "username" | "phone" | "account_id">;
const money = (value: number) => `KES ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: string) => new Date(value).toLocaleString();

export function AdminInvestmentPortfolio() {
  const [rows, setRows] = useState<Investment[]>([]);
  const [investors, setInvestors] = useState<Map<string, Investor>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Investment | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const investments: Investment[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error: readError } = await supabase.from("investments").select("*").order("invested_at", { ascending: false }).order("id").range(offset, offset + 499);
        if (readError) throw readError;
        investments.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) break;
      }
      const ids = [...new Set(investments.map(row => row.user_id))];
      const profiles: Investor[] = [];
      for (let offset = 0; offset < ids.length; offset += 200) {
        const { data, error: profileError } = await supabase.from("profiles").select("id,username,phone,account_id").in("id", ids.slice(offset, offset + 200));
        if (profileError) throw profileError;
        profiles.push(...(data ?? []));
      }
      setRows(investments);
      setInvestors(new Map(profiles.map(profile => [profile.id, profile])));
      setError("");
    } catch (cause) {
      setError((cause as { message?: string }).message ?? "Could not load investments");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function settle() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { data, error: settleError } = await supabase.rpc("admin_settle_investment", { _id: selected.id });
      if (settleError) throw settleError;
      if (!data || data.claimed_at === null) throw new Error("Investment was not settled");
      toast.success(`Investment settled — ${money(Number(data.claimed_amount))} credited to the user's account.`);
      setSelected(null);
      await load();
    } catch (cause) { toast.error((cause as { message?: string }).message ?? "Could not settle investment"); }
    finally { setBusy(false); }
  }
  const visible = rows.filter(row => {
    const investor = investors.get(row.user_id);
    const term = search.trim().toLowerCase();
    return (status === "all" || row.status === status) && (!term || [investor?.username, investor?.phone, investor?.account_id, row.plan_name, row.id].some(value => value?.toLowerCase().includes(term)));
  });
  const unsettled = rows.filter(row => row.claimed_at === null && ["active", "matured"].includes(row.status));
  return <section className="min-w-0 text-foreground">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-xl font-semibold"><LineChart className="h-6 w-6 text-primary" />Investment Portfolio</h1><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</Button></header>
    <div className="mb-6 grid gap-4 border-y border-border py-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Investors</p><p className="mt-1 text-xl font-semibold">{new Set(rows.map(row => row.user_id)).size}</p></div><div><p className="text-xs text-muted-foreground">Unsettled principal</p><p className="mt-1 break-words font-mono font-semibold">{money(unsettled.reduce((sum, row) => sum + Number(row.amount), 0))}</p></div><div><p className="text-xs text-muted-foreground">Pending settlement · principal + profit</p><p className="mt-1 break-words font-mono font-semibold">{money(unsettled.reduce((sum, row) => sum + Number(row.expected_return), 0))}</p></div></div>
    <div className="mb-5 flex flex-wrap gap-3"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search investments" placeholder="Name, phone, account ID or plan" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><select aria-label="Investment status" value={status} onChange={e => setStatus(e.target.value)} className="rounded-md border border-input bg-card px-3 py-2 text-sm"><option value="all">All investments</option><option value="active">Active</option><option value="matured">Matured</option><option value="claimed">Settled</option></select></div>
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    {loading ? <p className="text-muted-foreground">Loading…</p> : visible.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No investments found.</p> : <div className="grid gap-4 xl:grid-cols-2">{visible.map(row => {
      const investor = investors.get(row.user_id);
      const settled = row.claimed_at !== null || row.status === "claimed";
      return <article key={row.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{investor?.username ?? "Unknown investor"}</h2><p className="mt-1 text-xs text-muted-foreground">{investor?.account_id ?? row.user_id} · {investor?.phone ?? "No phone"}</p></div><span className="shrink-0 text-xs font-semibold text-primary">{settled ? "Settled" : row.status === "matured" ? "Matured" : row.status === "active" ? "Active" : row.status}</span></div>
        <p className="mt-4 break-words text-sm font-medium">{row.plan_name}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-muted-foreground">Principal</dt><dd className="mt-1 break-words font-mono">{money(row.amount)}</dd></div><div><dt className="text-xs text-muted-foreground">Profit</dt><dd className="mt-1 break-words font-mono">{money(Number(row.expected_return) - Number(row.amount))}</dd></div><div><dt className="text-xs text-muted-foreground">Started</dt><dd className="mt-1 text-xs">{date(row.invested_at)}</dd></div><div><dt className="text-xs text-muted-foreground">Matures</dt><dd className="mt-1 text-xs">{date(row.matures_at)}</dd></div></dl>
        <div className="mt-4 border-t border-border pt-4"><p className="text-xs text-muted-foreground">{settled ? "Credited to account" : "Total settlement"}</p><p className="mt-1 break-words font-mono font-semibold">{money(Number(settled ? row.claimed_amount ?? row.expected_return : row.expected_return))}</p>
          {settled ? <p className="mt-3 text-xs text-muted-foreground">{row.claimed_at ? date(row.claimed_at) : ""} · {row.settled_by ? "Completed by admin" : "Claimed by user"}</p> : ["active", "matured"].includes(row.status) && <Button className="mt-4 w-full" onClick={() => setSelected(row)}><CheckCircle2 className="h-4 w-4" />Complete & settle</Button>}
        </div>
      </article>;
    })}</div>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open && !busy) setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Complete & settle investment?</DialogTitle><DialogDescription>{selected ? `${selected.plan_name} — ${investors.get(selected.user_id)?.username ?? "Investor"}` : ""}</DialogDescription></DialogHeader>{selected && <div className="space-y-3 text-sm"><p>This credits <strong>{money(selected.expected_return)}</strong> to the user's available balance, including <strong>{money(selected.amount)}</strong> principal and <strong>{money(Number(selected.expected_return) - Number(selected.amount))}</strong> profit.</p>{new Date(selected.matures_at).getTime() > Date.now() && <p className="font-medium text-destructive">This investment has not matured yet. Completing it now settles the full return early.</p>}</div>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button disabled={busy} onClick={() => void settle()}>{busy ? "Settling…" : "Confirm settlement"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}