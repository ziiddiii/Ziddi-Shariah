export function stockMinimumEntry(settings: { min_total: number } | null): number | null {
  if (!settings || !Number.isFinite(settings.min_total) || settings.min_total <= 0) return null;
  return settings.min_total;
}