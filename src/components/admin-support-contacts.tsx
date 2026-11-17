import { useEffect, useState } from "react";
import { Headphones, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export function AdminSupportContacts() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void supabase.from("support_contact_settings").select("email,phone").eq("id", true).maybeSingle().then(({ data, error }) => {
      if (error) setError(error.message);
      if (data) { setEmail(data.email); setPhone(data.phone); }
      setLoading(false);
    });
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { data, error } = await supabase.from("support_contact_settings").upsert({ id: true, email: email.trim(), phone: phone.trim(), updated_at: new Date().toISOString() }).select("email,phone").single();
    setBusy(false);
    if (error) { setError(error.message); return; }
    setEmail(data.email); setPhone(data.phone);
    toast.success("Support contacts saved");
  }
  return <section className="text-foreground">
    <div className="mb-6 flex items-center gap-3"><Headphones className="h-6 w-6 text-primary" /><h1 className="text-xl font-semibold">Support Contacts</h1></div>
    {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <form onSubmit={save} className="grid max-w-xl gap-5">
      <label className="grid gap-2 text-sm font-medium" htmlFor="support-email">Support email<Input id="support-email" type="email" required maxLength={254} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="grid gap-2 text-sm font-medium" htmlFor="support-phone">Support phone<Input id="support-phone" type="tel" required minLength={7} maxLength={30} pattern="[+]?[0-9 ()\-]+" disabled={busy} value={phone} onChange={e => setPhone(e.target.value)} /></label>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="justify-self-start"><Save className="mr-2 h-4 w-4" />{busy ? "Saving…" : "Save contacts"}</Button>
    </form>}
  </section>;
}