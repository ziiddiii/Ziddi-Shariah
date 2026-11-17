import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function AdminTradingLimitDialog({ user, onClose }: { user: { id: string; username: string }; onClose: () => void }) {
  const [maximum, setMaximum] = useState("");
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.from("user_trading_limits").select("max_amount,used_amount").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) { toast.error(error.message); return; }
      setMaximum(data?.max_amount == null ? "" : String(data.max_amount));
      setUsed(Number(data?.used_amount ?? 0));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user.id]);
  const save = async (unlimited = false) => {
    const amount = Number(maximum);
    if (!unlimited && (!Number.isFinite(amount) || amount <= 0)) { toast.error("Enter a positive trading limit"); return; }
    setBusy(true);
    const { error } = unlimited
      ? await supabase.rpc("admin_remove_user_trading_limit", { _user_id: user.id })
      : await supabase.rpc("admin_set_user_trading_limit", { _user_id: user.id, _max_amount: amount });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Trading limit updated");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trading limit — {user.username}</DialogTitle>
          <DialogDescription>Buying and selling combined. Resets after withdrawal approval.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
          <div className="text-sm text-muted-foreground">Current trading total: <span className="font-mono text-foreground">KES {used.toLocaleString()}</span></div>
          <label className="block space-y-2 text-sm" htmlFor="user-trading-maximum">
            <span>Maximum trading amount (KES)</span>
            <Input id="user-trading-maximum" type="number" min="0.01" step="0.01" placeholder="e.g. 2000000" value={maximum} onChange={(e) => setMaximum(e.target.value)} disabled={loading || busy} />
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={loading || busy} onClick={() => { void save(true); }}>Remove limit</Button>
            <Button type="submit" disabled={loading || busy}><Save />{busy ? "Saving…" : "Save limit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}