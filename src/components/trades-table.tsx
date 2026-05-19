"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteTrade } from "@/actions/trades";
import { TradeForm, type TradeFormTrade } from "@/components/trade-form";
import { CloseTradeDialog } from "@/components/close-trade-dialog";
import { RollTradeDialog } from "@/components/roll-trade-dialog";
import { DatePicker } from "@/components/date-picker";
import { HugeiconsIcon } from "@hugeicons/react";
import { UnfoldMoreIcon } from "@hugeicons/core-free-icons";

export type TableTrade = {
  id: string;
  name: string;
  ticker: string;
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: number;
  entryPrice: number;
  openDate: Date;
  source: "MANUAL" | "TS_IMPORT";
  exitPrice: number | null;
  closeDate: Date | null;
  projectedProfit: number | null;
  netPnl: number | null;
  notes: string | null;
  optionType: "CALL" | "PUT" | null;
  strike: number | null;
  expiration: Date | null;
  contractSize: number | null;
  commission: number;
  accountId: string;
  tradeSetups: { setupId: string; setup: { name: string } }[];
};

type Props = {
  trades: TableTrade[];
  variant: "closed" | "open";
  accounts: { id: string; name: string; optionAssignmentFee: number }[];
  setups: { id: string; name: string }[];
  total: number;
  page: number;
  perPage: number;
  projProfitTotal?: number;
  netPnlTotal?: number;
  availableTickers?: string[];
};

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysSince(d: Date) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function daysBetween(a: Date, b: Date) {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000,
  );
}

