import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Pencil, Receipt, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canEditWithdrawalPayment,
  WITHDRAWAL_METHODS,
  withdrawalDestinationDetails,
  withdrawalMethodLabel,
  withdrawalMoney,
  withdrawalReference,
} from "@/lib/withdrawal-details";
import type { WithdrawalCustomer, WithdrawalDetails } from "@/lib/withdrawal-details";
import type { Database } from "@/integrations/supabase/types";

type EditRecord = Database["public"]["Tables"]["withdrawal_edits"]["Row"];
type Draft = {
  amount: string;
  method: string;
  destination: string;
  taxCode: string;
  note: string;
  payoutReference: string;
};
const dateLabel = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-KE") : "Not recorded";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

const editLabels: Record<string, string> = {
  amount: "Amount",
  method: "Method",
  destination: "Destination",
  tax_tx_code: "Tax transaction code",
  tax_paid_at: "Tax code submitted",
  status: "Status",
  admin_note: "Admin note",
  payout_reference: "Payout reference",
  rejection_reason: "Rejection reason",
};
function editChanges(edit: EditRecord) {
  const before = edit.before_details;
  const after = edit.after_details;
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  )
    return [];
  return Object.entries(editLabels)
    .filter(([key]) => before[key] !== after[key])
    .map(([key, label]) => ({
      label,
      before: before[key] == null ? "—" : String(before[key]),
      after: after[key] == null ? "—" : String(after[key]),
    }));
}

