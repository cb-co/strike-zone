# Strike Zone — Design Spec

**Date:** 2026-04-28  
**Status:** Approved

## Overview

Strike Zone is a personal trading tracker web app replacing a Notion-based system. It tracks stock and options trades using swing trading and the wheel strategy on ETFs (SOXL, TQQQ, UAMY, SLV). The app is built for a single developer initially but designed for multi-user SaaS from day one. Supabase is the source of truth; TradeStation is an optional data source that can be connected later — all features work without it.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (CSS-first, `globals.css`) |
| Components | shadcn/ui `radix-mira` style, HugeIcons |
| Database ORM | Prisma v7 (client → `src/generated/prisma`) |
| Auth + DB | Supabase (Postgres + Supabase Auth) |
| Charts | Recharts |
| Tables | TanStack Table v8 |
| Deployment | Vercel |

---

## Architecture

**Pattern:** Server Components + Server Actions (Option A). Pages are async Server Components that fetch data directly via Prisma. Client Components receive data as props and handle interactivity. Server Actions handle all mutations. Route Handlers exist only for the TradeStation OAuth integration.

**Multi-user:** Every DB table carries `user_id` referencing `auth.users`. All Prisma queries filter by the authenticated user's ID. Supabase RLS is enabled as a safety net. The app is fully functional for any number of users.

**Session management:** `proxy.ts` (Next.js 16 renamed middleware) refreshes the Supabase session cookie on every request and redirects unauthenticated users to `/login`.

**Data flow (reads):**
1. `proxy.ts` refreshes session
2. Server Component calls `supabase.auth.getUser()` → `userId`
3. Prisma query with `WHERE user_id = userId`
4. Data passed as props to Client Components

**Data flow (writes):** Server Actions called from Client Components via form actions or `startTransition`. Each action re-validates the relevant route on success.

---

## Database Schema

### `accounts`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| name | text | |
| broker | text | e.g. "TradeStation" |
| description | text? | |
| is_active | bool | default true |
| is_main | bool | default false; enforced by partial unique index `UNIQUE (user_id) WHERE is_main = true` |
| starting_balance | decimal | default 0 |
| commission_per_option | decimal | default 0 |
| commission_per_stock | decimal | default 0 |
| option_assignment_fee | decimal | default 0 |
| created_at | timestamptz | |

**Computed (not stored):** `current_balance = starting_balance + SUM(net_pnl) WHERE account_id = this AND close_date IS NOT NULL`

### `instruments`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| ticker | text | e.g. "SOXL" |
| name | text | e.g. "Direxion Daily Semiconductor Bull 3X" |
| type | enum | `ETF \| STOCK \| CRYPTO` |
| description | text? | |
| created_at | timestamptz | |

### `setups`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| name | text | e.g. "wheel", "buy-dip" |
| description | text? | |
| created_at | timestamptz | |

### `trades`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| account_id | uuid FK → accounts | |
| instrument_id | uuid? FK → instruments | nullable; ticker always stored directly |
| name | text | custom label |
| ticker | text | underlying (e.g. "SOXL"); always stored even for imported trades |
| symbol | text | full symbol (e.g. "SOXL250417P00012000" or "SOXL" for stock) |
| side | enum | `LONG \| SHORT` |
| quantity | decimal | |
| entry_price | decimal | |
| open_date | date | |
| source | enum | `MANUAL \| TS_IMPORT` |
| exit_price | decimal? | null if open |
| close_date | date? | null if open |
| projected_profit | decimal? | manual estimate for open trades |
| net_pnl | decimal? | computed and stored when trade is closed (see formula) |
| notes | text? | |
| option_type | enum? | `CALL \| PUT`; null for stock trades |
| strike | decimal? | null for stock trades |
| expiration | date? | null for stock trades |
| contract_size | int? | default 100; null for stock trades |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`net_pnl` formula (stored on close):**
- LONG: `(exit_price − entry_price) × quantity × (contract_size ?? 1)`
- SHORT: `(entry_price − exit_price) × quantity × (contract_size ?? 1)`

**Note:** Options validation — if `option_type` is set, `strike` and `expiration` are required. Stock trades leave options fields null.

### `trade_setups`
| Field | Type |
|---|---|
| trade_id | uuid FK → trades |
| setup_id | uuid FK → setups |

Composite PK on `(trade_id, setup_id)`.

### `goals`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| account_id | uuid FK → accounts | |
| year | int | e.g. 2025 |
| goal_amount | decimal | total target P&L for the year |
| curve_factor | decimal | shapes growth curve (1.0 = linear, >1 = back-loaded, <1 = front-loaded) |
| monthly_fixed_wd | decimal | fixed dollar withdrawal per month, default 0 |
| monthly_variable_wd_pct | decimal | percentage of monthly P&L withdrawn, default 0 |
| created_at | timestamptz | |

**Goal math (computed in `src/lib/goals.ts`):**

