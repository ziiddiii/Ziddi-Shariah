export function lockLimitsError(minimum: number, maximum: number): string | null {
  if (!Number.isFinite(minimum) || minimum <= 0)
    return "Enter a minimum lock amount greater than zero";
  if (!Number.isFinite(maximum) || maximum < minimum)
    return "Maximum lock amount must be at least the minimum";
  return null;
}

export function lockAmountError(amount: number, minimum: number, maximum: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter a valid amount";
  if (amount < minimum) return `Minimum lock is KES ${minimum.toLocaleString()}`;
  if (amount > maximum) return `Maximum lock is KES ${maximum.toLocaleString()}`;
  return null;
}
