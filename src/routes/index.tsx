import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { InstallAppButton } from "@/components/install-app-button";
import { EntryBanner, useMinEntry } from "@/components/entry-banner";
import { Button } from "@/components/ui/button";
const communityVideoPoster = { url: "/community-video-poster.jpg" };
import { youtubeEmbed } from "@/lib/platform-content";
import { useSupportContacts } from "@/hooks/use-support-contacts";
import { Play, ArrowUpRight, Menu, X, Quote } from "lucide-react";
import {
  TrendingUp,
  ShieldCheck,
  LineChart,
  Wallet,
  ArrowRight,
  Check,
  Lock,
  Users,
  ChevronDown,
  Twitter,
  Facebook,
  Instagram,
  Mail,
  Phone,
} from "lucide-react";

const launchPhoto = { url: "/recovered/ziidi-shariah-launch.jpg" };
const investorPhoto = { url: "/recovered/ziidi-investor-tablet.jpg" };
const COMMUNITY_VIDEO_URL = "https://youtube.com/shorts/uEvFntL2yCk?feature=share";
const COMMUNITY_VIDEO_EMBED = youtubeEmbed(COMMUNITY_VIDEO_URL);
const LIVE_VIDEO_EMBED = youtubeEmbed("https://www.youtube.com/watch?v=vEPQH5nr20s");

function ZiidiLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex flex-col leading-none ${className}`}
      aria-label="ZIIDI Shari'ah — powered by M-PESA"
    >
      <span className="flex items-center gap-1.5">
        <span
          className="rounded-md bg-home-green px-2 py-1 text-lg font-bold tracking-normal text-home-paper sm:text-xl"
        >
          ZIIDI
        </span>
        <span
          className="text-lg font-bold tracking-normal text-home-green sm:text-xl"
        >
          Shari'ah
        </span>
      </span>
      <span
        className="mt-1 text-[9px] font-semibold uppercase tracking-normal text-home-green sm:text-[10px]"
      >
        powered by M‑PESA
      </span>
    </span>
  );
}

function LiveStreamSection() {
  const [playing, setPlaying] = useState(false);
  return (
    <section className="home-live mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="home-section-heading">
        <div
          className="inline-flex items-center gap-2 rounded-full bg-home-green px-3 py-1 text-xs font-semibold uppercase tracking-normal text-home-paper"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-home-paper" /> Live now
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-normal text-home-ink sm:text-4xl">
          ZIIDI Shari'ah MMF market briefing — live
        </h2>
        <p className="mt-3 text-home-muted">
          Tune in to today's live market update and hear directly from our analysts.
        </p>
      </div>
      <div className="home-video w-full overflow-hidden rounded-lg bg-home-ink">
        <div className="relative aspect-video w-full">
          {playing && LIVE_VIDEO_EMBED ? (
            <iframe
              src={`${LIVE_VIDEO_EMBED}&autoplay=1`}
              title="ZIIDI Shari'ah live stream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <Button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play ZIIDI Shari'ah live market briefing"
              className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 rounded-none bg-home-ink text-home-paper hover:bg-home-green-deep"
            >
              <span
                className="grid h-16 w-16 place-items-center rounded-full bg-home-green text-2xl"
              >
                <Play className="h-6 w-6 fill-current" />
              </span>
              <span className="text-sm font-semibold">Tap to play live briefing</span>
              <span className="text-[11px] text-home-muted">Loads only when you tap — saves data</span>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

const SITE_URL = "https://www.ziiditrader.capital";

export const Route = createFileRoute("/")({
  server: {
    handlers: {
      // Daraja is configured with the website URL itself as the callback.
      POST: async ({ request }) => {
        const { handleStkCallback } = await import("@/lib/mpesa-callback.server");
        return handleStkCallback(request);
      },
    },
  },
  head: () => ({
    meta: [
      { title: "ZIIDI Shari'ah — Enabling Investing for Everyone" },
      {
        name: "description",
        content:
          "Buy and sell shares on the Nairobi Securities Exchange, track your portfolio and grow your wealth — all from your ZIIDI Shari'ah wallet, powered by M-PESA.",
      },
      { property: "og:title", content: "ZIIDI Shari'ah — Enabling Investing for Everyone" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Hassle-free, seamless and secure share trading powered by M-PESA.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(structuredData),
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    tag: "Invest with ease",
    title: "Buy & sell NSE shares in a few taps",
    body:
      "Discover an effortless way to trade shares on the Nairobi Securities Exchange — connect directly with verified sellers and settle instantly from your phone.",
    bullets: ["Live market prices", "1‑on‑1 chat with sellers", "Instant M‑PESA settlement"],
    art: <ArtBuyPanel />,
  },
  {
    tag: "Customize your portfolio",
    title: "Diversify across the stocks that match your goals",
    body:
      "Approve trades on the move and stay in control of every position. Watch every share bought move straight to your portfolio, ready to be resold at the right moment.",
    bullets: ["Real‑time portfolio value", "Green‑market resell signals", "One tap to cash out"],
    art: <ArtPortfolio />,
  },
  {
    tag: "Bank‑grade security",
    title: "Enhanced security for your funds",
    body:
      "Every login, deposit and withdrawal is protected end‑to‑end. Admin‑approved settlements make sure shares only change hands after payment is confirmed.",
    bullets: ["End‑to‑end encryption", "Admin escrow release", "M‑PESA verified payouts"],
    art: <ArtSecurity />,
  },
  {
    tag: "Grow your wealth",
    title: "A single view of everything you own",
    body:
      "Monitor performance and compound returns over time. Live candle charts show when the market is low to buy and when it turns green to sell for profit.",
    bullets: ["Live candlestick charts", "Profit & loss tracking", "Wealth insights"],
    art: <ArtGrowth />,
  },
];

export const FAQS = [
  {
    q: "What is ZIIDI Shari'ah?",
    a: "ZIIDI Shari'ah is a platform, powered by Safaricom M‑PESA, that lets everyday investors buy and sell shares on the Nairobi Securities Exchange from a single, simple wallet.",
  },
  {
    q: "What are the benefits of ZIIDI Shari'ah?",
    a: "Simplified interface, easy and secure M‑PESA payments, customisable approval levels, and e‑value recycling between your investments and your wallet.",
  },
  {
    q: "Which services are available under ZIIDI Shari'ah?",
    a: "Share purchase, share resale, portfolio tracking, M‑PESA settlement, bank withdrawals and organisation auto‑settlements.",
  },
  {
    q: "How do I sign up?",
    a: "Tap Sign Up, verify your details, and you can start buying shares from listed sellers immediately — no deposit required to begin.",
  },
  {
    q: "Who do I contact for support?",
    a: "Email info@ziidi.io or call our support line on +254 714 011 507. On social you can reach us at @SafaricomPLC and @Safaricom_Care.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "ZIIDI Shari'ah",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.ico`,
      sameAs: [
        "https://twitter.com/SafaricomPLC",
        "https://facebook.com/Safaricom",
      ],
    },
    {
      "@type": "WebSite",
      name: "ZIIDI Shari'ah",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/community?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  ],
};

function Landing() {
  return (
    <div className="home-page min-h-screen bg-home-paper text-home-ink font-body">
      <TopNav />
      <Hero />
      <TrustBar />
      <div className="home-entry"><EntryBanner /></div>
      <CommunityVideoSection />
      <LiveStreamSection />
      <ToolsSection />
      <StatsBand />
      <FaqSection />
      <CtaBand />
      <Footer />
    </div>
  );
}

