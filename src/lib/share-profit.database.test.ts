import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${owner}'::uuid $$;
    CREATE FUNCTION public.is_suspended(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, balance numeric DEFAULT 0);
    CREATE TABLE public.holdings(id uuid DEFAULT gen_random_uuid(), user_id uuid, ticker text, quantity integer, avg_price numeric, updated_at timestamptz);
    CREATE TABLE public.notifications(user_id uuid, kind text, title text, body text);
    CREATE TABLE public.usage(amount numeric);
    CREATE FUNCTION public.record_share_trade(uuid,numeric) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF $2 > 2000000 THEN RAISE EXCEPTION 'Trading threshold'; END IF; INSERT INTO public.usage VALUES($2); END $$;
    INSERT INTO public.profiles(id) VALUES('${owner}');
  `);
  await db.exec(readFileSync("drizzle/migrations/0011_share_sale_profit_tiers.sql", "utf8"));
});
afterAll(async () => { await db.close(); });

async function sell(basis: number, quantity = 1) {
  await db.exec(`DELETE FROM public.holdings; UPDATE public.profiles SET balance=0; DELETE FROM public.usage;`);
  await db.query("INSERT INTO public.holdings(user_id,ticker,quantity,avg_price) VALUES($1,'TEST',$2,$3)", [owner, quantity, basis / quantity]);
  const result = await db.query<{ proceeds: string }>("SELECT public.sell_from_holdings('TEST',$1,999999999) AS proceeds", [quantity]);
  const balance = await db.query<{ balance: string }>("SELECT balance FROM public.profiles");
  expect(Number(balance.rows[0]?.balance)).toBe(Number(result.rows[0]?.proceeds));
  const usage = await db.query<{ amount: string }>("SELECT amount FROM public.usage");
  expect(Number(usage.rows[0]?.amount)).toBe(Number(result.rows[0]?.proceeds));
  return Number(result.rows[0]?.proceeds);
}
it("settles 28.95% at both 30,000 and 50,000 despite forged browser prices", async () => {
  expect(await sell(30000)).toBe(38685);
  expect(await sell(50000)).toBe(64475);
});
it("settles 43.74% at 50,001 and 100,000", async () => {
  expect(await sell(50001)).toBe(71871.44);
  expect(await sell(100000)).toBe(143740);
});
it("settles 53.92% at 100,001 and above with total-profit rounding", async () => {
  expect(await sell(100001)).toBe(153921.54);
  expect(await sell(200000, 7)).toBe(307840);
});
it("uses the sold quantity basis and keeps the remaining holding", async () => {
  await sell(29999);
  await db.query("INSERT INTO public.holdings(user_id,ticker,quantity,avg_price) VALUES($1,'PARTIAL',5,10000)", [owner]);
  const result = await db.query<{ proceeds: string }>("SELECT public.sell_from_holdings('PARTIAL',3,0) AS proceeds");
  expect(Number(result.rows[0]?.proceeds)).toBe(38685);
  const remaining = await db.query<{ quantity: number }>("SELECT quantity FROM public.holdings WHERE ticker='PARTIAL'");
  expect(remaining.rows[0]?.quantity).toBe(2);
});
it("rolls back holdings and balance when proceeds exceed the trading cap", async () => {
  await db.query("INSERT INTO public.holdings(user_id,ticker,quantity,avg_price) VALUES($1,'CAP',1,2000000)", [owner]);
  const before = await db.query("SELECT balance FROM public.profiles");
  await expect(db.query("SELECT public.sell_from_holdings('CAP',1,0)")).rejects.toThrow("Trading threshold");
  expect((await db.query("SELECT balance FROM public.profiles")).rows).toEqual(before.rows);
  expect((await db.query("SELECT quantity FROM public.holdings WHERE ticker='CAP'")).rows).toEqual([{ quantity: 1 }]);
});