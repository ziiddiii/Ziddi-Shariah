import { useEffect, useState } from "react";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lockLimitsError } from "@/lib/lock-limits";

export function AdminLockSettings() {
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void supabase
      .from("lock_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        if (data) {
          setMinimum(String(data.min_amount));
          setMaximum(String(data.max_amount));
        }
        setLoading(false);
      });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const validation = lockLimitsError(Number(minimum), Number(maximum));
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Preserve the latest rate and period; this form edits amount limits only.
      const { data: current, error: readError } = await supabase
        .from("lock_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (readError) throw readError;
      const { data, error: saveError } = await supabase.rpc("admin_update_lock_settings", {
        _min_amount: Number(minimum),
        _max_amount: Number(maximum),
        _lock_period_hours: current.lock_period_hours,
        _daily_rate: current.daily_rate,
      });
      if (saveError) throw saveError;
      if (!data) throw new Error("Lock settings could not be saved");
      setMinimum(String(data.min_amount));
      setMaximum(String(data.max_amount));
      toast.success("Lock amount limits saved");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : String((cause as { message?: string })?.message ?? "Could not save lock settings"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="text-foreground">
      <div className="mb-6 flex items-center gap-3">
        <Lock className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Lock Settings</h1>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form onSubmit={save} className="grid max-w-xl gap-5">
          <label className="grid gap-2 text-sm font-medium" htmlFor="lock-minimum">
            Minimum lock amount (KES)
            <Input
              id="lock-minimum"
              type="number"
              required
              min="0.01"
              step="0.01"
              disabled={busy}
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium" htmlFor="lock-maximum">
            Maximum lock amount (KES)
            <Input
              id="lock-maximum"
              type="number"
              required
              min={minimum || "0.01"}
              step="0.01"
              disabled={busy}
              value={maximum}
              onChange={(e) => setMaximum(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy} className="justify-self-start">
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : "Save lock limits"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 break-words text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
