-- Replace only existing user-facing brand text in function bodies; retain signatures, security settings and grants.
DO $rename$
DECLARE fn record; definition text;
BEGIN
  FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' AND pg_get_functiondef(p.oid) ~* '\mziidi\M'
  LOOP
    definition := regexp_replace(pg_get_functiondef(fn.oid), '\mziidi( traders?)?\M', 'ZIIDI Shari''''ah', 'gi');
    EXECUTE definition;
  END LOOP;
END
$rename$;
ALTER TABLE public.deposit_settings ALTER COLUMN business_name SET DEFAULT 'SAFARICOM ZIIDI Shari''ah MMF';