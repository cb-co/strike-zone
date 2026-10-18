# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the author, an options income trader who sells premium (cash-secured puts, covered calls, rolls, assignments) on a main brokerage account against a yearly income goal. Keeps the app open on a desktop monitor next to the broker platform during market hours and checks it throughout the session.

Future: other options traders. It is personal today, but it should look and behave like a real product others could adopt.

## Product Purpose

A trading journal and income tracker. It records every trade (stock, ETF, crypto, and options with strike/expiration/contract size), computes net P&L after commissions and assignment fees, and measures progress against a yearly goal that follows a curve and accounts for monthly withdrawals. Success means the trader always knows, at a glance: what's open and at risk, what this month and year have earned, and whether they are on pace.

## Positioning

Built around the options seller's ledger rather than a generic stock portfolio: strikes, expirations, rolls, assignments, projected profit on open premium, and a curved income goal with planned withdrawals. It is not a brokerage and does not place trades.

## Operating Context

- Desktop-first, market hours, beside the broker platform (TradeStation).
- Trades arrive by manual entry, QFX file import, or TradeStation OAuth sync.
- Cash activity (margin interest, dividends, interest, taxes, deposits, withdrawals) is imported and counts toward P&L.
- Setups (strategy tags) group trades for analysis.

## Capabilities and Constraints

- Routes: Dashboard (KPIs, equity vs goal chart, open positions, P&L calendar), Trades (table plus by-ticker, by-setup, and calendar tabs, with close and roll dialogs), Goals, Monthly breakdown, Accounts (with cash activity), Instruments, System (setups, TradeStation connection).
- Multiple accounts, one marked main. The dashboard reads the main account.
- Stack: Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (radix-mira), HugeIcons, Recharts, Prisma, Supabase auth.
- Currently supports light and dark mode plus five palette themes. The owner cleared all of these for replacement.

## Brand Commitments

None binding. The owner said "nothing sacred": data, features, and behavior must survive, and the name, themes, and look may all change.

## Evidence on Hand

Real trade data lives in the owner's database, and sample QFX exports are in `data/`. There are no testimonials, customers, or marketing claims, and none should be invented.

## Product Principles

1. Glanceable truth first: open risk, month-to-date, and pace-to-goal must read in one look during a trading session.
2. Numbers are the interface: figures are precise and aligned, and gains and losses are never ambiguous.
3. The options seller's vocabulary is the model: strikes, expirations, rolls, and assignments are first-class, not bolted onto a stock tracker.
4. Fast entry and correction: logging, closing, and rolling a trade must not interrupt a live session.
