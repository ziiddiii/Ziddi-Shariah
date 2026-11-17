import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const path = `${user}/${user}/proof.png`;
const adminPath = `${user}/${admin}/reply.pdf`;
const metadata = JSON.stringify({ size: 100, mimetype: "image/png" });

async function asUser(id = user) {
  await db.query("SELECT set_config('test.user',$1,false)", [id]);
  await db.exec("SET ROLE authenticated");
}
async function upload(name = path, details = metadata) {
  return db.query(
    "INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('support-attachments',$1,$2)",
    [name, details],
  );
}
async function send(
  sender = user,
  attachment = path,
  role = "user",
  name = "proof.png",
  mime = "image/png",
  size = 100,
) {
  return db.query(
    "INSERT INTO public.support_messages(user_id,sender_id,sender_role,body,attachment_path,attachment_name,attachment_type,attachment_size) VALUES($1,$2,$3,'',$4,$5,$6,$7)",
    [user, sender, role, attachment, name, mime, size],
  );
}

describe("private two-way support attachments", () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon,service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE TYPE public.app_role AS ENUM ('admin','user');
      CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
      CREATE FUNCTION public.has_role(id uuid,role public.app_role) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND user_roles.role=$2) $$;
      CREATE FUNCTION public.is_suspended(id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE TABLE public.support_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,sender_id uuid,sender_role text,body text,created_at timestamptz DEFAULT now(),read_by_admin boolean DEFAULT false,read_by_user boolean DEFAULT false);
      GRANT SELECT,INSERT,UPDATE ON public.support_messages TO authenticated;
      ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
      CREATE POLICY support_read ON public.support_messages FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
      CREATE POLICY support_insert ON public.support_messages FOR INSERT TO authenticated WITH CHECK((user_id=auth.uid() AND sender_role='user') OR (public.has_role(auth.uid(),'admin') AND sender_role='admin'));
      CREATE POLICY support_update ON public.support_messages FOR UPDATE TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated,anon;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    `);
    await db.exec(
      readFileSync("drizzle/migrations/0006_private_support_chat_attachments.sql", "utf8"),
    );
    await db.exec(
      readFileSync("drizzle/migrations/0007_support_upload_storage_preflight.sql", "utf8"),
    );
    await db.exec(
      readFileSync(
        "drizzle/migrations/0008_support_upload_incomplete_preflight_metadata.sql",
        "utf8",
      ),
    );
  });
  beforeEach(async () => {
    await db.exec("RESET ROLE; TRUNCATE storage.objects,public.support_messages,public.user_roles");
    await db.query("INSERT INTO public.user_roles VALUES($1,'admin')", [admin]);
    await asUser();
  });
  afterAll(async () => {
    await db.close();
  });

  it("lets users upload and send files without a text message", async () => {
    await upload();
    await send();
    const result = await db.query<{ attachment_name: string }>(
      "SELECT attachment_name FROM public.support_messages",
    );
    expect(result.rows[0]?.attachment_name).toBe("proof.png");
  });
  it("allows storage's incomplete metadata permission precheck", async () => {
    await upload(path, "{}");
    expect((await db.query("SELECT * FROM storage.objects")).rows).toHaveLength(1);
    await expect(send()).rejects.toThrow("Attachment details do not match");
  });
  it("lets admins attach replies to the same user conversation", async () => {
    await asUser(admin);
    await upload(adminPath, JSON.stringify({ size: 100, mimetype: "application/pdf" }));
    await send(admin, adminPath, "admin", "reply.pdf", "application/pdf");
    await asUser();
    const result = await db.query<{ attachment_path: string }>(
      "SELECT attachment_path FROM public.support_messages",
    );
    expect(result.rows[0]?.attachment_path).toBe(adminPath);
  });
  it("only the conversation user and support admins can read files", async () => {
    await upload();
    await asUser(other);
    expect((await db.query("SELECT * FROM storage.objects")).rows).toHaveLength(0);
    await asUser(admin);
    expect((await db.query("SELECT * FROM storage.objects")).rows).toHaveLength(1);
    await db.exec("RESET ROLE; SET ROLE anon");
    expect((await db.query("SELECT * FROM storage.objects")).rows).toHaveLength(0);
  });
  it("blocks another user from uploading into this conversation", async () => {
    await asUser(other);
    await expect(upload(`${user}/${other}/proof.png`)).rejects.toThrow();
    await asUser(admin);
    await expect(upload(path)).rejects.toThrow();
  });
  it("enforces the 10 MB limit and rejects active file types in storage", async () => {
    await expect(
      upload(path, JSON.stringify({ size: 10485761, mimetype: "image/png" })),
    ).rejects.toThrow();
    await expect(
      upload(`${user}/${user}/page.svg`, JSON.stringify({ size: 100, mimetype: "image/svg+xml" })),
    ).rejects.toThrow();
  });
  it("rejects missing uploads and mismatched file metadata", async () => {
    await expect(send()).rejects.toThrow("Upload the attachment before sending");
    await upload();
    await expect(send(user, path, "user", "proof.png", "image/png", 200)).rejects.toThrow(
      "Attachment details do not match",
    );
  });
  it("blocks sender spoofing and borrowing another sender's file", async () => {
    await upload();
    await expect(send(admin)).rejects.toThrow("another support participant");
    await asUser(admin);
    await expect(send(admin, path, "admin")).rejects.toThrow("conversation and sender");
  });
  it("keeps sent attachments immutable but permits read receipts", async () => {
    await upload();
    await send();
    await expect(
      db.exec("UPDATE public.support_messages SET attachment_name='changed.png'"),
    ).rejects.toThrow("cannot be changed");
    await expect(db.exec("UPDATE public.support_messages SET read_by_admin=true")).rejects.toThrow(
      "Only support admins",
    );
    await asUser(admin);
    await db.exec("UPDATE public.support_messages SET read_by_admin=true");
    expect(
      (
        await db.query<{ read_by_admin: boolean }>(
          "SELECT read_by_admin FROM public.support_messages",
        )
      ).rows[0]?.read_by_admin,
    ).toBe(true);
  });
  it("allows cleanup of unsent files but protects files attached to sent messages", async () => {
    await upload();
    await db.exec("DELETE FROM storage.objects");
    expect((await db.query("SELECT * FROM storage.objects")).rows).toHaveLength(0);
    await upload();
    await send();
    await db.exec("DELETE FROM storage.objects");
    expect((await db.query("SELECT * FROM storage.objects")).rows).toHaveLength(1);
  });
});
