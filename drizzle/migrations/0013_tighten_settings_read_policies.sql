DROP POLICY IF EXISTS "deposit_settings_read_authenticated" ON public.deposit_settings;
CREATE POLICY "deposit_settings_read_signed_in" ON public.deposit_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can read tax settings" ON public.withdrawal_tax_settings;
CREATE POLICY "Signed in can read tax settings" ON public.withdrawal_tax_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can read lock settings" ON public.lock_settings;
CREATE POLICY "Signed in can read lock settings" ON public.lock_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read transfer settings" ON public.transfer_settings;
CREATE POLICY "Signed in can read transfer settings" ON public.transfer_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can read stock settings" ON public.stock_settings;
DROP POLICY IF EXISTS "Public can read stock settings" ON public.stock_settings;
CREATE POLICY "Signed in can read stock settings" ON public.stock_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Visitors can read stock settings" ON public.stock_settings FOR SELECT TO anon USING (auth.role() = 'anon');

DROP POLICY IF EXISTS "support_contacts_public_read" ON public.support_contact_settings;
CREATE POLICY "support_contacts_singleton_read" ON public.support_contact_settings FOR SELECT TO anon, authenticated USING (id = true);

DROP POLICY IF EXISTS "Authenticated read stock logos" ON storage.objects;
CREATE POLICY "Signed in read stock logos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'stock-logos' AND auth.uid() IS NOT NULL AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp','gif'));