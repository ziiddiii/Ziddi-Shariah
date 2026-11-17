import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AdminAccountInput } from "./admin-account-input";

export async function requireAccountAdmin(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Admins only");
}

export async function saveAdminAccount(client: SupabaseClient<Database>, input: AdminAccountInput) {
  const { data: existing, error: readError } = await client.auth.admin.getUserById(input.userId);
  if (readError || !existing.user) return { ok: false as const, error: "Account not found" };
  const { data: profile, error: profileReadError } = await client.from("profiles").select("id").eq("id", input.userId).single();
  if (profileReadError || !profile) return { ok: false as const, error: "Account profile not found" };
  const previous = existing.user;
  const { error: authError } = await client.auth.admin.updateUserById(input.userId, {
    email: input.email,
    ...(previous.email_confirmed_at ? { email_confirm: true } : {}),
    user_metadata: { ...previous.user_metadata, full_name: input.name, name: input.name, username: input.username, phone: input.phone },
  });
  if (authError) return { ok: false as const, error: authError.message };
  const { error: profileError } = await client.from("profiles").update({ username: input.username, phone: input.phone || null }).eq("id", input.userId).select("id").single();
  if (profileError) {
    const { error: rollbackError } = await client.auth.admin.updateUserById(input.userId, { email: previous.email, user_metadata: previous.user_metadata });
    return { ok: false as const, error: rollbackError ? "Account details were partly saved. Reload the account before retrying." : "Account details could not be saved. Please try again." };
  }
  // Passwords are write-only and changed last; never return or store them in profile data.
  if (input.password) {
    const { error } = await client.auth.admin.updateUserById(input.userId, { password: input.password });
    if (error) return { ok: true as const, passwordError: "Details saved, but the password was not changed. Try a stronger new password." };
  }
  return { ok: true as const, passwordError: null };
}