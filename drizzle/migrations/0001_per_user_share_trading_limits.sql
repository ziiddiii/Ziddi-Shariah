CREATE TABLE public.user_trading_limits (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_amount numeric(20,2),
  used_amount numeric(20,2) NOT NULL DEFAULT 0,
  warning_sent boolean NOT NULL DEFAULT false,
  cycle_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT trading_limit_positive CHECK (max_amount IS NULL OR max_amount > 0),
  CONSTRAINT trading_usage_nonnegative CHECK (used_amount >= 0)
);
GRANT SELECT ON public.user_trading_limits TO authenticated;
GRANT ALL ON public.user_trading_limits TO service_role;
ALTER TABLE public.user_trading_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin trading limits" ON public.user_trading_limits FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.user_trading_limits IS 'Combined completed share purchase cost and sale proceeds per user, tracked from introduction and reset only on approved withdrawal. NULL maximum is unlimited.';

CREATE FUNCTION public.trading_limit_allows(_maximum numeric, _used numeric, _amount numeric)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT _amount > 0 AND (_maximum IS NULL OR _used + _amount <= _maximum)
$$;
CREATE FUNCTION public.trading_limit_should_warn(_maximum numeric, _used numeric)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT COALESCE(_maximum > 0 AND _used >= _maximum * 0.9, false)
$$;

