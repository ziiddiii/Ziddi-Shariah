import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { adminAccountInput } from "./admin-account-input";
import { requireAccountAdmin, saveAdminAccount } from "./admin-account.server";

const input = { userId: "cd56fc04-08d1-4d34-9fd9-e01d882ed5a3", name: "Updated Name", username: "updated-user", email: "updated@example.test", phone: "0790001112", password: "new-password" };
function mockClient() {
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const profileUpdate = vi.fn().mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: input.userId }, error: null }) }) }) });
  const client = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }), auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "old@example.test", email_confirmed_at: "2026-11-16", user_metadata: { country: "Kenya" } } }, error: null }), updateUserById } }, from: vi.fn().mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: input.userId }, error: null }) }) }), update: profileUpdate }) };
  return { client: client as unknown as SupabaseClient<Database>, rpc: client.rpc, updateUserById, profileUpdate };
}
describe("admin account edits", () => {
  it("rejects non-admin callers and role lookup errors", async () => {
    const { client, rpc } = mockClient();
    await expect(requireAccountAdmin(client, input.userId)).rejects.toThrow("Admins only");
    rpc.mockResolvedValue({ data: true, error: { message: "denied" } });
    await expect(requireAccountAdmin(client, input.userId)).rejects.toThrow("Admins only");
  });
  it("allows verified admins", async () => {
    const { client, rpc } = mockClient(); rpc.mockResolvedValue({ data: true, error: null });
    await expect(requireAccountAdmin(client, input.userId)).resolves.toBeUndefined();
  });
  it("updates each requested field without modifying balance, roles or account ID", async () => {
    const { client, updateUserById, profileUpdate } = mockClient();
    expect(await saveAdminAccount(client, input)).toEqual({ ok: true, passwordError: null });
    expect(updateUserById.mock.calls[0]?.[1]).toEqual({ email: input.email, email_confirm: true, user_metadata: { country: "Kenya", full_name: input.name, name: input.name, username: input.username, phone: input.phone } });
    expect(profileUpdate).toHaveBeenCalledWith({ username: input.username, phone: input.phone });
    expect(updateUserById.mock.calls[1]?.[1]).toEqual({ password: input.password });
  });
  it("leaves password unchanged when blank", async () => {
    const { client, updateUserById } = mockClient(); await saveAdminAccount(client, { ...input, password: "" });
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });
  it("does not change profiles or passwords when email update fails", async () => {
    const { client, updateUserById, profileUpdate } = mockClient(); updateUserById.mockResolvedValue({ error: { message: "Email already registered" } });
    expect(await saveAdminAccount(client, input)).toEqual({ ok: false, error: "Email already registered" });
    expect(profileUpdate).not.toHaveBeenCalled(); expect(updateUserById).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed email and short nonempty passwords", () => {
    expect(adminAccountInput.safeParse({ ...input, email: "not-email" }).success).toBe(false);
    expect(adminAccountInput.safeParse({ ...input, password: "12345" }).success).toBe(false);
    expect(adminAccountInput.safeParse({ ...input, password: "" }).success).toBe(true);
  });
});