```ts
// Beginning of Month progress for month m (1–12)
BOM(m) = Math.pow(Math.max(0, Math.min(1, (m - 1) / 12)), curve_factor)

// End of Month progress
EOM(m) = Math.pow(Math.min(1, m / 12), curve_factor)

// Expected P&L for month m
monthlyExpected(m) = goal_amount * (EOM(m) - BOM(m))

// Expected variable withdrawal for month m
monthlyVarWD(m) = monthlyExpected(m) * monthly_variable_wd_pct

// Expected total needed (P&L to cover goal + withdrawals)
monthlyTotal(m) = monthlyExpected(m) + monthly_fixed_wd + monthlyVarWD(m)

// Year-to-date expected progress (as of today)
yearProgress = dayOfYear(today) / 365
expectedCumPct = Math.pow(yearProgress, curve_factor)
expectedCumPnL = goal_amount * expectedCumPct
```

**Goal → Trades link:** No direct FK. Monthly P&L for a goal is `SUM(net_pnl) WHERE account_id = goal.account_id AND YEAR(close_date) = goal.year AND MONTH(close_date) = m`.

### `monthly_snapshots`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| account_id | uuid FK → accounts | |
| year | int | |
| month | int | 1–12 |
| starting_balance | decimal | |
| ending_balance | decimal | |
| created_at | timestamptz | |

### `tradestation_tokens`
| Field | Type | Notes |
|---|---|---|
| user_id | uuid PK FK → auth.users | one row per user |
| access_token | text | |
| refresh_token | text | |
| expires_at | timestamptz | |
| updated_at | timestamptz | |

---

## Routing & File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          # email + password login
│   ├── (app)/
│   │   ├── layout.tsx              # sidebar shell + auth guard
│   │   ├── dashboard/page.tsx
│   │   ├── trades/page.tsx         # tabbed table
│   │   ├── goals/page.tsx
│   │   ├── monthly/page.tsx        # monthly performance
│   │   ├── accounts/page.tsx
│   │   ├── instruments/page.tsx
│   │   └── system/page.tsx         # TS connect + setups CRUD
│   ├── api/tradestation/
│   │   ├── authorize/route.ts      # redirect to TS OAuth
│   │   ├── callback/route.ts       # exchange code → store tokens
│   │   └── sync/route.ts           # import trades from TS API
│   └── layout.tsx                  # root: fonts, metadata
├── actions/
│   ├── trades.ts
│   ├── goals.ts
│   ├── accounts.ts
│   ├── instruments.ts
│   └── setups.ts
├── lib/
│   ├── prisma.ts                   # client singleton
│   ├── supabase/
│   │   ├── server.ts               # createServerClient
│   │   └── client.ts               # createBrowserClient
│   ├── goals.ts                    # BOM/EOM math, monthly breakdown
│   ├── trades.ts                   # net_pnl calculation
│   └── tradestation.ts             # TS API client (token refresh, fetch orders)
└── components/
    ├── ui/                         # shadcn components
    ├── trades-table.tsx            # TanStack Table client component
    ├── equity-chart.tsx            # Recharts area chart
    ├── goal-card.tsx
    └── sidebar.tsx
