import { createFileRoute, Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, LoaderCircle, Mail, LockKeyhole, UserRound, Phone } from "lucide-react";
import authPhoto from "@/assets/ziidi-home-lifestyle.jpg";

type Mode = "signin" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } =>
    s.mode === "signup" || s.mode === "signin" ? { mode: s.mode } : {},
  head: () => ({
    meta: [
      { title: "Sign in — ZIIDI Shari'ah" },
      { name: "description", content: "Sign in or create a ZIIDI Shari'ah account to buy, sell, and manage your NSE share investments." },
      { property: "og:title", content: "Sign in — ZIIDI Shari'ah" },
      { property: "og:description", content: "Access your ZIIDI Shari'ah account." },
      { property: "og:url", content: "/auth" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/auth" }],
  }),
  component: AuthPage,
});

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth-page grid min-h-svh bg-auth-paper font-body text-foreground lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="auth-visual relative hidden overflow-hidden bg-auth-deep lg:block">
        <img src={authPhoto} width={1920} height={1088} alt="A Kenyan investor using her phone on a Nairobi terrace" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        <div className="auth-photo-shade absolute inset-0" aria-hidden="true" />
        <Link to="/" aria-label="ZIIDI Shari'ah home" className="auth-visual-brand absolute bottom-12 left-10 right-10 font-heading text-primary-foreground xl:left-14">
          <span className="block text-6xl font-bold">ZIIDI</span>
          <span className="mt-2 block text-3xl font-semibold">Shari'ah</span>
          <span aria-hidden="true" className="mt-7 block h-1 w-16 bg-auth-lime" />
        </Link>
      </aside>
      <section className="auth-form-side flex min-w-0 flex-col px-6 sm:px-10 lg:px-12 xl:px-20">
        <header className="auth-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-7">
          <Link to="/" aria-label="ZIIDI Shari'ah home" className="inline-flex min-w-0 items-center gap-2 font-heading text-lg font-bold sm:text-xl">
            <span className="rounded-md bg-auth-green px-2 py-1 text-primary-foreground">ZIIDI</span><span className="text-auth-green">Shari'ah</span>
          </Link>
          <Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-auth-green">
            <Link to="/" aria-label="Back to home" title="Back to home"><ArrowLeft /></Link>
          </Button>
        </header>
        <div className="auth-form-content mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center py-12">
          <div aria-hidden="true" className="mb-6 h-1 w-10 bg-auth-green" />
          <h1 className="font-heading text-3xl font-semibold leading-tight">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  const Icon = props.type === "email" ? Mail : props.type === "tel" ? Phone : props.type === "password" ? LockKeyhole : UserRound;
  return (
    <label className="block min-w-0">
      <span className="text-xs font-semibold text-foreground">
        {label} {required && <span className="text-auth-green">*</span>}
      </span>
      <span className="relative mt-2 block">
        <Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input {...props} required={required} className="h-12 rounded-md border-border bg-auth-field pl-11 pr-4 text-base text-foreground shadow-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-auth-green focus-visible:bg-auth-paper focus-visible:ring-auth-green/20 md:text-sm" />
      </span>
    </label>
  );
}

function PrimaryButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="h-12 w-full rounded-md bg-auth-green text-sm font-semibold text-primary-foreground shadow-none hover:bg-auth-green-hover disabled:opacity-60"
    >
      {busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Please wait…</> : <>{children}<ArrowRight aria-hidden="true" /></>}
    </Button>
  );
}

function AuthPage() {
  const { mode: initialMode } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const navigate = useNavigate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // signin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  // signup
  const [name, setName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (remember) localStorage.setItem("ziidi:remember-email", email.trim());
      else localStorage.removeItem("ziidi:remember-email");
      toast.success("Welcome back");
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (uid) {
          const { notify } = await import("@/lib/notify");
          await notify(
            uid,
            "auth",
            "New sign-in to your account",
            `You signed in on ${new Date().toLocaleString()} from this device. If this wasn't you, reset your password immediately.`,
          );
        }
      } catch {}
      router.invalidate();
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (suPassword !== suConfirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: suEmail.trim(),
        password: suPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            username: name.trim() || suEmail.split("@")[0],
            full_name: name.trim(),
            phone: phone.trim(),
          },
        },
      });
      if (error) throw error;
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: suEmail.trim(),
          password: suPassword,
        });
        if (signInError) throw signInError;
      }
      toast.success("Account created");
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (uid) {
          const { notify } = await import("@/lib/notify");
          await notify(
            uid,
            "auth",
            "Welcome to Safaricom ZIIDI Shari'ah",
            `Your account (${suEmail.trim()}) has been created successfully. Complete verification to start trading.`,
          );
        }
      } catch {}
      router.invalidate();
      navigate({ to: "/verify" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("ziidi:remember-email");
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  if (mode === "signup") {
    return (
      <AuthShell title="Create an account" subtitle="Enter your details below to create your account">
        <form onSubmit={signUp} className="space-y-4">
          <Field label="Name" placeholder="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Field
            label="Email address"
            type="email"
            placeholder="email@example.com"
            required
            value={suEmail}
            onChange={(e) => setSuEmail(e.target.value)}
          />
          <Field
            label="Phone number"
            type="tel"
            placeholder="e.g. 254712345678"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={suPassword}
            onChange={(e) => setSuPassword(e.target.value)}
          />
          <Field
            label="Confirm password"
            type="password"
            placeholder="Confirm password"
            required
            minLength={6}
            value={suConfirm}
            onChange={(e) => setSuConfirm(e.target.value)}
          />
          <PrimaryButton busy={busy}>Create account</PrimaryButton>
        </form>
        <p className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Button
            type="button"
            variant="link"
            onClick={() => setMode("signin")}
            className="h-auto p-0 font-semibold text-auth-green"
          >
            Log in
          </Button>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Log in to your account" subtitle="Enter your email and password below to log in">
      <form onSubmit={signIn} className="space-y-4">
        <Field
          label="Email address"
          type="email"
          placeholder="email@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Field
            label="Password"
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            to="/forgot-password"
            className="mt-3 inline-block text-xs font-semibold text-auth-green hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="auth-remember h-4 w-4 shrink-0 cursor-pointer rounded border-border"
          />
          Remember me
        </label>
        <PrimaryButton busy={busy}>Log in</PrimaryButton>
      </form>
      <p className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Button
          type="button"
          variant="link"
          onClick={() => setMode("signup")}
          className="h-auto p-0 font-semibold text-auth-green"
        >
          Sign up
        </Button>
      </p>
    </AuthShell>
  );
}