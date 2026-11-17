ALTER TABLE public.investments ADD COLUMN settled_by uuid;
COMMENT ON COLUMN public.investments.settled_by IS 'Admin who completed and credited this investment; null for an owner claim.';
CREATE OR REPLACE FUNCTION public.admin_settle_investment(_id uuid)
RETURNS public.investments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE investment public.investments; owner_id uuid; payout numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Admins only'; END IF;
 SELECT user_id INTO owner_id FROM public.investments WHERE id=_id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Investment not found'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=owner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 SELECT * INTO investment FROM public.investments WHERE id=_id FOR UPDATE;
 IF investment.claimed_at IS NOT NULL OR investment.status='claimed' THEN RETURN investment; END IF;
 IF investment.status NOT IN ('active','matured') THEN RAISE EXCEPTION 'Investment is not available to settle'; END IF;
 payout := round(investment.expected_return,2);
 IF payout IS NULL OR payout <= 0 OR investment.amount IS NULL OR payout < investment.amount OR payout::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid investment return. Please contact support'; END IF;
 UPDATE public.profiles SET balance=balance+payout WHERE id=owner_id;
 UPDATE public.investments SET status='claimed',matured_at=COALESCE(matured_at,now()),claimed_at=now(),claimed_amount=payout,settled_by=auth.uid() WHERE id=_id RETURNING * INTO investment;
 INSERT INTO public.notifications(user_id,kind,title,body) VALUES (owner_id,'investment','Investment completed — balance credited',
 investment.plan_name || ' has been completed by an administrator. KES ' || payout::text || ' (your invested amount plus profits) has been credited to your available balance.');
 RETURN investment;
END $$;
REVOKE ALL ON FUNCTION public.admin_settle_investment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_settle_investment(uuid) TO authenticated, service_role;