import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";

async function balance() {
  const result = await db.query<{ balance: string }>("SELECT balance FROM public.profiles WHERE id=$1", [user]);
  return Number(result.rows[0]?.balance);
}
async function investment(mature = true) {
  await db.query(`INSERT INTO public.investments(id,user_id,amount,expected_return,plan_name,status,matures_at)
    VALUES($1,$2,75000,165000,'Test plan','active',now()+$3::interval)`, [id, user, mature ? "-1 second" : "1 hour"]);
}

describe("investment completion and one-time claims", () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.user', true)::uuid $$;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,balance numeric,suspended boolean DEFAULT false);
      CREATE FUNCTION public.is_suspended(id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT suspended FROM public.profiles WHERE profiles.id=$1 $$;
      CREATE TABLE public.investments(id uuid PRIMARY KEY,user_id uuid,amount numeric,expected_return numeric,plan_name text,status text,matures_at timestamptz);
      CREATE TABLE public.notifications(user_id uuid,kind text,title text,body text);
    `);
    await db.exec(readFileSync("drizzle/migrations/0003_investment_maturity_and_claims.sql", "utf8"));
  });
  beforeEach(async () => {
    await db.exec("TRUNCATE public.profiles,public.investments,public.notifications");
    await db.query("INSERT INTO public.profiles(id,balance) VALUES($1,25000),($2,0)", [user, other]);
    await db.query("SELECT set_config('test.user',$1,false)", [user]);
  });
  afterAll(async () => { await db.close(); });

  it("marks due investments complete once without automatically crediting the balance", async () => {
    await investment();
    const first = await db.query<{ count: number }>("SELECT public.complete_due_investments() AS count");
    const second = await db.query<{ count: number }>("SELECT public.complete_due_investments() AS count");
    expect(first.rows[0]?.count).toBe(1);
    expect(second.rows[0]?.count).toBe(0);
    expect(await balance()).toBe(25000);
    const notices = await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM public.notifications");
    expect(notices.rows[0]?.count).toBe(1);
  });
  it("rejects claims before the investment completion time", async () => {
    await investment(false);
    await expect(db.query("SELECT public.claim_investment_return($1)", [id])).rejects.toThrow("has not completed");
    expect(await balance()).toBe(25000);
  });
  it("credits the invested KES 75,000 plus KES 90,000 ROI", async () => {
    await investment();
    await db.query("SELECT public.claim_investment_return($1)", [id]);
    expect(await balance()).toBe(190000);
    const result = await db.query<{ status: string; claimed_amount: string }>("SELECT status,claimed_amount FROM public.investments WHERE id=$1", [id]);
    expect(result.rows[0]?.status).toBe("claimed");
    expect(Number(result.rows[0]?.claimed_amount)).toBe(165000);
  });
  it("never credits the same return twice", async () => {
    await investment();
    await db.query("SELECT public.claim_investment_return($1)", [id]);
    await db.query("SELECT public.claim_investment_return($1)", [id]);
    expect(await balance()).toBe(190000);
    const result = await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM public.notifications");
    expect(result.rows[0]?.count).toBe(1);
  });
  it("blocks another user from claiming the investment", async () => {
    await investment();
    await db.query("SELECT set_config('test.user',$1,false)", [other]);
    await expect(db.query("SELECT public.claim_investment_return($1)", [id])).rejects.toThrow("Investment not found");
    expect(await balance()).toBe(25000);
  });
  it("blocks a suspended account from claiming", async () => {
    await investment();
    await db.query("UPDATE public.profiles SET suspended=true WHERE id=$1", [user]);
    await expect(db.query("SELECT public.claim_investment_return($1)", [id])).rejects.toThrow("Account suspended");
    expect(await balance()).toBe(25000);
  });
});