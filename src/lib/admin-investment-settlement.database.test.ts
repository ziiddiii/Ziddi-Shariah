import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000002";
const investmentId = "00000000-0000-4000-8000-000000000003";
const as = (id: string) => db.query("SELECT set_config('test.user',$1,false)", [id]);
async function balance() {
  return Number((await db.query<{ balance: string }>("SELECT balance FROM public.profiles WHERE id=$1", [owner])).rows[0]?.balance);
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${admin}'::uuid AND $2='admin' $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,balance numeric,suspended boolean DEFAULT false);
    CREATE FUNCTION public.is_suspended(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT suspended FROM public.profiles WHERE id=$1 $$;
    CREATE TABLE public.investments(id uuid PRIMARY KEY,user_id uuid,amount numeric,expected_return numeric,plan_name text,status text,matures_at timestamptz);
    CREATE TABLE public.notifications(user_id uuid,kind text,title text,body text);`);
  await db.exec(readFileSync("drizzle/migrations/0003_investment_maturity_and_claims.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0012_admin_investment_settlement.sql", "utf8"));
});
beforeEach(async () => {
  await db.exec("TRUNCATE public.investments,public.profiles,public.notifications");
  await db.query("INSERT INTO public.profiles(id,balance) VALUES($1,25000),($2,0)", [owner, admin]);
  await db.query("INSERT INTO public.investments(id,user_id,amount,expected_return,plan_name,status,matures_at) VALUES($1,$2,75000,165000,'Premium','active',now()+interval '48 hours')", [investmentId, owner]);
  await as(admin);
});
afterAll(async () => { await db.close(); });
it("allows only admins to complete another user's investment", async () => {
  await as(owner);
  await expect(db.query("SELECT public.admin_settle_investment($1)", [investmentId])).rejects.toThrow("Admins only");
  await as("");
  await expect(db.query("SELECT public.admin_settle_investment($1)", [investmentId])).rejects.toThrow("Admins only");
  expect(await balance()).toBe(25000);
});
it("completes early and credits KES 75,000 principal plus KES 90,000 profit", async () => {
  await db.query("SELECT public.admin_settle_investment($1)", [investmentId]);
  expect(await balance()).toBe(190000);
  const result = await db.query<{ status: string; claimed_amount: string; settled_by: string }>("SELECT status,claimed_amount,settled_by FROM public.investments");
  expect(result.rows[0]).toEqual({ status: "claimed", claimed_amount: "165000.00", settled_by: admin });
});
it("does not credit twice on repeat admin settlement or a later owner claim", async () => {
  await db.query("SELECT public.admin_settle_investment($1)", [investmentId]);
  await db.query("SELECT public.admin_settle_investment($1)", [investmentId]);
  await as(owner);
  await db.query("SELECT public.claim_investment_return($1)", [investmentId]);
  expect(await balance()).toBe(190000);
  expect((await db.query("SELECT count(*)::integer AS count FROM public.notifications")).rows).toEqual([{ count: 1 }]);
});
it("does not credit again after the owner already claimed a matured investment", async () => {
  await db.exec("UPDATE public.investments SET matures_at=now()-interval '1 second'");
  await as(owner);
  await db.query("SELECT public.claim_investment_return($1)", [investmentId]);
  await as(admin);
  await db.query("SELECT public.admin_settle_investment($1)", [investmentId]);
  expect(await balance()).toBe(190000);
  expect((await db.query("SELECT settled_by FROM public.investments")).rows).toEqual([{ settled_by: null }]);
});
it("rejects invalid payout or unavailable investments without changing the balance", async () => {
  await db.exec("UPDATE public.investments SET expected_return=1000");
  await expect(db.query("SELECT public.admin_settle_investment($1)", [investmentId])).rejects.toThrow("Invalid investment return");
  await db.exec("UPDATE public.investments SET expected_return=165000,status='cancelled'");
  await expect(db.query("SELECT public.admin_settle_investment($1)", [investmentId])).rejects.toThrow("not available to settle");
  expect(await balance()).toBe(25000);
});