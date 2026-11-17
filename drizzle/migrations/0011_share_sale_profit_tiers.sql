CREATE OR REPLACE FUNCTION public.sell_from_holdings(_ticker text, _quantity integer, _price numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.holdings; cost_basis numeric; profit_percent numeric; effective_price numeric; proceeds numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
 PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account suspended'; END IF;
 SELECT * INTO h FROM public.holdings WHERE user_id = auth.uid() AND ticker = _ticker FOR UPDATE;
 IF h.id IS NULL OR h.quantity < _quantity THEN RAISE EXCEPTION 'Not enough shares in portfolio'; END IF;
 cost_basis := _quantity * h.avg_price;
 profit_percent := CASE WHEN cost_basis > 100000 THEN 53.92 WHEN cost_basis > 50000 THEN 43.74 WHEN cost_basis >= 30000 THEN 28.95 ELSE 0 END;
 proceeds := round(cost_basis + round(cost_basis * profit_percent / 100, 2), 2);
 effective_price := proceeds / _quantity;
 PERFORM public.record_share_trade(auth.uid(), proceeds);
 IF h.quantity = _quantity THEN DELETE FROM public.holdings WHERE id = h.id;
 ELSE UPDATE public.holdings SET quantity = quantity - _quantity, updated_at = now() WHERE id = h.id; END IF;
 UPDATE public.profiles SET balance = balance + proceeds WHERE id = auth.uid();
 INSERT INTO public.notifications(user_id, kind, title, body) VALUES (auth.uid(), 'sale', 'Shares sold — balance credited', 'You sold ' || _quantity || ' × ' || _ticker || ' at KES ' || round(effective_price,2)::text || ' (+' || profit_percent::text || '% platform profit tier). KES ' || proceeds::text || ' has been credited to your available balance.');
 RETURN proceeds;
END $$;
REVOKE ALL ON FUNCTION public.sell_from_holdings(text,integer,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sell_from_holdings(text,integer,numeric) TO authenticated, service_role;