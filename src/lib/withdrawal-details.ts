import type { Database } from "@/integrations/supabase/types";

export type WithdrawalDetails = Database["public"]["Tables"]["withdrawals"]["Row"];
export type WithdrawalCustomer = {
  username: string;
  account_id?: string;
  phone?: string | null;
  email?: string | null;
};

export const WITHDRAWAL_METHODS = [
  { id: "mpesa", label: "M-Pesa" },
  { id: "bank", label: "Bank Transfer" },
  { id: "card", label: "Debit / Credit Card" },
] as const;

export function withdrawalReference(id: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  if (!id) return "—";
  return Array.from(
    { length: 10 },
    (_, i) => chars[(id.charCodeAt(i % id.length) + i * 7) % chars.length],
  ).join("");
}

export function canEditWithdrawalPayment(status: string) {
  return status === "pending" || status === "processing";
}

export function withdrawalMoney(amount: number) {
  return `KES ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function withdrawalMethodLabel(method: string) {
  return WITHDRAWAL_METHODS.find((item) => item.id === method)?.label ?? method;
}

export function withdrawalDestinationDetails(
  method: string,
  destination: string,
): Array<[string, string]> {
  if (method !== "bank")
    return [[method === "mpesa" ? "M-Pesa number / recipient" : "Card destination", destination]];
  const parts = destination.split(" · ");
  if (parts.length < 3) return [["Bank destination", destination]];
  return [
    ["Bank", parts[0]],
    ["Account number", parts[1].replace(/^A\/C\s*/, "")],
    ["Account holder", parts[2]],
    ...parts
      .slice(3)
      .map((part): [string, string] =>
        part.startsWith("SWIFT ")
          ? ["SWIFT / BIC", part.slice(6)]
          : ["Branch / additional details", part],
      ),
  ];
}
