import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSupportContacts() {
  const [contacts, setContacts] = useState<{ email: string; phone: string } | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("support_contact_settings").select("email,phone").eq("id", true).maybeSingle();
      if (active && data) setContacts(data);
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return contacts;
}