import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sendSupportMessage,
  supportFileSize,
  supportFileType,
  SUPPORT_FILE_ACCEPT,
} from "@/lib/support-attachments";
import type { SupportMessage } from "@/lib/support-attachments";

export function SupportMessageComposer({
  threadId,
  senderId,
  role,
  onTyping,
  onSent,
  onSendingChange,
}: {
  threadId: string;
  senderId: string;
  role: "user" | "admin";
  onTyping: () => void;
  onSent: (message: SupportMessage) => void;
  onSendingChange?: (sending: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    try {
      supportFileType(selected);
      setFile(selected);
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Cannot attach this file.");
    }
  };

  const send = async () => {
    if ((!text.trim() && !file) || busyRef.current) return;
    busyRef.current = true;
    setSending(true);
    onSendingChange?.(true);
    setError("");
    try {
      const message = await sendSupportMessage({
        threadId,
        senderId,
        role,
        body: text,
        file,
        onUploading: setUploading,
      });
      setText("");
      setFile(null);
      onSent(message);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to send. Please try again.");
    } finally {
      busyRef.current = false;
      setSending(false);
      setUploading(false);
      onSendingChange?.(false);
    }
  };

  return (
    <form
      aria-label={role === "admin" ? "Support reply" : "Support message"}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className="shrink-0 space-y-2 border-t border-border bg-card p-3 text-card-foreground"
    >
      <input
        ref={fileInput}
        type="file"
        aria-label="Choose support attachment"
        accept={SUPPORT_FILE_ACCEPT}
        className="hidden"
        disabled={sending}
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {file && (
        <div
          className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted p-2"
          aria-label="Selected attachment"
        >
          {preview ? (
            <img
              src={preview}
              alt="Selected attachment preview"
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          ) : (
            <FileText className="h-8 w-8 shrink-0 text-primary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold" title={file.name}>
              {file.name}
            </p>
            <p className="text-[11px] text-muted-foreground">{supportFileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove attachment"
            title="Remove attachment"
            disabled={sending}
            onClick={() => setFile(null)}
            className="shrink-0"
          >
            <X />
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="break-words text-xs text-destructive">
          {error}
        </p>
      )}
      {uploading && (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
          Uploading attachment…
        </p>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={sending}
          aria-label="Attach file"
          title="Attach file · maximum 10 MB"
          onClick={() => fileInput.current?.click()}
          className="h-10 w-10 shrink-0 text-primary"
        >
          <Paperclip />
        </Button>
        <input
          aria-label={role === "admin" ? "Reply message" : "Message"}
          value={text}
          disabled={sending}
          onChange={(event) => {
            setText(event.target.value);
            onTyping();
          }}
          placeholder={
            role === "admin"
              ? "Type your reply as ZIIDI Shari'ah Customer Care…"
              : "Type your message…"
          }
          className="min-w-0 flex-1 rounded-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon"
          disabled={(!text.trim() && !file) || sending}
          aria-label="Send"
          title={sending ? "Sending…" : "Send"}
          className="h-10 w-10 shrink-0 rounded-full"
        >
          {sending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Send />}
        </Button>
      </div>
    </form>
  );
}