CREATE FUNCTION public.admin_set_user_trading_limit(_user_id uuid, _max_amount numeric)
RETURNS public.user_trading_limits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.user_trading_limits;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 IF _max_amount IS NOT NULL AND (_max_amount <= 0 OR _max_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Enter a positive trading limit'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
 INSERT INTO public.user_trading_limits(user_id, max_amount, updated_by)
 VALUES (_user_id, _max_amount, auth.uid())
 ON CONFLICT (user_id) DO UPDATE SET max_amount = EXCLUDED.max_amount, warning_sent = false, updated_at = now(), updated_by = auth.uid()
 RETURNING * INTO result;
 IF public.trading_limit_should_warn(result.max_amount, result.used_amount) THEN
   INSERT INTO public.notifications(user_id, kind, title, body) VALUES (_user_id, 'trading_limit', 'Trading threshold', 'Youve reached the maximum trading threashold please initiate a withdrawal to refresh your trades.');
   UPDATE public.user_trading_limits SET warning_sent = true WHERE user_id = _user_id RETURNING * INTO result;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_user_trading_limit(uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_trading_limit(uuid,numeric) TO authenticated, service_role;

CREATE FUNCTION public.record_share_trade(_user_id uuid, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE limits public.user_trading_limits;
BEGIN
 IF _amount IS NULL OR _amount <= 0 OR _amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid trade amount'; END IF;
 INSERT INTO public.user_trading_limits(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO limits FROM public.user_trading_limits WHERE user_id = _user_id FOR UPDATE;
 IF NOT public.trading_limit_allows(limits.max_amount, limits.used_amount, _amount) THEN
  RAISE EXCEPTION 'Youve reached the maximum trading threashold please initiate a withdrawal to refresh your trades.';
 END IF;
 UPDATE public.user_trading_limits SET used_amount = used_amount + _amount, updated_at = now() WHERE user_id = _user_id RETURNING * INTO limits;
 IF NOT limits.warning_sent AND public.trading_limit_should_warn(limits.max_amount, limits.used_amount) THEN
  INSERT INTO public.notifications(user_id, kind, title, body) VALUES (_user_id, 'trading_limit', 'Trading threshold', 'Youve reached the maximum trading threashold please initiate a withdrawal to refresh your trades.');
  UPDATE public.user_trading_limits SET warning_sent = true WHERE user_id = _user_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_share_trade(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_share_trade(uuid,numeric) TO service_role;

CREATE FUNCTION public.enforce_completed_share_trade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE participant uuid;
BEGIN
 IF NEW.status <> 'sold' OR NEW.buyer_id IS NULL OR NEW.ticker IN ('FXD-BOND','IFB-BOND','ZCB-BOND') THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' AND OLD.status = 'sold' THEN RETURN NEW; END IF;
 -- Consistent profile locking serializes all purchase, sale and withdrawal paths.
 FOR participant IN SELECT id FROM public.profiles WHERE id IN (NEW.buyer_id, NEW.seller_id) ORDER BY id FOR UPDATE LOOP
  NULL;
 END LOOP;
 PERFORM public.record_share_trade(NEW.buyer_id, NEW.quantity * NEW.price_per_share);
 -- The admin's market desk is stock supply, not a personal sale.
 IF NEW.seller_id <> NEW.buyer_id AND NOT public.has_role(NEW.seller_id, 'admin') THEN
  PERFORM public.record_share_trade(NEW.seller_id, NEW.quantity * NEW.price_per_share);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_completed_share_trade() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_completed_share_trade BEFORE INSERT OR UPDATE OF status ON public.listings FOR EACH ROW EXECUTE FUNCTION public.enforce_completed_share_trade();

CREATE FUNCTION public.reset_trading_after_approved_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status IN ('completed','approved') AND OLD.status NOT IN ('completed','approved') THEN
  UPDATE public.user_trading_limits SET used_amount = 0, warning_sent = false, cycle_started_at = now(), updated_at = now() WHERE user_id = NEW.user_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reset_trading_after_approved_withdrawal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reset_trading_after_approved_withdrawal AFTER UPDATE OF status ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.reset_trading_after_approved_withdrawal();

CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(_id uuid)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals; owner_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 SELECT user_id INTO owner_id FROM public.withdrawals WHERE id = _id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
 PERFORM 1 FROM public.profiles WHERE id = owner_id FOR UPDATE;
 SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
 IF w.id IS NULL OR w.status NOT IN ('pending','processing') THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
 UPDATE public.withdrawals SET status = 'completed' WHERE id = _id RETURNING * INTO w;
 RETURN w;
END $$;

CREATE OR REPLACE FUNCTION public.sell_from_holdings(_ticker text, _quantity integer, _price numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.holdings; cost_basis numeric; multiplier numeric; effective_price numeric; proceeds numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
 PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
 IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account suspended'; END IF;
 SELECT * INTO h FROM public.holdings WHERE user_id = auth.uid() AND ticker = _ticker FOR UPDATE;
 IF h.id IS NULL OR h.quantity < _quantity THEN RAISE EXCEPTION 'Not enough shares in portfolio'; END IF;
 cost_basis := _quantity * h.avg_price;
 multiplier := CASE WHEN cost_basis >= 100000 THEN 2.00 WHEN cost_basis >= 50000 THEN 1.70 WHEN cost_basis >= 20000 THEN 1.35 ELSE 1.00 END;
 effective_price := round(h.avg_price * multiplier, 2);
 proceeds := round(_quantity * effective_price, 2);
 PERFORM public.record_share_trade(auth.uid(), proceeds);
 IF h.quantity = _quantity THEN DELETE FROM public.holdings WHERE id = h.id;
 ELSE UPDATE public.holdings SET quantity = quantity - _quantity, updated_at = now() WHERE id = h.id; END IF;
 UPDATE public.profiles SET balance = balance + proceeds WHERE id = auth.uid();
 INSERT INTO public.notifications(user_id, kind, title, body) VALUES (auth.uid(), 'sale', 'Shares sold — balance credited', 'You sold ' || _quantity || ' × ' || _ticker || ' at KES ' || effective_price::text || ' (+' || round((multiplier - 1) * 100, 0)::text || '% market gain). KES ' || proceeds::text || ' has been credited to your available balance.');
 RETURN proceeds;
END $$;

-- Holdings are changed only by authorized trading routines, not browser writes.
REVOKE INSERT, UPDATE, DELETE ON public.holdings FROM authenticated;

CREATE FUNCTION public.guard_direct_trading_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF current_user IN ('anon','authenticated') AND NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
  IF TG_TABLE_NAME = 'listings' THEN
   IF NEW.status IS DISTINCT FROM OLD.status OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.price_per_share IS DISTINCT FROM OLD.price_per_share OR NEW.ticker IS DISTINCT FROM OLD.ticker THEN RAISE EXCEPTION 'Use the share trading actions to update trades'; END IF;
  ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'INSERT' THEN
   IF NEW.balance <> 0 OR NEW.suspended THEN RAISE EXCEPTION 'Account balances are managed by the platform'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_direct_trading_changes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_direct_listing_trade_changes BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.guard_direct_trading_changes();
CREATE TRIGGER guard_direct_profile_trade_changes BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_direct_trading_changes();