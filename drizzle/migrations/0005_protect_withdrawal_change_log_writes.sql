REVOKE ALL ON public.withdrawal_edits FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.withdrawal_edits FROM authenticated;
GRANT SELECT ON public.withdrawal_edits TO authenticated;
GRANT ALL ON public.withdrawal_edits TO service_role;