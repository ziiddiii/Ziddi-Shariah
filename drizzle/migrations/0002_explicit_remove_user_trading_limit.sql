CREATE FUNCTION public.admin_remove_user_trading_limit(_user_id uuid)
RETURNS public.user_trading_limits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.user_trading_limits;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
 INSERT INTO public.user_trading_limits(user_id, max_amount, updated_by)
 VALUES (_user_id, NULL, auth.uid())
 ON CONFLICT (user_id) DO UPDATE SET max_amount = NULL, warning_sent = false, updated_at = now(), updated_by = auth.uid()
 RETURNING * INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_remove_user_trading_limit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_trading_limit(uuid) TO authenticated, service_role;