function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const openSupport = () => {
    closeMenu();
    window.dispatchEvent(new CustomEvent("ziidi:open-support"));
  };
  return (
    <header className="home-nav sticky top-0 z-40 border-b border-home-line bg-home-paper/95 backdrop-blur-lg">
      <div className="home-topbar mx-auto grid h-20 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 sm:px-8 lg:flex lg:justify-between">
        <Link to="/" className="min-w-0" aria-label="ZIIDI Shari'ah home"><ZiidiLogo /></Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          <Link to="/stories" className="home-nav-link">Stories & Media</Link>
          <a href="#benefits" className="home-nav-link">Benefits</a>
          <a href="#faqs" className="home-nav-link">FAQs</a>
          <Button variant="ghost" onClick={openSupport} className="home-nav-link">Trader Support <ArrowUpRight /></Button>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" className="hidden text-home-ink sm:inline-flex"><Link to="/auth" search={{ mode: "signin" }}>Sign In</Link></Button>
          <Button asChild className="bg-home-green px-3 text-home-paper hover:bg-home-green-deep sm:px-4"><Link to="/auth" search={{ mode: "signup" }}>Sign Up <ArrowUpRight className="hidden sm:block" /></Link></Button>
          <Button variant="ghost" size="icon" aria-label={menuOpen ? "Close menu" : "Open menu"} title={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="home-mobile-menu" onClick={() => setMenuOpen((open) => !open)} className="shrink-0 text-home-ink hover:bg-home-mist lg:hidden">
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      <nav id="home-mobile-menu" aria-label="Mobile navigation" hidden={!menuOpen} className="home-mobile-menu border-t border-home-line px-5 py-3 lg:hidden">
        <Link to="/stories" onClick={closeMenu} className="home-nav-link">Stories & Media</Link>
        <a href="#benefits" onClick={closeMenu} className="home-nav-link">Benefits</a>
        <a href="#faqs" onClick={closeMenu} className="home-nav-link">FAQs</a>
        <Button variant="ghost" onClick={openSupport} className="home-nav-link justify-start">Trader Support <ArrowUpRight /></Button>
        <Button asChild variant="ghost" className="justify-start text-home-green"><Link to="/auth" search={{ mode: "signin" }} onClick={closeMenu}>Sign In <ArrowUpRight /></Link></Button>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="home-hero relative isolate overflow-hidden bg-home-hero-ground text-home-paper">
      <img src={launchPhoto.url} width={1920} height={1282} alt="The ZIIDI Shari'ah launch, with three leaders at the green launch podium" fetchPriority="high" className="home-hero-photo absolute right-0 top-0 -z-20 object-cover" />
      <div aria-hidden="true" className="home-hero-shade absolute inset-0 -z-10" />
      <div className="home-hero-content relative mx-auto flex max-w-7xl flex-col justify-center px-5 sm:px-8">
        <div className="home-hero-eyebrow flex items-center gap-3 text-[11px] font-semibold uppercase"><span className="h-2 w-2 shrink-0 rounded-full bg-home-lime" /><span>Nairobi Securities Exchange</span></div>
        <p className="home-hero-pretitle">Grow your money the</p>
        <h1 className="home-headline font-heading font-semibold">
          <span className="block text-home-lime">ZIIDI</span><span className="block">Shari'ah MMF</span>
        </h1>
        <p className="home-hero-tagline">way — save, invest, prosper.</p>
        <p className="home-hero-description max-w-lg leading-relaxed text-home-paper/85">
          The ZIIDI Shari'ah Money Market Fund puts your idle M‑PESA to work — competitive daily returns,
          zero hidden fees and instant liquidity whenever you need it.
        </p>
        <div className="home-hero-actions flex flex-wrap gap-2">
          <Button asChild size="lg" className="h-12 bg-home-lime px-4 text-home-ink hover:bg-home-paper"><Link to="/auth" search={{ mode: "signup" }}>Open a Trading Account <ArrowUpRight /></Link></Button>
          <Button asChild variant="outline" size="lg" className="h-12 border-home-paper/40 bg-transparent px-4 text-home-paper hover:bg-home-paper/10 hover:text-home-paper"><Link to="/auth" search={{ mode: "signin" }}>Sign In</Link></Button>
          <InstallAppButton className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-home-paper/40 bg-transparent px-4 text-sm font-semibold text-home-paper hover:bg-home-paper/10" />
        </div>
        <div className="home-hero-trust flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-home-paper/25 pt-4 text-xs">
          <TrustPill icon={ShieldCheck} label="Bank‑grade security" />
          <TrustPill icon={Wallet} label="Instant M‑PESA payouts" />
          <TrustPill icon={Users} label="10k+ active investors" />
        </div>
      </div>
    </section>
  );
}

