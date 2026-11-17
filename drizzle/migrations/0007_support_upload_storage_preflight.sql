ALTER POLICY "Support participants upload private attachments" ON storage.objects
WITH CHECK (bucket_id='support-attachments'
  AND (split_part(name,'/',1)=auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  AND split_part(name,'/',2)=auth.uid()::text
  AND array_length(string_to_array(name,'/'),1)=3
  AND NOT public.is_suspended(auth.uid())
  AND lower(substring(split_part(name,'/',3) from '\.([^.]+)$')) IN ('jpg','jpeg','png','gif','webp','pdf','txt','csv','doc','docx','xls','xlsx','ppt','pptx')
  AND (metadata IS NULL OR public.support_attachment_allowed(split_part(name,'/',3),metadata->>'mimetype',(metadata->>'size')::bigint)));
COMMENT ON POLICY "Support participants upload private attachments" ON storage.objects IS 'Storage checks INSERT permission first with null metadata; validate metadata when supplied and again before linking a message. Bucket enforces the 10 MB size limit.';