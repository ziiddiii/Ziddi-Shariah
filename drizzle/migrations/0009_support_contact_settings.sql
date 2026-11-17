CREATE TABLE public.support_contact_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
 email text NOT NULL DEFAULT 'info@ziidi.io' CHECK (length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 phone text NOT NULL DEFAULT '0722000000' CHECK (length(phone) BETWEEN 7 AND 30 AND phone ~ '^[+]?[0-9 ()-]+$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_contact_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.support_contact_settings TO authenticated;
GRANT ALL ON public.support_contact_settings TO service_role;
ALTER TABLE public.support_contact_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_contacts_public_read ON public.support_contact_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY support_contacts_admin_insert ON public.support_contact_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY support_contacts_admin_update ON public.support_contact_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));