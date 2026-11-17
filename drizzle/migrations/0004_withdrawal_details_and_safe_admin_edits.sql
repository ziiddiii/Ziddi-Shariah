ALTER TABLE public.withdrawals
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN admin_note text,
 ADD COLUMN payout_reference text,
 ADD COLUMN rejection_reason text,
 ADD COLUMN reviewed_at timestamptz,
 ADD COLUMN reviewed_by uuid,
 ADD COLUMN tax_enabled_at_request boolean,
 ADD COLUMN tax_percent_at_request numeric;

CREATE TABLE public.withdrawal_edits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 withdrawal_id uuid NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
 edited_by uuid,
 edited_at timestamptz NOT NULL DEFAULT now(),
 before_details jsonb NOT NULL,
 after_details jsonb NOT NULL
);
GRANT SELECT ON public.withdrawal_edits TO authenticated;
GRANT ALL ON public.withdrawal_edits TO service_role;
ALTER TABLE public.withdrawal_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read withdrawal edit history" ON public.withdrawal_edits FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX withdrawal_edits_by_withdrawal ON public.withdrawal_edits(withdrawal_id,edited_at DESC);
REVOKE UPDATE ON public.withdrawals FROM authenticated;
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

CREATE FUNCTION public.stamp_withdrawal_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE settings public.withdrawal_tax_settings;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO settings FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  NEW.tax_enabled_at_request := settings.tax_enabled;
  NEW.tax_percent_at_request := settings.tax_percent;
 ELSE
  NEW.updated_at := clock_timestamp();
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','approved','rejected') THEN
   NEW.reviewed_at := now();
   NEW.reviewed_by := auth.uid();
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stamp_withdrawal_details() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stamp_withdrawal_details BEFORE INSERT OR UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.stamp_withdrawal_details();

CREATE FUNCTION public.record_withdrawal_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
  INSERT INTO public.withdrawal_edits(withdrawal_id,edited_by,before_details,after_details)
  VALUES (NEW.id,auth.uid(),to_jsonb(OLD),to_jsonb(NEW));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_withdrawal_edit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER record_withdrawal_edit AFTER UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.record_withdrawal_edit();

CREATE FUNCTION public.admin_update_withdrawal(_id uuid,_amount numeric,_method text,_destination text,_tax_tx_code text,_admin_note text,_payout_reference text,_expected_updated_at timestamptz)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals; owner_id uuid; bal numeric; difference numeric; settings public.withdrawal_tax_settings; code text := nullif(upper(trim(coalesce(_tax_tx_code,''))),''); dest text := trim(coalesce(_destination,''));
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Admins only'; END IF;
 SELECT user_id INTO owner_id FROM public.withdrawals WHERE id=_id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
 SELECT balance INTO bal FROM public.profiles WHERE id=owner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 SELECT * INTO w FROM public.withdrawals WHERE id=_id FOR UPDATE;
 IF _expected_updated_at IS NULL OR w.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'Withdrawal changed. Reopen the details before saving'; END IF;
 IF _amount IS NULL OR _amount <= 0 OR _amount::text IN ('NaN','Infinity','-Infinity') OR _amount <> round(_amount,2) THEN RAISE EXCEPTION 'Enter a valid withdrawal amount with at most two decimal places'; END IF;
 IF _method IS NULL OR _method NOT IN ('mpesa','bank','card') THEN RAISE EXCEPTION 'Unsupported withdrawal method'; END IF;
 IF length(dest)<3 OR length(dest)>1000 THEN RAISE EXCEPTION 'Enter a valid destination'; END IF;
 IF code IS NOT NULL AND code !~ '^[A-Z0-9]{8,12}$' THEN RAISE EXCEPTION 'Enter a valid tax transaction code (8-12 letters/numbers)'; END IF;
 IF length(coalesce(_admin_note,''))>2000 OR length(coalesce(_payout_reference,''))>100 THEN RAISE EXCEPTION 'Note or payout reference is too long'; END IF;
 IF w.status NOT IN ('pending','processing') AND (_amount IS DISTINCT FROM w.amount OR _method IS DISTINCT FROM w.method OR dest IS DISTINCT FROM w.destination OR code IS DISTINCT FROM w.tax_tx_code) THEN RAISE EXCEPTION 'Settled payment details are locked. Only notes and payout reference can be edited'; END IF;
 difference := _amount-w.amount;
 IF difference<>0 THEN
  SELECT * INTO settings FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF _amount<GREATEST(100000,coalesce(settings.min_withdrawal,100000)) THEN RAISE EXCEPTION 'Amount is below the minimum withdrawal'; END IF;
  IF settings.id IS NOT NULL AND _amount>settings.max_withdrawal THEN RAISE EXCEPTION 'Amount is above the maximum withdrawal'; END IF;
  IF difference>coalesce(bal,0) THEN RAISE EXCEPTION 'Insufficient user balance for the increased withdrawal'; END IF;
 END IF;
 IF _amount=w.amount AND _method=w.method AND dest=w.destination AND code IS NOT DISTINCT FROM w.tax_tx_code AND nullif(trim(coalesce(_admin_note,'')),'') IS NOT DISTINCT FROM w.admin_note AND nullif(trim(coalesce(_payout_reference,'')),'') IS NOT DISTINCT FROM w.payout_reference THEN RETURN w; END IF;
 IF difference<>0 THEN UPDATE public.profiles SET balance=balance-difference WHERE id=owner_id; END IF;
 UPDATE public.withdrawals SET amount=_amount,method=_method,destination=dest,tax_tx_code=code,
  tax_paid_at=CASE WHEN code IS NOT DISTINCT FROM w.tax_tx_code THEN w.tax_paid_at WHEN code IS NULL THEN NULL ELSE coalesce(w.tax_paid_at,now()) END,
  admin_note=nullif(trim(coalesce(_admin_note,'')),''),payout_reference=nullif(trim(coalesce(_payout_reference,'')),'')
 WHERE id=_id RETURNING * INTO w;
 INSERT INTO public.notifications(user_id,kind,title,body) VALUES (owner_id,'withdrawal','Withdrawal details updated',
  'Your withdrawal details have been updated by an administrator. Amount: KES ' || w.amount::text || '. Method: ' || w.method || '. Open your recent withdrawal history for the full summary.');
 RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.admin_update_withdrawal(uuid,numeric,text,text,text,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid,numeric,text,text,text,text,text,timestamptz) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(_id uuid,_reason text)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals; owner_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Admins only'; END IF;
 IF length(trim(coalesce(_reason,'')))=0 THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
 SELECT user_id INTO owner_id FROM public.withdrawals WHERE id=_id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=owner_id FOR UPDATE;
 SELECT * INTO w FROM public.withdrawals WHERE id=_id FOR UPDATE;
 IF w.id IS NULL OR w.status NOT IN ('pending','processing') THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
 UPDATE public.withdrawals SET status='rejected',rejection_reason=trim(_reason) WHERE id=_id RETURNING * INTO w;
 UPDATE public.profiles SET balance=balance+w.amount WHERE id=w.user_id;
 INSERT INTO public.notifications(user_id,kind,title,body) VALUES (w.user_id,'withdrawal','Withdrawal rejected',
  'Your withdrawal of KES ' || w.amount::text || ' was rejected. Reason: ' || trim(_reason) || '. The amount has been returned to your balance.');
 RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.admin_reject_withdrawal(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid,text) TO authenticated,service_role;