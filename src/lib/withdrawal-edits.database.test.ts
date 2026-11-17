import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const id = "00000000-0000-4000-8000-000000000004";

async function withdrawal() {
  return (
    await db.query<{
      amount: string;
      method: string;
      destination: string;
      status: string;
      updated_at: string;
      rejection_reason: string | null;
      reviewed_by: string | null;
      tax_enabled_at_request: boolean;
      tax_percent_at_request: string;
    }>("SELECT * FROM public.withdrawals WHERE id=$1", [id])
  ).rows[0];
}
async function balance() {
  return Number(
    (await db.query<{ balance: string }>("SELECT balance FROM public.profiles WHERE id=$1", [user]))
      .rows[0]?.balance,
  );
}
async function edit(
  amount = 150000,
  overrides: {
    method?: string;
    destination?: string;
    code?: string;
    note?: string;
    payout?: string;
    version?: string;
  } = {},
) {
  const current = await withdrawal();
  return db.query("SELECT public.admin_update_withdrawal($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)", [
    id,
    amount,
    overrides.method ?? "mpesa",
    overrides.destination ?? "0712345678",
    overrides.code ?? "",
    overrides.note ?? "Reviewed",
    overrides.payout ?? "",
    overrides.version ?? current?.updated_at,
  ]);
}