export function WithdrawalDetailsDialog({
  withdrawalId,
  admin = false,
  email,
  onClose,
  onUpdated,
}: {
  withdrawalId: string;
  admin?: boolean;
  email?: string | null;
  onClose: () => void;
  onUpdated?: (row: WithdrawalDetails) => void;
}) {
  const [row, setRow] = useState<WithdrawalDetails | null>(null);
  const [customer, setCustomer] = useState<WithdrawalCustomer | null>(null);
  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editVersion, setEditVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    amount: "",
    method: "mpesa",
    destination: "",
    taxCode: "",
    note: "",
    payoutReference: "",
  });

  const refresh = useCallback(async () => {
    const result = await supabase.from("withdrawals").select("*").eq("id", withdrawalId).single();
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setRow(result.data);
    setError("");
    return result.data;
  }, [withdrawalId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await supabase.from("withdrawals").select("*").eq("id", withdrawalId).single();
      if (!active) return;
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setRow(result.data);
      const [person, contact, history] = await Promise.all([
        supabase
          .from("profiles")
          .select("username,account_id,phone")
          .eq("id", result.data.user_id)
          .maybeSingle(),
        admin
          ? supabase.rpc("notification_email_target", { _user_id: result.data.user_id })
          : Promise.resolve({ data: email }),
        admin
          ? supabase
              .from("withdrawal_edits")
              .select("*")
              .eq("withdrawal_id", withdrawalId)
              .order("edited_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      if (!active) return;
      setCustomer({
        username: person.data?.username ?? "Customer",
        account_id: person.data?.account_id,
        phone: person.data?.phone,
        email: contact.data,
      });
      setEdits(history.data ?? []);
    };
    void load();
    return () => {
      active = false;
    };
  }, [withdrawalId, admin, email]);

  useEffect(() => {
    if (editing) return;
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [editing, refresh]);

  const beginEdit = async () => {
    const current = await refresh();
    if (!current) return;
    setEditVersion(current.updated_at);
    setDraft({
      amount: String(current.amount),
      method: current.method,
      destination: current.destination,
      taxCode: current.tax_tx_code ?? "",
      note: current.admin_note ?? "",
      payoutReference: current.payout_reference ?? "",
    });
    setEditing(true);
  };
  const save = async () => {
    if (!row) return;
    setBusy(true);
    const { data, error: saveError } = await supabase.rpc("admin_update_withdrawal", {
      _id: row.id,
      _amount: Number(draft.amount),
      _method: draft.method,
      _destination: draft.destination,
      _tax_tx_code: draft.taxCode,
      _admin_note: draft.note,
      _payout_reference: draft.payoutReference,
      _expected_updated_at: editVersion,
    });
    setBusy(false);
    if (saveError) {
      toast.error(saveError.message);
      return;
    }
    setRow(data);
    setEditing(false);
    onUpdated?.(data);
    const history = await supabase
      .from("withdrawal_edits")
      .select("*")
      .eq("withdrawal_id", row.id)
      .order("edited_at", { ascending: false });
    setEdits(history.data ?? []);
    toast.success("Withdrawal details saved");
  };
  const editablePayment = row ? canEditWithdrawalPayment(row.status) : false;
  const amountDifference = row ? Number(draft.amount) - Number(row.amount) : 0;
  const copyReference = async () => {
    if (!row) return;
    try {
      await navigator.clipboard.writeText(withdrawalReference(row.id));
      toast.success("Reference copied");
    } catch {
      toast.error("Could not copy reference");
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg p-4 sm:max-w-xl sm:p-6"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 pr-6 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {editing ? "Edit withdrawal" : "Withdrawal summary"}
          </DialogTitle>
          <DialogDescription>
            ZIIDI Shari'ah · {row ? withdrawalReference(row.id) : "Transaction details"}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!row && !error && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading withdrawal…
          </div>
        )}
        {row && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-4">
                <div>
                  <div className="text-xs text-muted-foreground">Withdrawal amount</div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-primary">
                    {withdrawalMoney(row.amount)}
                  </div>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${row.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                >
                  {row.status === "completed" ? "Approved" : row.status}
                </span>
              </div>
              {editing ? (
                <form
                  id="withdrawal-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                  className="space-y-4 pt-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm" htmlFor="withdrawal-edit-amount">
                      <span>Amount (KES)</span>
                      <Input
                        id="withdrawal-edit-amount"
                        type="number"
                        required
                        min="100000"
                        step="0.01"
                        disabled={!editablePayment || busy}
                        value={draft.amount}
                        onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                      />
                    </label>
                    <div className="space-y-1.5 text-sm">
                      <label htmlFor="withdrawal-edit-method">Withdrawal method</label>
                      <Select
                        value={draft.method}
                        disabled={!editablePayment || busy}
                        onValueChange={(method) => setDraft({ ...draft, method })}
                      >
                        <SelectTrigger id="withdrawal-edit-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WITHDRAWAL_METHODS.map((method) => (
                            <SelectItem key={method.id} value={method.id}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <label
                    className="block space-y-1.5 text-sm"
                    htmlFor="withdrawal-edit-destination"
                  >
                    <span>Destination / full payment details</span>
                    <Textarea
                      id="withdrawal-edit-destination"
                      required
                      minLength={3}
                      maxLength={1000}
                      disabled={!editablePayment || busy}
                      value={draft.destination}
                      onChange={(event) => setDraft({ ...draft, destination: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-1.5 text-sm" htmlFor="withdrawal-edit-tax-code">
                    <span>MMF tax transaction code</span>
                    <Input
                      id="withdrawal-edit-tax-code"
                      maxLength={12}
                      disabled={!editablePayment || busy}
                      value={draft.taxCode}
                      onChange={(event) =>
                        setDraft({ ...draft, taxCode: event.target.value.toUpperCase() })
                      }
                    />
                  </label>
                  <label
                    className="block space-y-1.5 text-sm"
                    htmlFor="withdrawal-edit-payout-reference"
                  >
                    <span>Payout transaction reference</span>
                    <Input
                      id="withdrawal-edit-payout-reference"
                      maxLength={100}
                      disabled={busy}
                      value={draft.payoutReference}
                      onChange={(event) =>
                        setDraft({ ...draft, payoutReference: event.target.value })
                      }
                    />
                  </label>
                  <label className="block space-y-1.5 text-sm" htmlFor="withdrawal-edit-note">
                    <span>Admin note</span>
                    <Textarea
                      id="withdrawal-edit-note"
                      maxLength={2000}
                      disabled={busy}
                      value={draft.note}
                      onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                    />
                  </label>
                  {!editablePayment && (
                    <p className="text-xs text-muted-foreground">
                      Payment details are locked after settlement.
                    </p>
                  )}
                  {editablePayment &&
                    Number.isFinite(amountDifference) &&
                    amountDifference !== 0 && (
                      <p className="text-sm text-muted-foreground">
                        User balance {amountDifference > 0 ? "deduction" : "refund"}:{" "}
                        <span className="font-mono text-foreground">
                          {withdrawalMoney(Math.abs(amountDifference))}
                        </span>
                      </p>
                    )}
                </form>
              ) : (
                <>
                  <dl className="pt-2">
                    <Detail label="Customer" value={customer?.username ?? "Loading…"} />
                    <Detail label="Account ID" value={customer?.account_id ?? "Not recorded"} />
                    <Detail label="Registered phone" value={customer?.phone || "Not recorded"} />
                    <Detail label="Email" value={customer?.email || "Not recorded"} />
                    <Detail label="Transaction ID" value={row.id} />
                    <Detail label="Requested" value={dateLabel(row.created_at)} />
                    <Detail label="Withdrawal method" value={withdrawalMethodLabel(row.method)} />
                    {withdrawalDestinationDetails(row.method, row.destination).map(
                      ([label, value], index) => (
                        <Detail key={`${label}-${index}`} label={label} value={value} />
                      ),
                    )}
                    <Detail
                      label="MMF tax at request"
                      value={
                        row.tax_enabled_at_request == null
                          ? "Not recorded for this withdrawal"
                          : row.tax_enabled_at_request
                            ? "Enabled"
                            : "Disabled"
                      }
                    />
                    {row.tax_enabled_at_request && row.tax_percent_at_request != null && (
                      <>
                        <Detail label="MMF tax rate" value={`${row.tax_percent_at_request}%`} />
                        <Detail
                          label="MMF tax amount"
                          value={withdrawalMoney(
                            Math.round(row.amount * row.tax_percent_at_request) / 100,
                          )}
                        />
                      </>
                    )}
                    <Detail
                      label="Tax transaction code"
                      value={row.tax_tx_code || "Not submitted"}
                    />
                    <Detail label="Tax code submitted" value={dateLabel(row.tax_paid_at)} />
                    <Detail
                      label="Payout reference"
                      value={row.payout_reference || "Not recorded"}
                    />
                    <Detail label="Reviewed" value={dateLabel(row.reviewed_at)} />
                    {row.rejection_reason && (
                      <Detail label="Rejection reason" value={row.rejection_reason} />
                    )}
                    <Detail label="Last updated" value={dateLabel(row.updated_at)} />
                    <Detail label="Admin note" value={row.admin_note || "None"} />
                    {admin && (
                      <>
                        <Detail label="User ID" value={row.user_id} />
                        <Detail label="Reviewed by" value={row.reviewed_by || "Not recorded"} />
                      </>
                    )}
                  </dl>
                  {admin && edits.length > 0 && (
                    <section className="mt-5 border-t border-border pt-4">
                      <h3 className="text-sm font-semibold">Change history</h3>
                      <ol className="mt-2 divide-y divide-border">
                        {edits.map((edit) => (
                          <li key={edit.id} className="py-3 text-xs">
                            <div className="font-medium">{dateLabel(edit.edited_at)}</div>
                            <div className="mt-1 break-all text-muted-foreground">
                              Changed by: {edit.edited_by ?? "System"}
                            </div>
                            {editChanges(edit).map((change) => (
                              <div
                                key={change.label}
                                className="mt-2 break-words [overflow-wrap:anywhere]"
                              >
                                <span className="font-medium">{change.label}: </span>
                                <span className="text-muted-foreground">
                                  {change.before}
                                </span> → {change.after}
                              </div>
                            ))}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </>
              )}
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-border pt-3">
              {editing ? (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" form="withdrawal-edit-form" disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Save />}
                    {busy ? "Saving…" : "Save changes"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void copyReference();
                    }}
                  >
                    <Copy /> Copy reference
                  </Button>
                  {admin && (
                    <Button
                      onClick={() => {
                        void beginEdit();
                      }}
                    >
                      <Pencil /> Edit details
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
