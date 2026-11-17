import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 = '00000000-0000-4000-8000-000000000001'::uuid AND $2 = 'admin' $$;`);
  await db.exec(readFileSync("drizzle/migrations/0009_support_contact_settings.sql", "utf8"));
  await db.exec("INSERT INTO public.support_contact_settings DEFAULT VALUES;");
});
afterAll(() => db.close());
it("allows public contact reads", async () => {
  await db.exec("SET ROLE anon");
  const result = await db.query("SELECT email,phone FROM public.support_contact_settings");
  expect(result.rows).toEqual([{ email: "info@ziidi.io", phone: "0722000000" }]);
  await db.exec("RESET ROLE");
});
it("blocks non-admin contact changes", async () => {
  await db.exec("SELECT set_config('test.user','00000000-0000-4000-8000-000000000002',false); SET ROLE authenticated");
  const result = await db.query("UPDATE public.support_contact_settings SET phone='0711111111' RETURNING phone");
  expect(result.rows).toEqual([]);
  await db.exec("RESET ROLE");
});
it("lets admins save contacts and rejects invalid email", async () => {
  await db.exec("SELECT set_config('test.user','00000000-0000-4000-8000-000000000001',false); SET ROLE authenticated");
  const result = await db.query("UPDATE public.support_contact_settings SET email='support@example.org', phone='+254 722 000 000' RETURNING email,phone");
  expect(result.rows).toEqual([{ email: "support@example.org", phone: "+254 722 000 000" }]);
  await expect(db.exec("UPDATE public.support_contact_settings SET email='not-an-email'")).rejects.toThrow();
  await db.exec("RESET ROLE");
});