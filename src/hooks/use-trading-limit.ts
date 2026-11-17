import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TradingLimit } from "@/lib/trading-limits";

export function useTradingLimit(userId?: string) {
  const [limit, setLimit] = useState<TradingLimit | null>(null);
  const refresh = useCallback(async () => {
    if (!userId) { setLimit(null); return null; }
    const { data, error } = await supabase.from("user_trading_limits")
      .select("user_id,max_amount,used_amount,cycle_started_at").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    const next = data ? { ...data, max_amount: data.max_amount == null ? null : Number(data.max_amount), used_amount: Number(data.used_amount) } : null;
    setLimit(next);
    return next;
  }, [userId]);

  useEffect(() => {
    void refresh().catch(() => {});
    if (!userId) return;
    const timer = window.setInterval(() => { void refresh().catch(() => {}); }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh, userId]);
  return { limit, refresh };
}