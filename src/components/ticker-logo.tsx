import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STOCK_LOGOS } from "@/lib/stock-logos";

function extractStockLogoPath(value: string) {
  const raw = value.trim();
  if (raw.startsWith("stock-logos://")) return raw.slice("stock-logos://".length);

  const signedMarker = "/storage/v1/object/sign/stock-logos/";
  const publicMarker = "/storage/v1/object/public/stock-logos/";
  const marker = raw.includes(signedMarker)
    ? signedMarker
    : raw.includes(publicMarker)
      ? publicMarker
      : null;
  if (!marker) return null;

  const encodedPath = raw.slice(raw.indexOf(marker) + marker.length).split("?")[0];
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

interface TickerLogoProps {
  ticker: string;
  size?: number;
  className?: string;
  logoUrl?: string | null;
}

export function TickerLogo({ ticker, size = 40, className = "", logoUrl }: TickerLogoProps) {
  const [attempt, setAttempt] = useState(0);
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState(logoUrl?.trim() ?? "");
  const initials = ticker.slice(0, 2).toUpperCase();

  useEffect(() => {
    let cancelled = false;
    const raw = logoUrl?.trim() ?? "";
    setResolvedLogoUrl(raw);

    const storagePath = raw ? extractStockLogoPath(raw) : null;
    if (!storagePath) return;

    supabase.storage
      .from("stock-logos")
      .createSignedUrl(storagePath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setResolvedLogoUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const sources = useMemo(() => {
    const next: string[] = [];
    // Retain admin replacements, but never request the retired Clearbit service.
    if (resolvedLogoUrl && !resolvedLogoUrl.includes("logo.clearbit.com"))
      next.push(resolvedLogoUrl);
    const officialLogo = STOCK_LOGOS[ticker.toUpperCase()];
    if (officialLogo) next.push(officialLogo);
    return Array.from(new Set(next));
  }, [resolvedLogoUrl, ticker]);

  useEffect(() => {
    setAttempt(0);
  }, [sources.join("|")]);

  if (sources.length === 0 || attempt >= sources.length) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground ring-1 ring-border ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-label={`${ticker} initials`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={sources[attempt]}
      alt={`${ticker} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setAttempt((a) => a + 1)}
      onLoad={(event) => {
        const image = event.currentTarget;
        if (image.naturalWidth === 0 || image.naturalHeight === 0) {
          setAttempt((a) => a + 1);
        }
      }}
      className={`rounded-md bg-card object-contain ring-1 ring-border ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
