"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createAccount,
  updateAccount,
  deleteAccount,
  setMainAccount,
} from "@/actions/accounts";
import { deleteAllTrades } from "@/actions/trades";
import { importCashActivity, revertCashImport } from "@/actions/cash-activity";
import {
  parseCashActivityCsv,
  type CashActivityRecord,
} from "@/lib/parse-cash-activity";
import { cn } from "@/lib/utils";

type CashActivityEntry = {
  id: string;
  date: string;
  description: string;
  type: string;
  amount: number;
  currency: string;
  importBatchId: string;
};

type Account = {
  id: string;
  name: string;
  broker: string;
  description: string | null;
  isActive: boolean;
  isMain: boolean;
  startingBalance: number;
  currentBalance: number;
  commissionPerOption: number;
  commissionPerStock: number;
  optionAssignmentFee: number;
  cashActivities: CashActivityEntry[];
};

function AccountForm({
  account,
  onDone,
}: {
  account?: Account;
  onDone: () => void;
}) {
  const action = account
    ? (fd: FormData) => updateAccount(account.id, fd).then(onDone)
    : (fd: FormData) => createAccount(fd).then(onDone);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={account?.name} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="broker">Broker</Label>
          <Input
            id="broker"
            name="broker"
            defaultValue={account?.broker}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={account?.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="startingBalance">Starting Balance ($)</Label>
          <Input
            id="startingBalance"
            name="startingBalance"
            type="number"
            step="0.01"
            defaultValue={String(account?.startingBalance ?? 0)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="commissionPerOption">Commission / Option ($)</Label>
          <Input
            id="commissionPerOption"
            name="commissionPerOption"
            type="number"
            step="0.01"
            defaultValue={String(account?.commissionPerOption ?? 0)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="commissionPerStock">Commission / Stock ($)</Label>
          <Input
            id="commissionPerStock"
            name="commissionPerStock"
            type="number"
            step="0.01"
            defaultValue={String(account?.commissionPerStock ?? 0)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="optionAssignmentFee">Option Assignment Fee ($)</Label>
          <Input
            id="optionAssignmentFee"
            name="optionAssignmentFee"
            type="number"
            step="0.01"
            defaultValue={String(account?.optionAssignmentFee ?? 0)}
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="isMain"
            value="true"
            defaultChecked={account?.isMain}
            className="rounded"
          />
          Set as main account
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={account?.isActive ?? true}
            className="rounded"
          />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{account ? "Save" : "Create"}</Button>
      </div>
    </form>
  );
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  MARGIN_INTEREST: "Margin Int.",
  INTEREST: "Interest",
  DIVIDEND: "Dividend",
  TAX: "Tax",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  OTHER: "Other",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const ACTIVITY_TYPE_VARIANT: Record<string, BadgeVariant> = {
  MARGIN_INTEREST: "outline",
  INTEREST: "secondary",
  DIVIDEND: "secondary",
  TAX: "destructive",
  DEPOSIT: "default",
  WITHDRAWAL: "destructive",
  OTHER: "outline",
};

const TYPE_CHIP_COLOR: Record<string, string> = {
  MARGIN_INTEREST: "bg-amber-50 text-amber-700 ring-amber-200",
  INTEREST: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DIVIDEND: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  TAX: "bg-rose-50 text-rose-700 ring-rose-200",
  DEPOSIT: "bg-blue-50 text-blue-700 ring-blue-200",
  WITHDRAWAL: "bg-rose-50 text-rose-700 ring-rose-200",
  OTHER: "bg-muted/80 text-muted-foreground ring-border",
};

function groupByBatch(activities: CashActivityEntry[]) {
  const groups = new Map<string, CashActivityEntry[]>();
  for (const a of activities) {
    const group = groups.get(a.importBatchId) ?? [];
    group.push(a);
    groups.set(a.importBatchId, group);
  }
  return [...groups.entries()].map(([batchId, items]) => ({ batchId, items }));
}

function UndoMovementsButton({
  batchId,
  onUndone,
}: {
  batchId: string;
  onUndone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUndo() {
    setLoading(true);
    setError(null);
    try {
      await revertCashImport(batchId);
      onUndone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleUndo}
        disabled={loading}
        className="text-destructive hover:text-destructive"
      >
        {loading ? "Undoing…" : "Undo Import"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ImportMovementsDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "preview" | "importing" | "done">(
    "idle",
  );
  const [records, setRecords] = useState<CashActivityRecord[]>([]);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    batchId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase("idle");
    setRecords([]);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleOpenChange(v: boolean) {
    onOpenChange(v);
    if (!v) reset();
  }

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file from TradeStation");
      return;
    }
    file.text().then((text) => {
      try {
        const parsed = parseCashActivityCsv(text);
        if (parsed.length === 0) {
          setError(
            "No records found. Make sure this is a TradeStation Cash Activity CSV.",
          );
          return;
        }
        setRecords(parsed);
        setPhase("preview");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
      }
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  async function handleImport() {
    setPhase("importing");
    setError(null);
    try {
      const res = await importCashActivity(account.id, records);
      setResult(res);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setPhase("preview");
    }
  }

  const typeCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Import cash movements — {account.name}</DialogTitle>
        </DialogHeader>

        {phase === "idle" && (
          <div className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/30",
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <p className="text-sm font-medium">
                {isDragOver ? "Drop to import" : "Click or drag file here"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts <span className="font-mono">.csv</span> exported from
                TradeStation
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processFile(f);
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {Object.entries(typeCounts).map(([type, count]) => (
                <span
                  key={type}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-medium ring-1",
                    TYPE_CHIP_COLOR[type] ?? TYPE_CHIP_COLOR.OTHER,
                  )}
                >
                  {count} {ACTIVITY_TYPE_LABELS[type] ?? type}
                </span>
              ))}
            </div>

            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap">
                        {new Date(r.date + "T12:00:00Z").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", timeZone: "UTC" },
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                            TYPE_CHIP_COLOR[r.type] ?? TYPE_CHIP_COLOR.OTHER,
                          )}
                        >
                          {ACTIVITY_TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>
                      <td
                        className="px-3 py-1.5 text-muted-foreground max-w-[220px] truncate"
                        title={r.description}
                      >
                        {r.description}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-right tabular-nums font-medium",
                          r.amount >= 0 ? "text-emerald-600" : "text-rose-600",
                        )}
                      >
                        {r.amount >= 0 ? "+" : ""}$
                        {Math.abs(r.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import {records.length} movement
                {records.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {phase === "importing" && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Importing…
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-4">
            <div className="rounded-md border divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">
                  Movements imported
                </span>
                <span className="font-semibold text-emerald-600">
                  {result.imported}
                </span>
              </div>
              {result.skipped > 0 && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">
                    Duplicates skipped
                  </span>
                  <span className="font-semibold text-amber-600">
                    {result.skipped}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <UndoMovementsButton
                batchId={result.batchId}
                onUndone={() => handleOpenChange(false)}
              />
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ViewMovementsDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null);
  const batches = groupByBatch(account.cashActivities);

  async function handleRevert(batchId: string) {
    setRevertingBatchId(batchId);
    try {
      await revertCashImport(batchId);
    } finally {
      setRevertingBatchId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm sm:max-w-4xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Cash movements — {account.name}</DialogTitle>
        </DialogHeader>
        {account.cashActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No cash movements imported yet.
          </p>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto space-y-6">
            {batches.map(({ batchId, items }) => {
              const batchTotal = items.reduce((s, a) => s + a.amount, 0);
              return (
                <div key={batchId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-mono">
                      Batch {batchId.slice(0, 8)}… ({items.length} row
                      {items.length !== 1 ? "s" : ""})
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-6 text-xs"
                      disabled={revertingBatchId === batchId}
                      onClick={() => handleRevert(batchId)}
                    >
                      {revertingBatchId === batchId
                        ? "Reverting…"
                        : "Revert import"}
                    </Button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">
                          Date
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Type
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Description
                        </th>
                        <th className="px-2 py-1 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((a) => (
                        <tr key={a.id}>
                          <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                            {a.date}
                          </td>
                          <td className="px-2 py-1">
                            <Badge
                              variant={
                                ACTIVITY_TYPE_VARIANT[a.type] ?? "outline"
                              }
                            >
                              {ACTIVITY_TYPE_LABELS[a.type] ?? a.type}
                            </Badge>
                          </td>
                          <td
                            className="px-2 py-1 text-muted-foreground max-w-[280px] truncate"
                            title={a.description}
                          >
                            {a.description}
                          </td>
                          <td
                            className={`px-2 py-1 text-right font-mono ${a.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {a.amount >= 0 ? "+" : ""}
                            {a.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted/30">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground"
                        >
                          Batch total
                        </td>
                        <td
                          className={cn(
                            "px-2 py-1.5 text-right font-mono font-semibold",
                            batchTotal >= 0 ? "text-green-600" : "text-red-600",
                          )}
                        >
                          {batchTotal >= 0 ? "+" : ""}
                          {batchTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })}
            {batches.length > 1 &&
              (() => {
                const grandTotal = account.cashActivities.reduce(
                  (s, a) => s + a.amount,
                  0,
                );
                return (
                  <div className="border-t pt-3 flex justify-end gap-4 text-sm font-semibold">
                    <span className="text-muted-foreground">Grand total</span>
                    <span
                      className={cn(
                        "font-mono",
                        grandTotal >= 0 ? "text-green-600" : "text-red-600",
                      )}
                    >
                      {grandTotal >= 0 ? "+" : ""}
                      {grandTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                );
              })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [importingAccount, setImportingAccount] = useState<Account | null>(
    null,
  );
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [clearingAccount, setClearingAccount] = useState<Account | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>Add Account</Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Broker</th>
              <th className="px-4 py-3 text-right font-medium">Starting</th>
              <th className="px-4 py-3 text-right font-medium">Current</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium w-10">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {accounts.map((account) => (
              <tr
                key={account.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium">{account.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {account.broker}
                </td>
                <td className="px-4 py-3 text-right">
                  ${Number(account.startingBalance).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  $
                  {account.currentBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {account.isMain && <Badge variant="default">Main</Badge>}
                    {account.isActive && (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        ···
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-auto" align="end">
                      {!account.isMain && (
                        <DropdownMenuItem
                          onClick={() => setMainAccount(account.id)}
                        >
                          Set Main
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setImportingAccount(account)}
                      >
                        Import movements
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setViewingAccount(account)}
                      >
                        View movements
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setEditingAccount(account)}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setClearingAccount(account)}
                      >
                        Delete all trades
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeletingAccount(account)}
                      >
                        Delete account
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No accounts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add account */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
          </DialogHeader>
          <AccountForm onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit account */}
      {editingAccount && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setEditingAccount(null);
          }}
        >
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
            </DialogHeader>
            <AccountForm
              account={editingAccount}
              onDone={() => setEditingAccount(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Import movements */}
      {importingAccount && (
        <ImportMovementsDialog
          account={importingAccount}
          open
          onOpenChange={(o) => {
            if (!o) setImportingAccount(null);
          }}
        />
      )}

      {/* View movements */}
      {viewingAccount && (
        <ViewMovementsDialog
          account={viewingAccount}
          open
          onOpenChange={(o) => {
            if (!o) setViewingAccount(null);
          }}
        />
      )}

      {/* Delete all trades */}
      <AlertDialog
        open={!!clearingAccount}
        onOpenChange={(o) => {
          if (!o) setClearingAccount(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete all trades for {clearingAccount?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete every trade in{" "}
              <strong>{clearingAccount?.name}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                if (!clearingAccount) return;
                startTransition(async () => {
                  await deleteAllTrades(clearingAccount.id);
                  setClearingAccount(null);
                });
              }}
            >
              {isPending ? "Deleting…" : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete account */}
      <AlertDialog
        open={!!deletingAccount}
        onOpenChange={(o) => {
          if (!o) setDeletingAccount(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingAccount?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account and all its data. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingAccount) return;
                deleteAccount(deletingAccount.id);
                setDeletingAccount(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
