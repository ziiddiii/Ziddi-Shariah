import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SupportMessage = Database["public"]["Tables"]["support_messages"]["Row"];
export const SUPPORT_ATTACHMENT_BUCKET = "support-attachments";
export const SUPPORT_FILE_MAX_BYTES = 10 * 1024 * 1024;

const FILE_TYPES: Record<string, string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};
export const SUPPORT_FILE_ACCEPT = Object.keys(FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export function supportFileType(file: Pick<File, "name" | "type" | "size">) {
  if (file.size <= 0) throw new Error("This file is empty. Choose another file.");
  if (file.size > SUPPORT_FILE_MAX_BYTES) throw new Error("Files must be 10 MB or smaller.");
  if (file.name.length > 255)
    throw new Error("The file name is too long. Rename the file and try again.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = FILE_TYPES[ext];
  if (!allowed) throw new Error("Choose an image, PDF, text file, or Office document.");
  const type = file.type || allowed[0];
  if (!type || !allowed.includes(type)) throw new Error("The file type does not match its name.");
  return type;
}

export function supportFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

export function supportAttachmentPath(threadId: string, senderId: string, name: string) {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
  return `${threadId}/${senderId}/${crypto.randomUUID()}-${safeName}`;
}

export async function sendSupportMessage({
  threadId,
  senderId,
  role,
  body,
  file,
  onUploading,
}: {
  threadId: string;
  senderId: string;
  role: "user" | "admin";
  body: string;
  file: File | null;
  onUploading: (uploading: boolean) => void;
}) {
  let path: string | null = null;
  let attachment:
    | Pick<
        SupportMessage,
        "attachment_path" | "attachment_name" | "attachment_size" | "attachment_type"
      >
    | undefined;
  try {
    if (file) {
      const type = supportFileType(file);
      path = supportAttachmentPath(threadId, senderId, file.name);
      onUploading(true);
      const { error } = await supabase.storage
        .from(SUPPORT_ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: type, upsert: false });
      if (error) {
        path = null;
        throw new Error(`Upload failed: ${error.message}`);
      }
      attachment = {
        attachment_path: path,
        attachment_name: file.name,
        attachment_size: file.size,
        attachment_type: type,
      };
      onUploading(false);
    }
    const { data, error } = await supabase
      .from("support_messages")
      .insert({
        user_id: threadId,
        sender_id: senderId,
        sender_role: role,
        body: body.trim(),
        read_by_admin: role === "admin",
        ...attachment,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Message not sent: ${error.message}`);
    return data;
  } catch (error) {
    // Keep the draft available to retry; remove any uploaded file not linked to a sent message.
    if (path)
      await supabase.storage
        .from(SUPPORT_ATTACHMENT_BUCKET)
        .remove([path])
        .catch(() => {});
    throw error;
  }
}
