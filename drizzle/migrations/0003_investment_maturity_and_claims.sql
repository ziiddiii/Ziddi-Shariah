ALTER TABLE public.investments ADD COLUMN matured_at timestamptz;
ALTER TABLE public.investments ADD COLUMN claimed_at timestamptz;
ALTER TABLE public.investments ADD COLUMN claimed_amount numeric(20,2);
GRANT SELECT ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
CREATE INDEX investments_due_for_maturity ON public.investments(matures_at) WHERE status='active';
COMMENT ON COLUMN public.investments.claimed_amount IS 'Principal plus ROI credited once by claim_investment_return. Maturity alone never credits the wallet.';

CREATE FUNCTION public.complete_due_investments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE completed integer;
BEGIN
 WITH due AS (
  SELECT id FROM public.investments WHERE status='active' AND matures_at <= now()
  ORDER BY matures_at,id LIMIT 500 FOR UPDATE SKIP LOCKED
 ), matured AS (
  UPDATE public.investments i SET status='matured',matured_at=COALESCE(i.matured_at,now())
  FROM due WHERE i.id=due.id AND i.status='active' RETURNING i.*
 ), notified AS (
  INSERT INTO public.notifications(user_id,kind,title,body)
  SELECT user_id,'investment','Investment completed — return ready to claim',
   plan_name || ' has completed. Claim KES ' || round(expected_return,2)::text || ' (your invested amount plus ROI) into your available balance for withdrawal.'
  FROM matured RETURNING user_id
 ) SELECT count(*)::integer INTO completed FROM notified;
 RETURN completed;
END $$;
REVOKE ALL ON FUNCTION public.complete_due_investments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_due_investments() TO service_role;

CREATE FUNCTION public.claim_investment_return(_id uuid)
RETURNS public.investments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE investment public.investments; payout numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to claim your investment'; END IF;
 IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account suspended'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 SELECT * INTO investment FROM public.investments WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Investment not found'; END IF;
 IF investment.claimed_at IS NOT NULL OR investment.status='claimed' THEN RETURN investment; END IF;
 IF investment.status NOT IN ('active','matured') THEN RAISE EXCEPTION 'Investment is not available to claim'; END IF;
 IF investment.matures_at > now() THEN RAISE EXCEPTION 'Your investment has not completed yet'; END IF;
 payout := round(investment.expected_return,2);
 IF payout IS NULL OR payout <= 0 OR payout < investment.amount OR payout::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid investment return. Please contact support'; END IF;
 UPDATE public.profiles SET balance=balance+payout WHERE id=auth.uid();
 UPDATE public.investments SET status='claimed',matured_at=COALESCE(matured_at,now()),claimed_at=now(),claimed_amount=payout WHERE id=_id RETURNING * INTO investment;
 INSERT INTO public.notifications(user_id,kind,title,body) VALUES (auth.uid(),'investment','Investment return claimed — balance credited',
  'KES ' || payout::text || ' from ' || investment.plan_name || ' has been credited to your available balance, including your invested amount and ROI. You can now request a withdrawal.');
 RETURN investment;
END $$;
REVOKE ALL ON FUNCTION public.claim_investment_return(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_investment_return(uuid) TO authenticated, service_role;