describe("safe admin withdrawal editing", () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE TYPE public.app_role AS ENUM ('admin','user');
      CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
      CREATE FUNCTION public.has_role(id uuid,role public.app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND user_roles.role=$2) $$;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,balance numeric NOT NULL);
      CREATE TABLE public.withdrawals(id uuid PRIMARY KEY,user_id uuid NOT NULL,amount numeric NOT NULL,method text NOT NULL,destination text NOT NULL,status text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now(),tax_paid_at timestamptz,tax_tx_code text);
      GRANT SELECT,UPDATE ON public.withdrawals TO authenticated;
      ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own_read ON public.withdrawals FOR SELECT TO authenticated USING(user_id=auth.uid());
      CREATE POLICY admin_read ON public.withdrawals FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
      CREATE TABLE public.withdrawal_tax_settings(id uuid,min_withdrawal numeric,max_withdrawal numeric,tax_enabled boolean,tax_percent numeric,updated_at timestamptz);
      CREATE TABLE public.notifications(user_id uuid,kind text,title text,body text);
      CREATE TABLE public.user_trading_limits(user_id uuid,used_amount numeric,warning_sent boolean,cycle_started_at timestamptz,updated_at timestamptz);
    `);
    const limits = readFileSync(
      "drizzle/migrations/0001_per_user_share_trading_limits.sql",
      "utf8",
    );
    await db.exec(
      limits.slice(
        limits.indexOf("CREATE FUNCTION public.reset_trading_after_approved_withdrawal()"),
        limits.indexOf("CREATE OR REPLACE FUNCTION public.sell_from_holdings"),
      ),
    );
    await db.exec(
      readFileSync("drizzle/migrations/0004_withdrawal_details_and_safe_admin_edits.sql", "utf8"),
    );
    await db.exec("GRANT INSERT,UPDATE,DELETE ON public.withdrawal_edits TO authenticated");
    await db.exec(
      readFileSync("drizzle/migrations/0005_protect_withdrawal_change_log_writes.sql", "utf8"),
    );
  });
  beforeEach(async () => {
    await db.exec(
      "RESET ROLE; TRUNCATE public.withdrawal_edits,public.withdrawals,public.profiles,public.user_roles,public.withdrawal_tax_settings,public.notifications,public.user_trading_limits",
    );
    await db.query("SELECT set_config('test.user',$1,false)", [admin]);
    await db.query("INSERT INTO public.user_roles VALUES($1,'admin')", [admin]);
    await db.query("INSERT INTO public.profiles VALUES($1,200000),($2,0),($3,0)", [
      user,
      admin,
      other,
    ]);
    await db.query(
      "INSERT INTO public.withdrawal_tax_settings VALUES($1,100000,2000000,true,10.01,now())",
      [id],
    );
    await db.query(
      "INSERT INTO public.withdrawals(id,user_id,amount,method,destination) VALUES($1,$2,100000,'mpesa','0712345678')",
      [id, user],
    );
    await db.query(
      "INSERT INTO public.user_trading_limits(user_id,used_amount,warning_sent) VALUES($1,1800000,true)",
      [user],
    );
  });
  afterAll(async () => {
    await db.close();
  });

  it("only admins can edit a withdrawal", async () => {
    await db.query("SELECT set_config('test.user',$1,false)", [user]);
    await expect(edit()).rejects.toThrow("Admins only");
    expect(Number((await withdrawal())?.amount)).toBe(100000);
  });
  it("deducts only the increased amount from the user balance", async () => {
    await edit(150000, {
      method: "bank",
      destination: "Test Bank · A/C 123456789 · Test Holder · SWIFT TESTKEXX",
    });
    expect(await balance()).toBe(150000);
    expect((await withdrawal())?.method).toBe("bank");
    expect((await withdrawal())?.destination).toContain("123456789");
  });
  it("refunds only the reduction in a pending withdrawal", async () => {
    await edit(150000);
    await edit(100000);
    expect(await balance()).toBe(200000);
  });
  it("does not deduct any balance for a destination-only correction", async () => {
    await edit(100000, { destination: "0798765432" });
    expect(await balance()).toBe(200000);
    expect((await withdrawal())?.destination).toBe("0798765432");
  });
  it("rejects an increase exceeding the user's available balance", async () => {
    await expect(edit(400000)).rejects.toThrow("Insufficient user balance");
    expect(await balance()).toBe(200000);
    expect(Number((await withdrawal())?.amount)).toBe(100000);
  });
  it("keeps the existing KES 100,000 withdrawal minimum", async () => {
    await expect(edit(99999)).rejects.toThrow("below the minimum");
    expect(await balance()).toBe(200000);
  });
  it("rejects stale edits instead of overwriting a newer correction", async () => {
    const version = (await withdrawal())?.updated_at;
    await edit(150000);
    await expect(edit(200000, { version })).rejects.toThrow("Withdrawal changed");
    expect(await balance()).toBe(150000);
  });
  it("records the admin and before/after details of every edit", async () => {
    await edit(150000);
    const log = (
      await db.query<{
        edited_by: string;
        before_details: { amount: number };
        after_details: { amount: number };
      }>("SELECT * FROM public.withdrawal_edits WHERE withdrawal_id=$1", [id])
    ).rows[0];
    expect(log?.edited_by).toBe(admin);
    expect(log?.before_details.amount).toBe(100000);
    expect(log?.after_details.amount).toBe(150000);
  });
  it("keeps settled payment details locked but allows notes and payout reference", async () => {
    await db.query("SELECT public.admin_approve_withdrawal($1)", [id]);
    await expect(edit(100000, { destination: "0798765432" })).rejects.toThrow(
      "Settled payment details are locked",
    );
    await edit(100000, { note: "Paid", payout: "TESTPAYMENT001" });
    const result = (
      await db.query<{ payout_reference: string; admin_note: string }>(
        "SELECT payout_reference,admin_note FROM public.withdrawals WHERE id=$1",
        [id],
      )
    ).rows[0];
    expect(result?.payout_reference).toBe("TESTPAYMENT001");
    expect(result?.admin_note).toBe("Paid");
    expect(await balance()).toBe(200000);
  });
  it("refunds the corrected amount once on rejection and records the reason", async () => {
    await edit(150000);
    await db.query("SELECT public.admin_reject_withdrawal($1,'Wrong destination')", [id]);
    expect(await balance()).toBe(300000);
    expect((await withdrawal())?.rejection_reason).toBe("Wrong destination");
    expect((await withdrawal())?.reviewed_by).toBe(admin);
    await expect(
      db.query("SELECT public.admin_reject_withdrawal($1,'Wrong destination')", [id]),
    ).rejects.toThrow("Withdrawal not pending");
    expect(await balance()).toBe(300000);
  });
  it("edits and rejections do not reset trading totals", async () => {
    await edit(150000);
    await db.query("SELECT public.admin_reject_withdrawal($1,'Wrong destination')", [id]);
    expect(
      Number(
        (
          await db.query<{ used_amount: string }>(
            "SELECT used_amount FROM public.user_trading_limits WHERE user_id=$1",
            [user],
          )
        ).rows[0]?.used_amount,
      ),
    ).toBe(1800000);
  });
  it("captures the tax switch and rate at request, not today's settings", async () => {
    await db.exec("UPDATE public.withdrawal_tax_settings SET tax_enabled=false,tax_percent=15");
    expect((await withdrawal())?.tax_enabled_at_request).toBe(true);
    expect(Number((await withdrawal())?.tax_percent_at_request)).toBe(10.01);
  });
  it("owners can read their own summary but not another user's summary or the admin change log", async () => {
    await edit();
    await db.exec("SET ROLE authenticated");
    await db.query("SELECT set_config('test.user',$1,false)", [user]);
    expect(
      (await db.query("SELECT id FROM public.withdrawals WHERE id=$1", [id])).rows,
    ).toHaveLength(1);
    expect((await db.query("SELECT * FROM public.withdrawal_edits")).rows).toHaveLength(0);
    await db.query("SELECT set_config('test.user',$1,false)", [other]);
    expect(
      (await db.query("SELECT id FROM public.withdrawals WHERE id=$1", [id])).rows,
    ).toHaveLength(0);
    await db.query("SELECT set_config('test.user',$1,false)", [admin]);
    expect((await db.query("SELECT * FROM public.withdrawal_edits")).rows).toHaveLength(1);
  });
  it("blocks direct edits that bypass balance adjustments and blocks anonymous function execution", async () => {
    await db.exec("SET ROLE authenticated");
    await expect(
      db.query("UPDATE public.withdrawals SET amount=400000 WHERE id=$1", [id]),
    ).rejects.toThrow("permission denied");
    await db.exec("RESET ROLE");
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "SELECT has_function_privilege('anon','public.admin_update_withdrawal(uuid,numeric,text,text,text,text,text,timestamptz)','EXECUTE') AS allowed",
        )
      ).rows[0]?.allowed,
    ).toBe(false);
  });
  it("does not allow manual writes to the withdrawal change log", async () => {
    const result = await db.query<{
      insert_allowed: boolean;
      update_allowed: boolean;
      delete_allowed: boolean;
    }>(
      "SELECT has_table_privilege('authenticated','public.withdrawal_edits','INSERT') AS insert_allowed,has_table_privilege('authenticated','public.withdrawal_edits','UPDATE') AS update_allowed,has_table_privilege('authenticated','public.withdrawal_edits','DELETE') AS delete_allowed",
    );
    expect(result.rows[0]?.insert_allowed).toBe(false);
    expect(result.rows[0]?.update_allowed).toBe(false);
    expect(result.rows[0]?.delete_allowed).toBe(false);
  });
});
