import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 = '00000000-0000-4000-8000-000000000001'::uuid AND $2 = 'admin' $$;
    CREATE TABLE public.lock_settings (id uuid primary key, min_amount numeric, max_amount numeric, lock_period_hours integer, daily_rate numeric, updated_at timestamptz);
    INSERT INTO public.lock_settings VALUES ('00000000-0000-4000-8000-000000000003',100,10000000,24,0.07,now());`);
  await db.exec(readFileSync("drizzle/migrations/0010_repair_admin_lock_settings_save.sql", "utf8"));
});
afterAll(() => db.close());
it("allows an admin to save minimum and maximum while retaining period and rate", async () => {
  await db.exec("SELECT set_config('test.user','00000000-0000-4000-8000-000000000001',false); SET ROLE authenticated");
  const result = await db.query("SELECT min_amount::float8, max_amount::float8, lock_period_hours, daily_rate::float8 FROM public.admin_update_lock_settings(150,9000000,24,0.07)");
  expect(result.rows).toEqual([{ min_amount: 150, max_amount: 9000000, lock_period_hours: 24, daily_rate: 0.07 }]);
  await db.exec("RESET ROLE");
});
it("rejects non-admin changes", async () => {
  await db.exec("SELECT set_config('test.user','00000000-0000-4000-8000-000000000002',false); SET ROLE authenticated");
  await expect(db.exec("SELECT public.admin_update_lock_settings(100,10000000,24,0.07)")).rejects.toThrow("Admins only");
  await db.exec("RESET ROLE");
});
it("rejects reversed, zero, and non-finite amount limits", async () => {
  await db.exec("SELECT set_config('test.user','00000000-0000-4000-8000-000000000001',false); SET ROLE authenticated");
  for (const args of ["200,100", "0,100", "100,'NaN'", "NULL,100"])
    await expect(db.exec(`SELECT public.admin_update_lock_settings(${args},24,0.07)`)).rejects.toThrow("Invalid amounts");
  await db.exec("RESET ROLE");
});