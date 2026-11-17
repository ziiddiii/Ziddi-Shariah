CREATE OR REPLACE FUNCTION public.admin_update_lock_settings(_min_amount numeric, _max_amount numeric, _lock_period_hours integer, _daily_rate numeric)
RETURNS public.lock_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s public.lock_settings;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 IF _min_amount IS NULL OR _max_amount IS NULL OR _min_amount::text IN ('NaN','Infinity','-Infinity') OR _max_amount::text IN ('NaN','Infinity','-Infinity') OR _min_amount <= 0 OR _max_amount < _min_amount THEN RAISE EXCEPTION 'Invalid amounts'; END IF;
 IF _lock_period_hours IS NULL OR _lock_period_hours < 1 THEN RAISE EXCEPTION 'Lock period must be at least 1 hour'; END IF;
 IF _daily_rate IS NULL OR _daily_rate::text IN ('NaN','Infinity','-Infinity') OR _daily_rate < 0 OR _daily_rate > 1 THEN RAISE EXCEPTION 'Daily rate must be 0-1'; END IF;
 SELECT * INTO s FROM public.lock_settings ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Lock is not configured'; END IF;
 UPDATE public.lock_settings SET min_amount=_min_amount,max_amount=_max_amount,lock_period_hours=_lock_period_hours,daily_rate=_daily_rate,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 RETURN s;
END; $function$;
REVOKE ALL ON FUNCTION public.admin_update_lock_settings(numeric,numeric,integer,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_lock_settings(numeric,numeric,integer,numeric) TO authenticated,service_role;