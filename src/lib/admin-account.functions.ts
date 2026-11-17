import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminAccountInput } from "./admin-account-input";

export const getAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: adminAccountInput.shape.userId.parse(input.userId) }))
  .handler(async ({ data, context }) => {
    const { requireAccountAdmin } = await import("./admin-account.server");
    await requireAccountAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: account, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const { data: profile, error: profileError } = await context.supabase.from("profiles").select("username,phone").eq("id", data.userId).single();
    if (error || profileError || !account.user || !profile) throw new Error("Account could not be loaded");
    return { name: String(account.user.user_metadata?.full_name || account.user.user_metadata?.name || profile.username), username: profile.username, email: account.user.email || "", phone: profile.phone || "" };
  });

export const updateAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminAccountInput.parse(input))
  .handler(async ({ data, context }) => {
    const { requireAccountAdmin, saveAdminAccount } = await import("./admin-account.server");
    await requireAccountAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return saveAdminAccount(supabaseAdmin, data);
  });