proxy.ts                            # session refresh (Next.js 16)
```

---

## Pages

### Dashboard (`/dashboard`)

**Layout A:** 4 KPI cards → [Equity Chart | Goal Progress + Open Positions]

**Scoping:** All KPIs and charts are scoped to the user's **main account** (`is_main = true`) and **current year** by default.

**KPI cards:**
- **Monthly P&L** — `SUM(net_pnl)` for the current calendar month on the main account, delta vs prior month
- **Win Rate** — trades where `net_pnl > 0` / total closed trades on the main account, current year. A "winning trade" is any closed trade with `net_pnl > 0`.
- **Open Risk** — `SUM(entry_price × quantity × (contract_size ?? 1))` for all open trades on the main account
- **% Return** — `SUM(net_pnl) / main_account.starting_balance × 100` (YTD, main account)

**Equity Chart (Recharts `AreaChart`):**
- X axis: months of current year
- Actual line: cumulative `net_pnl` + `starting_balance` per month (main account)
- Expected dashed line: `starting_balance + expectedCumPnL` per month from goal math
- Data source: `monthly_snapshots` + running trade P&L for current month

**Goal Progress:** The goal shown is the one linked to the main account for the current year (`goals WHERE account_id = mainAccount.id AND year = currentYear`). If none exists, the goal section is hidden with a prompt to create one.
- Two stacked progress bars: actual % vs expected %
- Labels: Actual $X · Expected $Y · Goal $Z

**Open Positions mini-table:** ticker, side badge, entry, projected profit. Top 5 by open date.

---

### Trades (`/trades`)

Tabbed page. All tabs share a page-level "Add Trade" button and search/filter bar.

| Tab | Content |
|---|---|
| **Calendar** | Month grid (7-col). Each day with closed trades shows net P&L and trade count, green/red left border. Month navigation arrows. Running month total in header. |
| **Closed** | TanStack Table: Name, Days, Open Date, Close Date, Ticker, Symbol, Qty, Entry, Exit, Net P&L, Side, Expiry, Setups, Source. Year filter + search. |
| **Open** | TanStack Table: Name, Days Open, Open Date, Ticker, Symbol, Qty, Entry, Projected Profit, Side, Expiry, Setups, Notes. Running open risk in header. |
| **By Ticker** | Grouped rows: Ticker, trade count, win rate, net P&L, avg days. Expandable to show individual trades. Defaults to current year; year filter applies. |
| **Setups** | Grouped by setup tag: setup name, trade count, win rate, net P&L. Untagged trades listed separately. |
| **Losses** | Same columns as Closed, pre-filtered to `net_pnl < 0`, default sorted worst-first. |

**Source badge:** `TS` amber badge on rows imported from TradeStation. Manual trades have no badge.

**Trade form (sheet/drawer):** Opens for Add and Edit. Fields adapt based on trade type — options fields (strike, expiry, contract size, option type) shown only when relevant.

---

### Goals (`/goals`)

List of goal cards, one per year/account combination.

**Goal card:**
- Header: year, account, goal amount, key stats (actual P&L, expected, gap, curve factor)
- Body: dual progress bars (actual vs expected), 12-month mini bar chart
- Footer: fixed WD, variable WD %, "View monthly breakdown →" link
- Completed goals (past year) collapsed to minimal card with COMPLETED badge

**New Goal form:** year, account selector, goal amount, curve factor, monthly fixed WD, monthly variable WD %.

---

### Monthly Performance (`/monthly`)

Goal selector at top (defaults to current year's active goal).

**Summary KPIs (4 cards):** Goal Amount, Actual YTD P&L, Expected YTD, Gap.

**12-row breakdown table:**
| Month | Expected P&L | Exp. Variable WD | Exp. Total (incl. WD) | Actual P&L | vs Expected | Cumulative Actual | Cumulative Expected |
|---|---|---|---|---|---|---|---|

- Actual P&L = `SUM(net_pnl)` for that month from trades
- Future months: actual columns dimmed as "—", delta shows "future" badge
- Current month: row highlighted in purple

---

### Accounts (`/accounts`)

CRUD table of accounts. Inline edit. "Set as Main" action. Displays `current_balance` (computed) alongside `starting_balance`.

---

### Instruments (`/instruments`)

CRUD table: ticker, name, type, description. Used as optional reference for trades.

---

### System (`/system`)

Two sections:

**TradeStation Integration:**
- Connection status (connected / not connected)
- Connect button → triggers OAuth flow
- Disconnect button → deletes token row
- Manual "Sync Now" button → POST `/api/tradestation/sync`
- Last synced timestamp

**Setups Management:**
- CRUD list of setup tags (name, description)
- Used for tagging trades

---

## TradeStation OAuth Flow

All features work without TradeStation connected — it is an optional data source only.

1. User clicks "Connect TradeStation" → GET `/api/tradestation/authorize`
   - Builds TS OAuth authorization URL with `client_id`, `redirect_uri`, `scope`, `state` (CSRF token stored in session)
   - Redirects browser to TradeStation

2. TradeStation redirects to `/api/tradestation/callback?code=...&state=...`
   - Validates `state` against session
   - Exchanges `code` for `access_token` + `refresh_token`
   - Upserts row in `tradestation_tokens` for this user
   - Redirects to `/system`

3. User clicks "Sync Now" → POST `/api/tradestation/sync`
   - Reads token from `tradestation_tokens`
   - If `expires_at` < now: refreshes token, updates row
   - Fetches orders from TradeStation API
   - Maps orders to trade schema, upserts by `symbol + open_date` with `source = TS_IMPORT`
   - Returns count of new / updated trades

**`src/lib/tradestation.ts`** encapsulates all TS API calls (token refresh, fetch orders, field mapping). Route handlers are thin — they authenticate the user and delegate to this lib.

---

## Auth

- Supabase Auth with email + password
- Single `/login` page (no signup — invite-only or self-serve configurable via Supabase dashboard)
- `proxy.ts` calls `supabase.auth.getUser()` on every request; unauthenticated requests redirect to `/login`
- Server Components get user via `createServerClient` from `@supabase/ssr`

---

## Key Libraries to Install

The following are referenced in the design but not yet in `package.json`:

- `recharts` — equity chart
- `@tanstack/react-table` — trade tables
- `@supabase/ssr` — server-side Supabase client for App Router

---

## Out of Scope (this iteration)

- Real-time price feeds or live P&L updates
- Mobile app
- Email notifications or alerts
- Multi-account portfolio aggregation across users
- TradeStation historical import beyond current positions/orders
