import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000002";
const migration = readFileSync("drizzle/migrations/0001_per_user_share_trading_limits.sql", "utf8");

async function setUsage(used: number, warning = false) {
  await db.query("UPDATE public.user_trading_limits SET max_amount=2000000,used_amount=$1,warning_sent=$2 WHERE user_id=$3", [used, warning, user]);
}
async function usage() {
  const result = await db.query<{ used_amount: string }>("SELECT used_amount FROM public.user_trading_limits WHERE user_id=$1", [user]);
  return Number(result.rows[0]?.used_amount);
}

describe("authoritative share trading limits", () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${admin}'::uuid $$;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY);
      INSERT INTO public.profiles VALUES ('${user}'),('${admin}');
      CREATE FUNCTION public.has_role(id uuid,role text) RETURNS boolean LANGUAGE sql AS $$ SELECT id='${admin}'::uuid AND role='admin' $$;
      CREATE TABLE public.notifications(user_id uuid,kind text,title text,body text);
      CREATE TABLE public.listings(id uuid,status text,buyer_id uuid,seller_id uuid,ticker text,quantity integer,price_per_share numeric);
      CREATE TABLE public.withdrawals(id uuid,user_id uuid,status text);
      CREATE TABLE public.holdings(id uuid,user_id uuid,ticker text,quantity integer,avg_price numeric,updated_at timestamptz);
    `);
    // Use the shipped schema and rule functions; UI-independent core enforcement.
    await db.exec(migration.slice(0, migration.indexOf("CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal")));
    await db.query("SELECT public.admin_set_user_trading_limit($1,2000000)", [user]);
  });
  afterAll(async () => { await db.close(); });

  it("allows completed buys exactly at KES 2 million", async () => {
    await setUsage(1000000);
    await db.query("INSERT INTO public.listings(status,buyer_id,seller_id,ticker,quantity,price_per_share) VALUES('sold',$1,$2,'BTC',1000,1000)", [user, admin]);
    expect(await usage()).toBe(2000000);
  });
  it("blocks and rolls back a purchase above KES 2 million", async () => {
    await setUsage(1999999);
    await expect(db.query("INSERT INTO public.listings(status,buyer_id,seller_id,ticker,quantity,price_per_share) VALUES('sold',$1,$2,'BTC',1,2)", [user, admin])).rejects.toThrow();
    expect(await usage()).toBe(1999999);
  });
  it("blocks a sale above the same combined maximum", async () => {
    await setUsage(1000000);
    await expect(db.query("SELECT public.record_share_trade($1,1000000.01)", [user])).rejects.toThrow();
    expect(await usage()).toBe(1000000);
  });
  it("saves one warning at 90% without repeating it on later trades", async () => {
    await db.exec("DELETE FROM public.notifications");
    await setUsage(1799999);
    await db.query("SELECT public.record_share_trade($1,1)", [user]);
    await db.query("SELECT public.record_share_trade($1,1)", [user]);
    const result = await db.query<{ count: number }>("SELECT count(*)::integer AS count FROM public.notifications WHERE kind='trading_limit'");
    expect(result.rows[0]?.count).toBe(1);
  });
  it("does not reset usage when a withdrawal is submitted or rejected", async () => {
    await setUsage(1900000, true);
    await db.query("INSERT INTO public.withdrawals VALUES('00000000-0000-4000-8000-000000000010',$1,'pending')", [user]);
    expect(await usage()).toBe(1900000);
    await db.exec("UPDATE public.withdrawals SET status='rejected'");
    expect(await usage()).toBe(1900000);
  });
  it("resets usage and the warning only on approved withdrawal", async () => {
    await setUsage(1900000, true);
    await db.exec("UPDATE public.withdrawals SET status='pending'; UPDATE public.withdrawals SET status='completed'");
    expect(await usage()).toBe(0);
    const result = await db.query<{ warning_sent: boolean }>("SELECT warning_sent FROM public.user_trading_limits WHERE user_id=$1", [user]);
    expect(result.rows[0]?.warning_sent).toBe(false);
  });
  it("does not reset usage when an admin changes the maximum", async () => {
    await setUsage(1000000);
    await db.query("SELECT public.admin_set_user_trading_limit($1,3000000)", [user]);
    expect(await usage()).toBe(1000000);
  });
});