function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | "ellipsis")[] = [1];
  if (current > 3) result.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) result.push(i);
  if (current < total - 2) result.push("ellipsis");
  if (total > 1) result.push(total);
  return result;
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-2.5">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TradesTable({
  trades,
  variant,
  accounts,
  setups,
  total,
  page,
  perPage,
  projProfitTotal,
  netPnlTotal,
  availableTickers = [],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [editTrade, setEditTrade] = useState<TableTrade | null>(null);
  const [closingTrade, setClosingTrade] = useState<TableTrade | null>(null);
  const [rollingTrade, setRollingTrade] = useState<TableTrade | null>(null);
  const [deletingTrade, setDeletingTrade] = useState<TableTrade | null>(null);
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const selectedTickers = (searchParams.get("tickers") ?? "")
    .split(",")
    .filter(Boolean);
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  function navigate(updates: Record<string, string | number>, replace = false) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "") params.delete(k);
      else params.set(k, String(v));
    }
    const url = `/trades?${params}`;
    startTransition(() => {
      if (replace) router.replace(url);
      else router.push(url);
    });
  }

  function toggleTicker(ticker: string) {
    const current = new Set(selectedTickers);
    if (current.has(ticker)) current.delete(ticker);
    else current.add(ticker);
    navigate({ tickers: [...current].join(","), page: 1 });
  }

  const closedColumns: ColumnDef<TableTrade>[] = [
    { accessorKey: "name", header: "Name", size: 160 },
    {
      id: "days",
      header: "Days",
      cell: ({ row }) => {
        const t = row.original;
        if (!t.closeDate) return "—";
        return daysBetween(t.openDate, t.closeDate);
      },
    },
    {
      accessorKey: "openDate",
      header: "Open",
      cell: ({ getValue }) => fmtDate(getValue() as Date),
    },
    {
      accessorKey: "closeDate",
      header: "Close",
      cell: ({ getValue }) => (getValue() ? fmtDate(getValue() as Date) : "—"),
    },
    {
      accessorKey: "ticker",
      header: "Ticker",
      cell: ({ getValue }) => (
        <span className="font-mono">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "symbol",
      header: "Symbol",
      size: 180,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ getValue }) => fmt(getValue() as number, 0),
    },
    {
      accessorKey: "entryPrice",
      header: "Entry",
      cell: ({ getValue }) => `$${fmt(getValue() as number)}`,
    },
    {
      accessorKey: "exitPrice",
      header: "Exit",
      cell: ({ getValue }) =>
        getValue() ? `$${fmt(getValue() as number)}` : "—",
    },
    {
      accessorKey: "netPnl",
      header: "Net P&L",
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        if (v == null) return "—";
        return (
          <span
            className={
              v >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"
            }
          >
            ${fmt(v)}
          </span>
        );
      },
    },
    {
      accessorKey: "side",
      header: "Side",
      cell: ({ getValue }) => (
        <Badge variant={getValue() === "LONG" ? "default" : "secondary"}>
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: "expiration",
      header: "Expiry",
      cell: ({ getValue }) => (getValue() ? fmtDate(getValue() as Date) : "—"),
    },
    {
      id: "setups",
      header: "Setups",
      cell: ({ row }) =>
        row.original.tradeSetups.map((ts) => (
          <Badge key={ts.setupId} variant="outline" className="mr-1 text-xs">
            {ts.setup.name}
          </Badge>
        )),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ getValue }) =>
        getValue() === "TS_IMPORT" ? (
          <Badge className="bg-blue-500 text-white text-xs">TS</Badge>
        ) : null,
    },
  ];

  const openColumns: ColumnDef<TableTrade>[] = [
    { accessorKey: "name", header: "Name", size: 160 },
    {
      id: "daysOpen",
      header: "Days Open",
      cell: ({ row }) => daysSince(row.original.openDate),
    },
    {
      accessorKey: "openDate",
      header: "Open Date",
      cell: ({ getValue }) => fmtDate(getValue() as Date),
    },
    {
      accessorKey: "ticker",
      header: "Ticker",
      cell: ({ getValue }) => (
        <span className="font-mono">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "symbol",
      header: "Symbol",
      size: 180,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ getValue }) => fmt(getValue() as number, 0),
    },
    {
      accessorKey: "entryPrice",
      header: "Entry",
      cell: ({ getValue }) => `$${fmt(getValue() as number)}`,
    },
    {
      accessorKey: "projectedProfit",
      header: "Proj. Profit",
      cell: ({ getValue }) =>
        getValue() ? `$${fmt(getValue() as number)}` : "—",
    },
    {
      accessorKey: "side",
      header: "Side",
      cell: ({ getValue }) => (
        <Badge variant={getValue() === "LONG" ? "default" : "secondary"}>
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: "expiration",
      header: "Expiry",
      cell: ({ getValue }) => (getValue() ? fmtDate(getValue() as Date) : "—"),
    },
    {
      id: "setups",
      header: "Setups",
      cell: ({ row }) =>
        row.original.tradeSetups.map((ts) => (
          <Badge key={ts.setupId} variant="outline" className="mr-1 text-xs">
            {ts.setup.name}
          </Badge>
        )),
    },
  ];

  const columns = variant === "open" ? openColumns : closedColumns;

  const table = useReactTable({
    data: trades,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totalPages = Math.ceil(total / perPage);
  const pageTotalProjProfit =
    projProfitTotal ??
    table
      .getRowModel()
      .rows.reduce((s, r) => s + (r.original.projectedProfit ?? 0), 0);
  const pageTotalNetPnl =
    netPnlTotal ??
    table.getRowModel().rows.reduce((s, r) => s + (r.original.netPnl ?? 0), 0);

  const activeFilterCount =
    selectedTickers.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search ticker, name, symbol…"
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              navigate({ q: e.target.value, page: 1 }, true);
            }, 300);
          }}
          className="max-w-xs"
        />

        {/* Ticker filter — styled like a Select */}
        {availableTickers.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-7 items-center gap-1.5 rounded-md border border-input bg-input/20 px-2 text-xs/relaxed whitespace-nowrap transition-colors outline-none hover:bg-input/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30">
                {selectedTickers.length > 0
                  ? `${selectedTickers.length} ticker${selectedTickers.length > 1 ? "s" : ""}`
                  : "Tickers"}
                <HugeiconsIcon
                  icon={UnfoldMoreIcon}
                  strokeWidth={2}
                  className="size-3.5 text-muted-foreground shrink-0"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {availableTickers.map((ticker) => (
                  <label
                    key={ticker}
                    className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedTickers.includes(ticker)}
                      onCheckedChange={() => toggleTicker(ticker)}
                    />
                    <span className="font-mono">{ticker}</span>
                  </label>
                ))}
              </div>
              {selectedTickers.length > 0 && (
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-xs"
                  onClick={() => navigate({ tickers: "", page: 1 })}
                >
                  Clear
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Date range filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              Date range
              {(dateFrom || dateTo) && (
                <Badge className="h-4 px-1 text-[10px]">
                  {(dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  From
                </p>
                <DatePicker
                  name="dateFrom"
                  value={dateFrom || undefined}
                  onValueChange={(v) => navigate({ dateFrom: v, page: 1 })}
                  placeholder="Start"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">To</p>
                <DatePicker
                  name="dateTo"
                  value={dateTo || undefined}
                  onValueChange={(v) => navigate({ dateTo: v, page: 1 })}
                  placeholder="End"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() =>
              navigate({ tickers: "", dateFrom: "", dateTo: "", page: 1 })
            }
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {{ asc: " ↑", desc: " ↓" }[
                      header.column.getIsSorted() as string
                    ] ?? ""}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium w-10">
                  Actions
                </th>
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {isPending ? (
              <SkeletonRows cols={columns.length + 1} />
            ) : (
              <>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                          >
                            ···
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditTrade(row.original)}
                          >
                            Edit
                          </DropdownMenuItem>
                          {variant === "open" && (
                            <DropdownMenuItem
                              onClick={() => setClosingTrade(row.original)}
                            >
                              Close
                            </DropdownMenuItem>
                          )}
                          {variant === "open" && row.original.optionType && (
                            <DropdownMenuItem
                              onClick={() => setRollingTrade(row.original)}
                            >
                              Roll
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeletingTrade(row.original)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No trades
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
          {variant === "open" && total > 0 && (
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                  Total Proj. Profit
                </td>
                <td className="px-3 py-2 text-right text-sm font-medium">
                  ${fmt(pageTotalProjProfit)}
                </td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
          {variant !== "open" && total > 0 && (
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-2 text-right text-sm font-medium text-muted-foreground"
                >
                  Total Net P&L
                </td>
                <td className="px-3 py-2 text-right text-sm font-medium">
                  <span
                    className={
                      pageTotalNetPnl >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    ${fmt(pageTotalNetPnl)}
                  </span>
                </td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => navigate({ perPage: v, page: 1 })}
          >
            <SelectTrigger className="w-14">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {`|`}
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} total
          </p>
          {totalPages > 1 && (
            <Pagination className="w-auto mx-0 ml-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={(e) => {
                      e.preventDefault();
                      navigate({ page: page - 1 });
                    }}
                    aria-disabled={page <= 1}
                    className={
                      page <= 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                {pageNumbers(page, totalPages).map((p, i) => (
                  <PaginationItem key={i}>
                    {p === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={(e) => {
                          e.preventDefault();
                          navigate({ page: p });
                        }}
                        isActive={p === page}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={(e) => {
                      e.preventDefault();
                      navigate({ page: page + 1 });
                    }}
                    aria-disabled={page >= totalPages}
                    className={
                      page >= totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {editTrade && (
        <TradeForm
          key={editTrade.id}
          open={!!editTrade}
          onOpenChange={(o) => {
            if (!o) setEditTrade(null);
          }}
          accounts={accounts}
          setups={setups}
          trade={editTrade as TradeFormTrade}
        />
      )}

      {closingTrade && (
        <CloseTradeDialog
          key={`close-${closingTrade.id}`}
          open={!!closingTrade}
          onOpenChange={(o) => {
            if (!o) setClosingTrade(null);
          }}
          trade={{
            id: closingTrade.id,
            ticker: closingTrade.ticker,
            symbol: closingTrade.symbol,
            side: closingTrade.side,
            entryPrice: closingTrade.entryPrice,
            quantity: closingTrade.quantity,
            contractSize: closingTrade.contractSize,
            optionType: closingTrade.optionType,
            projectedProfit: closingTrade.projectedProfit,
          }}
          assignmentFee={
            accounts.find((a) => a.id === closingTrade.accountId)
              ?.optionAssignmentFee ?? 0
          }
        />
      )}

      {rollingTrade && (
        <RollTradeDialog
          key={`roll-${rollingTrade.id}`}
          open={!!rollingTrade}
          onOpenChange={(o) => {
            if (!o) setRollingTrade(null);
          }}
          trade={{
            id: rollingTrade.id,
            ticker: rollingTrade.ticker,
            symbol: rollingTrade.symbol,
            side: rollingTrade.side,
            entryPrice: rollingTrade.entryPrice,
            quantity: rollingTrade.quantity,
            contractSize: rollingTrade.contractSize,
            optionType: rollingTrade.optionType,
            strike: rollingTrade.strike,
            expiration: rollingTrade.expiration
              ? new Date(rollingTrade.expiration).toISOString()
              : null,
            projectedProfit: rollingTrade.projectedProfit,
          }}
        />
      )}

      <AlertDialog
        open={!!deletingTrade}
        onOpenChange={(o) => {
          if (!o) setDeletingTrade(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trade?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTrade
                ? `This will permanently delete "${deletingTrade.name}" (${deletingTrade.ticker}). This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deletingTrade) await deleteTrade(deletingTrade.id);
                setDeletingTrade(null);
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
