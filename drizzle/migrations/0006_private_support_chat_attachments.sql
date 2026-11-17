ALTER TABLE public.support_messages
  ADD COLUMN attachment_path text,
  ADD COLUMN attachment_name text,
  ADD COLUMN attachment_type text,
  ADD COLUMN attachment_size bigint;

CREATE FUNCTION public.support_attachment_allowed(_name text, _mime text, _size bigint)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(_size > 0 AND _size <= 10485760 AND length(_name) BETWEEN 1 AND 255 AND
    CASE lower(substring(_name from '\.([^.]+)$'))
      WHEN 'jpg' THEN _mime = 'image/jpeg'
      WHEN 'jpeg' THEN _mime = 'image/jpeg'
      WHEN 'png' THEN _mime = 'image/png'
      WHEN 'gif' THEN _mime = 'image/gif'
      WHEN 'webp' THEN _mime = 'image/webp'
      WHEN 'pdf' THEN _mime = 'application/pdf'
      WHEN 'txt' THEN _mime = 'text/plain'
      WHEN 'csv' THEN _mime IN ('text/csv','application/vnd.ms-excel')
      WHEN 'doc' THEN _mime = 'application/msword'
      WHEN 'docx' THEN _mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      WHEN 'xls' THEN _mime = 'application/vnd.ms-excel'
      WHEN 'xlsx' THEN _mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      WHEN 'ppt' THEN _mime = 'application/vnd.ms-powerpoint'
      WHEN 'pptx' THEN _mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ELSE false END, false)
$$;
REVOKE ALL ON FUNCTION public.support_attachment_allowed(text,text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_attachment_allowed(text,text,bigint) TO authenticated, service_role;

ALTER TABLE public.support_messages ADD CONSTRAINT support_attachment_complete CHECK (
  (attachment_path IS NULL AND attachment_name IS NULL AND attachment_type IS NULL AND attachment_size IS NULL)
  OR (attachment_path IS NOT NULL AND attachment_name IS NOT NULL AND attachment_type IS NOT NULL AND attachment_size IS NOT NULL
      AND public.support_attachment_allowed(attachment_name, attachment_type, attachment_size))
);
ALTER TABLE public.support_messages ADD CONSTRAINT support_message_has_content CHECK (length(btrim(body)) > 0 OR attachment_path IS NOT NULL) NOT VALID;
CREATE UNIQUE INDEX support_messages_attachment_path_key ON public.support_messages(attachment_path) WHERE attachment_path IS NOT NULL;

CREATE FUNCTION public.guard_support_message_attachment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _caller uuid := auth.uid(); _object record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.user_id,NEW.sender_role,NEW.sender_id,NEW.body,NEW.created_at,NEW.attachment_path,NEW.attachment_name,NEW.attachment_type,NEW.attachment_size)
       IS DISTINCT FROM ROW(OLD.user_id,OLD.sender_role,OLD.sender_id,OLD.body,OLD.created_at,OLD.attachment_path,OLD.attachment_name,OLD.attachment_type,OLD.attachment_size) THEN
      RAISE EXCEPTION 'Sent support messages cannot be changed';
    END IF;
    IF _caller IS NOT NULL AND NOT public.has_role(_caller,'admin') AND NEW.read_by_admin IS DISTINCT FROM OLD.read_by_admin THEN
      RAISE EXCEPTION 'Only support admins can mark messages read by admin';
    END IF;
    RETURN NEW;
  END IF;
  IF _caller IS NULL THEN RETURN NEW; END IF;
  IF NEW.sender_id IS DISTINCT FROM _caller OR
     NOT ((NEW.sender_role='user' AND NEW.user_id=_caller) OR (NEW.sender_role='admin' AND public.has_role(_caller,'admin'))) THEN
    RAISE EXCEPTION 'You cannot send as another support participant';
  END IF;
  IF NEW.attachment_path IS NOT NULL THEN
    IF split_part(NEW.attachment_path,'/',1) <> NEW.user_id::text OR split_part(NEW.attachment_path,'/',2) <> _caller::text OR array_length(string_to_array(NEW.attachment_path,'/'),1) <> 3 THEN
      RAISE EXCEPTION 'Attachment must belong to this conversation and sender';
    END IF;
    SELECT metadata INTO _object FROM storage.objects WHERE bucket_id='support-attachments' AND name=NEW.attachment_path;
    IF NOT FOUND THEN RAISE EXCEPTION 'Upload the attachment before sending'; END IF;
    IF (_object.metadata->>'size')::bigint IS DISTINCT FROM NEW.attachment_size OR (_object.metadata->>'mimetype') IS DISTINCT FROM NEW.attachment_type THEN
      RAISE EXCEPTION 'Attachment details do not match the uploaded file';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_support_message_attachment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_support_message_attachment BEFORE INSERT OR UPDATE ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.guard_support_message_attachment();

CREATE POLICY "Support participants read private attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='support-attachments' AND (split_part(name,'/',1)=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Support participants upload private attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='support-attachments'
  AND (split_part(name,'/',1)=auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  AND split_part(name,'/',2)=auth.uid()::text
  AND array_length(string_to_array(name,'/'),1)=3
  AND NOT public.is_suspended(auth.uid())
  AND public.support_attachment_allowed(split_part(name,'/',3),metadata->>'mimetype',(metadata->>'size')::bigint));
CREATE POLICY "Support senders remove unsent attachments" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='support-attachments' AND split_part(name,'/',2)=auth.uid()::text
  AND (split_part(name,'/',1)=auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  AND NOT EXISTS(SELECT 1 FROM public.support_messages m WHERE m.attachment_path=name));
COMMENT ON COLUMN public.support_messages.attachment_path IS 'Private support-attachments object path: conversation user / sender / unique file; never store signed URLs.';