function CommunityVideoSection() {
  const [playing, setPlaying] = useState(false);
  return (
    <section id="community-video" aria-labelledby="community-video-heading" className="home-community-video bg-home-mist">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:gap-20 lg:py-20">
        <div className="min-w-0">
          <h2 id="community-video-heading" className="text-sm font-semibold text-home-green">Stories & Media</h2>
          <Quote aria-hidden="true" className="home-quote-mark mt-7 h-12 w-12 fill-home-green text-home-green" />
          <blockquote className="home-community-caption mt-5 font-heading font-semibold text-home-ink">
            ZIIDI shariah is here to make investing happen for us muslims… and I can’t wait to finally purchase this masterpiece 🥳🥳🥳
          </blockquote>
          <Button asChild variant="link" className="mt-7 h-auto justify-start p-0 text-home-green hover:text-home-green-deep">
            <a href={COMMUNITY_VIDEO_URL} target="_blank" rel="noopener noreferrer">YouTube <ArrowUpRight /></a>
          </Button>
        </div>
        <div className="home-short mx-auto w-full overflow-hidden rounded-lg border border-home-line bg-home-ink">
          <div className="relative aspect-[9/16] w-full">
            {playing && COMMUNITY_VIDEO_EMBED ? (
              <iframe src={`${COMMUNITY_VIDEO_EMBED}&autoplay=1&playsinline=1`} title="ZIIDI Shari'ah community video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 h-full w-full" />
            ) : (
              <>
                <img src={communityVideoPoster.url} width={1280} height={720} alt="A Muslim woman sharing her excitement about ZIIDI Shari'ah" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <Button variant="ghost" aria-label="Play ZIIDI Shari'ah community video" title="Play video" onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full rounded-none bg-transparent hover:bg-home-ink/10">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-home-lime text-home-ink transition-transform group-hover:scale-105"><Play className="ml-1 h-6 w-6 fill-current" /></span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustPill({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return <div className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-home-lime" /><span>{label}</span></div>;
}

function TrustBar() {
  const items = [
    { label: "Safaricom", ticker: "SC" },
    { label: "Equity", ticker: "EQ" },
    { label: "KCB", ticker: "KC" },
    { label: "Absa", ticker: "AB" },
    { label: "BAT", ticker: "BT" },
    { label: "Co-op Bank", ticker: "CB" },
    { label: "EABL", ticker: "EA" },
    { label: "NCBA", ticker: "NC" },
  ];
  return (
    <section className="home-markets border-y border-home-line bg-home-paper py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] font-bold uppercase tracking-normal text-home-muted">
          Trusted markets
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {items.map((s) => (
            <div key={s.label} className="flex items-center gap-2" title={s.label}>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-md bg-home-paper text-[10px] font-bold text-home-green-deep shadow-sm ring-1 ring-home-line"
              >
                {s.ticker}
              </span>
              <span className="text-sm font-semibold text-home-ink">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolsSection() {
  return (
    <section id="benefits" className="home-benefits mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2"><div>
        <div className="inline-flex rounded-full bg-home-mist px-3 py-1 text-xs font-semibold uppercase tracking-normal text-home-green-deep">
          Why ZIIDI Shari'ah
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-normal text-home-ink sm:text-4xl">
          Tools to empower your wealth to the next level
        </h2>
        <p className="mt-4 text-home-muted">
          Everything you need to buy, hold and sell — on one clean, mobile‑first workspace.
        </p>
      </div><HeroDashboardMock /></div>

      <div className="home-features mt-16 grid gap-x-14 gap-y-16 lg:grid-cols-2">
        {FEATURES.map((f, i) => (
          <FeatureRow key={f.title} feature={f} index={i} />
        ))}
      </div>
    </section>
  );
}

function FeatureRow({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number];
  index: number;
}) {
  return (
    <div className="home-feature flex flex-col border-t border-home-line pt-7">
      <div className="w-full">
        <div className="inline-flex items-center gap-2 rounded-full bg-home-mist px-3 py-1 text-xs font-semibold uppercase tracking-normal text-home-green-deep">
          0{index + 1} · {feature.tag}
        </div>
        <h3 className="mt-4 text-2xl font-bold tracking-normal text-home-ink sm:text-3xl">
          {feature.title}
        </h3>
        <p className="mt-3 text-home-muted">{feature.body}</p>
        <ul className="mt-5 space-y-2">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-home-ink">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-home-green text-home-paper">
                <Check className="h-3 w-3" />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <Link
          to="/auth"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-home-green-deep hover:text-home-green-deep"
        >
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-7 w-full">
        <div className="relative">
          <div className="home-feature-art overflow-hidden bg-home-mist p-5">
            {feature.art}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsBand() {
  const stats = [
    { v: "10k+", l: "Active investors" },
    { v: "KSH 2B+", l: "Traded volume" },
    { v: "60+", l: "Listed stocks" },
    { v: "99.9%", l: "Uptime" },
  ];
  return (
    <section className="bg-home-green py-14 text-home-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-3xl font-bold sm:text-4xl">{s.v}</div>
            <div className="mt-1 text-sm font-medium text-home-mist/90">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="home-cta overflow-hidden bg-home-green-deep px-5 text-home-paper sm:px-8">
      <div className="home-cta-layout relative mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-16">
        
        <div className="home-investor-photo relative mx-auto w-full">
          <img src={investorPhoto.url} width={294} height={464} alt="An investor smiling while using her tablet" loading="lazy" className="h-auto w-full" />
        </div>
        <div className="relative min-w-0 py-12 md:py-20">
          <h2 className="text-3xl font-bold tracking-normal text-home-paper sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mt-4 text-home-muted">
            Sign up now to start investing with ease on ZIIDI Shari'ah. No deposit required — buy shares
            directly from verified sellers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 bg-home-lime text-home-ink hover:bg-home-paper"><Link to="/auth" search={{ mode: "signup" }}>Sign Up <ArrowRight /></Link></Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-home-paper/40 bg-transparent text-home-paper hover:bg-home-paper/10 hover:text-home-paper"><Link to="/auth" search={{ mode: "signin" }}>Sign In</Link></Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faqs" className="home-faq mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <div className="inline-flex rounded-full bg-home-mist px-3 py-1 text-xs font-semibold uppercase tracking-normal text-home-green-deep">
          FAQ
        </div>
        <h2 className="mt-4 text-3xl font-bold tracking-normal text-home-ink sm:text-4xl">
          Frequently Asked Questions
        </h2>
      </div>
      <div className="space-y-0">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group border-b border-home-line py-5 open:bg-home-mist"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-home-ink">
              {f.q}
              <ChevronDown className="h-5 w-5 shrink-0 text-home-green transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-home-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  const contacts = useSupportContacts();
  return (
    <footer className="border-t border-home-line bg-home-paper text-home-muted">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <ZiidiLogo />
            <p className="mt-4 max-w-sm text-sm text-home-muted">
              A Safaricom platform enabling everyday investors to buy, hold and sell shares on the
              Nairobi Securities Exchange.
            </p>
            <div className="mt-5 flex gap-3">
              <SocialIcon icon={Twitter} />
              <SocialIcon icon={Facebook} />
              <SocialIcon icon={Instagram} />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-home-ink">Product</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#benefits" className="hover:text-home-green-deep">Benefits</a></li>
              <li><Link to="/deposit" className="hover:text-home-green-deep">Buy shares</Link></li>
              <li><Link to="/portfolio" className="hover:text-home-green-deep">Portfolio</Link></li>
              <li><Link to="/withdraw" className="hover:text-home-green-deep">Withdraw</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-home-ink">Support</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex min-w-0 items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-home-green" />{contacts ? <a className="min-w-0 break-all hover:text-home-green-deep" href={`mailto:${contacts.email}`}>{contacts.email}</a> : "…"}</li>
              <li className="flex min-w-0 items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-home-green" />{contacts ? <a className="min-w-0 break-words hover:text-home-green-deep" href={`tel:${contacts.phone.replace(/[^+0-9]/g, "")}`}>{contacts.phone}</a> : "…"}</li>
              <li><a href="#faqs" className="hover:text-home-green-deep">FAQs</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-home-line pt-6 text-xs text-home-muted sm:flex-row">
          <div>© {new Date().getFullYear()} ZIIDI Shari'ah. All rights reserved.</div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-home-green-deep">Privacy</a>
            <a href="#" className="hover:text-home-green-deep">Terms</a>
            <a href="#" className="hover:text-home-green-deep">Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon: Icon }: { icon: typeof Twitter }) {
  return (
    <a
      href="#"
      className="grid h-9 w-9 place-items-center rounded-full border border-home-line text-home-muted hover:border-home-green hover:text-home-green-deep"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

/* -------- Decorative SVG art (inline, no external assets) -------- */

function HeroDashboardMock() {
  return (
    <div className="relative mx-auto w-full max-w-lg rounded-lg border border-home-line bg-home-paper p-4 shadow-2xl shadow-home-green-deep/10">
      <div className="flex items-center justify-between border-b border-home-line pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
          <span className="h-2.5 w-2.5 rounded-full bg-chart-4" />
          <span className="h-2.5 w-2.5 rounded-full bg-home-green" />
        </div>
        <div className="text-xs font-semibold text-home-muted">Investment balance</div>
      </div>
      <div className="mt-4 rounded-lg bg-gradient-to-br from-home-green to-home-green p-5 text-home-paper">
        <div className="text-xs opacity-80">Portfolio value</div>
        <div className="mt-1 text-3xl font-bold tracking-normal">KSH 148,320.55</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-home-paper/15 px-2 py-0.5 text-[11px] font-semibold">
          <TrendingUp className="h-3 w-3" /> +4.82% today
        </div>
      </div>
      <div className="mt-4">
        <MiniChart />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { s: "SAFCOM", p: "18.20", c: "+0.85%" },
          { s: "EQTY", p: "46.75", c: "-0.32%" },
          { s: "KCB", p: "38.90", c: "+1.10%" },
        ].map((t) => (
          <div key={t.s} className="rounded-lg border border-home-line p-2 text-center">
            <div className="text-[10px] font-bold text-home-muted">{t.s}</div>
            <div className="text-sm font-bold text-home-ink">{t.p}</div>
            <div
              className={`text-[10px] font-semibold ${
                t.c.startsWith("+") ? "text-home-green" : "text-destructive"
              }`}
            >
              {t.c}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniChart() {
  return (
    <svg viewBox="0 0 300 90" className="h-24 w-full">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--home-green)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--home-green)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 70 L30 60 L60 65 L90 45 L120 50 L150 30 L180 38 L210 22 L240 28 L270 15 L300 20 L300 90 L0 90 Z"
        fill="url(#g)"
      />
      <path
        d="M0 70 L30 60 L60 65 L90 45 L120 50 L150 30 L180 38 L210 22 L240 28 L270 15 L300 20"
        fill="none"
        stroke="var(--home-green)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArtBuyPanel() {
  const min = useMinEntry();
  return (
    <div className="rounded-lg bg-home-paper p-5 text-home-ink">
      <div className="flex items-center justify-between text-xs text-home-muted">
        <span className="font-semibold">Buy ABSA</span>
        <span className="rounded-full bg-home-mist px-2 py-0.5 font-semibold text-home-green-deep">LIVE</span>
      </div>
      <div className="mt-3 text-3xl font-bold text-home-ink">{min === null ? "…" : `KSH ${min.toLocaleString("en-KE")}`}</div>
      <div className="text-xs text-home-muted">Estimated shares: 1,106</div>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-home-mist px-3 py-2 text-xs">
        <span className="font-semibold text-home-green-deep">Sell at KSH 45,000</span>
        <span className="rounded-full bg-home-paper px-2 py-0.5 font-bold text-home-green-deep ring-1 ring-home-line">
          Very Minimal risk
        </span>
      </div>
      <div className="mt-4">
        <Candles />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" className="py-2 text-xs font-semibold" disabled>
          Back
        </Button>
        <Button className="bg-home-green py-2 text-xs font-semibold text-home-paper" disabled>
          Continue
        </Button>
      </div>
    </div>
  );
}

function Candles() {
  const data = [
    [30, 60, 20, 50], [40, 55, 30, 45], [45, 65, 35, 55], [50, 70, 40, 60],
    [55, 75, 45, 65], [60, 80, 50, 70], [55, 78, 48, 72], [65, 85, 55, 78],
    [70, 88, 60, 80], [75, 90, 65, 85],
  ];
  return (
    <svg viewBox="0 0 200 100" className="h-24 w-full">
      {data.map((d, i) => {
        const x = 10 + i * 18;
        const [o, h, l, c] = d;
        const up = c >= o;
        const color = up ? "var(--home-green)" : "var(--destructive)";
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={100 - h} y2={100 - l} stroke={color} strokeWidth="1.5" />
            <rect
              x={x - 4}
              y={100 - Math.max(o, c)}
              width="8"
              height={Math.max(2, Math.abs(c - o))}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

function ArtPortfolio() {
  const rows = [
    { s: "SAFCOM", qty: 320, p: "18.20", c: "+2.1%" },
    { s: "EQTY", qty: 140, p: "46.75", c: "+1.4%" },
    { s: "KCB", qty: 90, p: "38.90", c: "+0.9%" },
    { s: "BAT", qty: 20, p: "522.34", c: "-0.5%" },
  ];
  return (
    <div className="rounded-lg bg-home-paper p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-home-ink">My portfolio</div>
        <div className="text-xs font-semibold text-home-green">+KSH 4,120 today</div>
      </div>
      <MiniChart />
      <div className="mt-2 divide-y divide-home-line">
        {rows.map((r) => (
          <div key={r.s} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div className="font-bold text-home-ink">{r.s}</div>
              <div className="text-[11px] text-home-muted">{r.qty} shares</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-home-ink">KSH {r.p}</div>
              <div
                className={`text-[11px] font-semibold ${
                  r.c.startsWith("+") ? "text-home-green" : "text-destructive"
                }`}
              >
                {r.c}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtSecurity() {
  return (
    <div className="grid place-items-center rounded-lg border border-home-mist bg-gradient-to-br from-home-mist via-home-paper to-home-mist p-10 text-home-ink">
      <div className="relative">
        <div className="relative grid h-28 w-28 place-items-center rounded-lg bg-home-paper shadow-lg shadow-home-green-deep/10 ring-1 ring-home-mist">
          <Lock className="h-12 w-12 text-home-green" />
        </div>
      </div>
      <div className="mt-6 text-center">
        <div className="text-lg font-bold text-home-ink">End‑to‑end encrypted</div>
        <div className="mt-1 text-xs text-home-muted">
          M‑PESA verified · Admin escrow · Every session protected
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-normal text-home-muted">
        <span className="rounded-full border border-home-line bg-home-paper px-3 py-1">SOC 2</span>
        <span className="rounded-full border border-home-line bg-home-paper px-3 py-1">ISO 27001</span>
        <span className="rounded-full border border-home-line bg-home-paper px-3 py-1">PCI DSS</span>
      </div>
    </div>
  );
}

function ArtGrowth() {
  return (
    <div className="rounded-lg bg-home-paper p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-normal text-home-muted">
            Net worth
          </div>
          <div className="mt-1 text-3xl font-bold text-home-ink">KSH 214,900</div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-home-mist px-2 py-1 text-xs font-bold text-home-green-deep">
          <TrendingUp className="h-3 w-3" /> +18.4%
        </div>
      </div>
      <svg viewBox="0 0 300 130" className="mt-4 h-36 w-full">
        <defs>
          <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--home-green)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--home-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 110 C40 100 60 90 90 80 S150 60 180 50 S250 25 300 15 L300 130 L0 130 Z"
          fill="url(#g2)"
        />
        <path
          d="M0 110 C40 100 60 90 90 80 S150 60 180 50 S250 25 300 15"
          fill="none"
          stroke="var(--home-green)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {[0, 60, 120, 180, 240, 300].map((x) => (
          <line key={x} x1={x} x2={x} y1="0" y2="130" stroke="var(--home-line)" strokeWidth="1" />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px] font-semibold text-home-muted">
        <div>JAN</div><div>APR</div><div>JUL</div><div>OCT</div>
      </div>
    </div>
  );
}

/* Silence unused warning for LineChart import if tree-shaken. */
void LineChart;