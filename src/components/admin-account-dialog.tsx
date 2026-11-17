import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { getAdminAccount, updateAdminAccount } from "@/lib/admin-account.functions";
import { adminAccountInput } from "@/lib/admin-account-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function AdminAccountDialog({ user, onClose, onSaved }: { user: { id: string; username: string }; onClose: () => void; onSaved: () => void }) {
  const loadAccount = useServerFn(getAdminAccount);
  const updateAccount = useServerFn(updateAdminAccount);
  const [fields, setFields] = useState({ name: "", username: "", email: "", phone: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    let active = true;
    loadAccount({ data: { userId: user.id } }).then((account) => {
      if (active) { setFields({ ...account, password: "" }); setLoading(false); }
    }).catch(() => { if (active) { setError("Unable to load this account. Close and try again."); setLoading(false); } });
    return () => { active = false; };
  }, [user.id, loadAccount]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = adminAccountInput.safeParse({ ...fields, userId: user.id });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check the account details"); return; }
    if (fields.password !== confirmPassword) { setError("Passwords do not match"); return; }
    setBusy(true); setError("");
    try {
      const result = await updateAccount({ data: parsed.data });
      if (!result.ok) { setError(result.error); return; }
      setFields((current) => ({ ...current, password: "" })); setConfirmPassword("");
      onSaved();
      if (result.passwordError) { setError(result.passwordError); return; }
      toast.success("Account details updated"); onClose();
    } catch { setError("Account could not be updated. Please try again."); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg sm:max-w-lg" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Edit user account</DialogTitle><DialogDescription className="break-words">{user.username}</DialogDescription></DialogHeader>
      {loading ? <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><LoaderCircle className="animate-spin" />Loading account…</div> : <form onSubmit={save} className="space-y-4" autoComplete="off">
        <fieldset disabled={busy || !fields.username} className="grid gap-4 sm:grid-cols-2">
          {([['name', 'Name', 'text'], ['username', 'Username', 'text'], ['email', 'Email address', 'email'], ['phone', 'Phone number', 'tel']] as const).map(([key, label, type]) => <label key={key} className="min-w-0 space-y-1.5 text-sm"><span>{label}</span><Input type={type} required={key !== 'phone'} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} /></label>)}
          <label className="min-w-0 space-y-1.5 text-sm"><span>New password (optional)</span><div className="relative"><Input type={showPassword ? "text" : "password"} autoComplete="new-password" value={fields.password} onChange={(event) => setFields({ ...fields, password: event.target.value })} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></label>
          <label className="min-w-0 space-y-1.5 text-sm"><span>Confirm new password</span><Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !fields.username}>{busy ? <LoaderCircle className="animate-spin" /> : <Save />}{busy ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}