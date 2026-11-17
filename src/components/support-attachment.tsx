import { useEffect, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SUPPORT_ATTACHMENT_BUCKET, supportFileSize } from "@/lib/support-attachments";
import type { SupportMessage } from "@/lib/support-attachments";

export function SupportAttachment({ message }: { message: SupportMessage }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const isImage = message.attachment_type?.startsWith("image/") ?? false;

  useEffect(() => {
    const path = message.attachment_path;
    if (!path || !isImage) return;
    let cancelled = false;
    const load = async () => {
      const { data, error: problem } = await supabase.storage
        .from(SUPPORT_ATTACHMENT_BUCKET)
        .createSignedUrl(path, 600);
      if (cancelled) return;
      if (problem) {
        setError("Attachment unavailable. Please try again.");
        return;
      }
      setImageUrl(data.signedUrl);
      setError("");
    };
    void load();
    const refresh = setInterval(
      () => {
        void load();
      },
      8 * 60 * 1000,
    );
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, [message.attachment_path, isImage, attempt]);

  if (!message.attachment_path || !message.attachment_name) return null;

  const download = async () => {
    const path = message.attachment_path;
    if (!path || loading) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: problem } = await supabase.storage
        .from(SUPPORT_ATTACHMENT_BUCKET)
        .download(path);
      if (problem || !data) throw new Error("Attachment unavailable. Please try again.");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = message.attachment_name ?? "attachment";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setError("Attachment unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-1 min-w-0 space-y-2 rounded-md border border-border bg-card p-2 text-card-foreground">
      {isImage && imageUrl && (
        <Button
          variant="ghost"
          type="button"
          className="block h-auto w-full overflow-hidden rounded p-0 hover:bg-transparent"
          title="View image"
          aria-label={`View ${message.attachment_name}`}
          onClick={() => setOpen(true)}
        >
          <img
            src={imageUrl}
            alt={message.attachment_name}
            onError={() => {
              setImageUrl(null);
              setError("Attachment unavailable. Please try again.");
            }}
            className="max-h-48 w-full object-contain"
          />
        </Button>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="break-all text-xs font-semibold">{message.attachment_name}</p>
          <p className="text-[10px] text-muted-foreground">
            {supportFileSize(message.attachment_size ?? 0)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={loading}
          title="Download attachment"
          aria-label={`Download ${message.attachment_name}`}
          onClick={() => {
            void download();
          }}
          className="shrink-0"
        >
          {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Download />}
        </Button>
      </div>
      {error && (
        <div className="flex items-center gap-1">
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
          {isImage && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Retry image"
              aria-label="Retry image"
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              <RefreshCw />
            </Button>
          )}
        </div>
      )}
      {isImage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="z-[60] max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
            <DialogTitle className="break-all pr-5 text-sm">{message.attachment_name}</DialogTitle>
            <DialogDescription>{supportFileSize(message.attachment_size ?? 0)}</DialogDescription>
            {imageUrl && (
              <img
                src={imageUrl}
                alt={message.attachment_name}
                className="max-h-[65dvh] w-full object-contain"
              />
            )}
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                void download();
              }}
            >
              <Download />
              Download
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
