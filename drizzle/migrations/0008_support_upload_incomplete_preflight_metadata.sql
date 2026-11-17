ALTER POLICY "Support participants upload private attachments" ON storage.objects
WITH CHECK (bucket_id='support-attachments'
  AND (split_part(name,'/',1)=auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  AND split_part(name,'/',2)=auth.uid()::text
  AND array_length(string_to_array(name,'/'),1)=3
  AND NOT public.is_suspended(auth.uid())
  AND lower(substring(split_part(name,'/',3) from '\.([^.]+)$')) IN ('jpg','jpeg','png','gif','webp','pdf','txt','csv','doc','docx','xls','xlsx','ppt','pptx')
  AND (metadata->>'mimetype' IS NULL OR metadata->>'size' IS NULL OR public.support_attachment_allowed(split_part(name,'/',3),metadata->>'mimetype',(metadata->>'size')::bigint)));
COMMENT ON POLICY "Support participants upload private attachments" ON storage.objects IS 'Storage upload permission probes can provide absent or incomplete metadata. Conversation, sender, extension and suspension are always checked; bucket size and message metadata checks remain authoritative.';