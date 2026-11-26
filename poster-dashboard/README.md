# Rang Poster Co. — Poster Business Management Dashboard

A full poster-stall operations app in one calm screen: sales, inventory (with per-batch print + sleeve costing), expenses, daily closing sheets and home-delivery customer orders. Built for a stall market in Surat, India — prices in ₹, brief example bills (₹60/poster, 3 posters save ₹40, 5 save ₹50).

## Stack

React 19 · Vite 8 · Tailwind CSS 4 · shadcn-style UI (hand-built in `src/components/ui`) · Recharts 3 · Framer Motion · Lucide icons · Hash-based routing (React Router 7)

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

State persists to `localStorage` (`rang-poster-co:v1`) — no backend required for the demo. Data resets via **Settings → Data & backup → Reset demo data**.

## What works today (not a static mockup)

- **Overview** (`/`) — the four headline KPIs, 14-day sales chart, recent sales, **best sellers by units (last 30 days)** and low-stock alerts, all on one screen.
- **New Sale** (`/sales/new`) — searchable catalogue, quantity steppers with live stock caps, automatic tiered combo discounts (3+ → ₹40, 5+ → ₹50, configurable), no-discount/custom override, ₹-bill preview, Cash/UPI/Other capture. Completing a sale updates inventory, sales log, dashboard and daily summary instantly.
- **Sales log** (`/sales`) — filter by range/payment/status/search, CSV export, detail dialog with line items, COGS and gross profit, cancel-with-reason (history is kept, stock is restored).
- **Inventory** (`/inventory`) — sortable/filterable table, add designs, edit metadata, per-batch restocks (historical batch costs preserved → weighted-average COGS), damaged-stock log, archive/restore. Live stock value at cost.
- **Home Delivery** (`/home-delivery`) — action queue, waiting-for-stock radar (which customers queued for which out-of-stock design, with tel: links), status pipeline (Request Received → Waiting for Stock → Ready for Pickup / Out for Delivery → Delivered / Not Delivered / Cancelled). Fulfilling an order **creates a real sale** — nothing pending ever counts as revenue.
- **Expenses** (`/expenses`) — one-time vs recurring, custom categories, search/filter, CSV export, monthly breakdown. Printing/sleeve costs are deliberately excluded (they live in inventory as COGS).
- **Daily Summary** (`/daily-summary`) — auto-generated closing sheet per date: transactions, posters, gross/discounts/net, payment-method split, COGS, expenses, gross & operating profit, 14-day ledger, CSV export.
- **Settings** (`/settings`) — business profile, discount rules CRUD, categories, default price / low-stock threshold / break-even target, JSON backup download & restore, access matrix, API status panel.

Global: Ctrl/⌘+K command palette (designs, sales, orders, pages, actions), low-stock + waiting-order notifications bell, sidebar break-even meter, toasts.

## Design system

| Token | Value |
|---|---|
| Background | `#F8F7F2` warm off-white |
| Cards | `#FFFFFF`, `border #E8E9E3`, soft warm shadow |
| Primary | Forest Green `#173D35` (soft sage `#E5E9DF` for active/selected states) |
| Text | near-black green `#202923`, muted `#858B83` |
| Success / Warning / Danger | `#39845F` / `#D49A42` / `#C85A4A` |
| Type | Inter Variable (UI, tabular numerals) + Fraunces Variable (brand wordmark, hero figures) |

Motion: route fade + slight rise, layout-animated sidebar active indicator, chart draw-in, count-up KPIs, hover-lift cards, slide-in toasts, skeleton shimmer loading — all ~200–350 ms, reduced-motion aware (`MotionConfig reducedMotion="user"`, CSS `prefers-reduced-motion` guard).

## Architecture

```
src/
  lib/        dates, formatters (en-IN/₹), CSV/JSON export
  lib/finance.js   pure selectors: inventoryView, totals, dailySeries, ranges,
                   categoryRevenue, topDesigns, suggestedDiscount
  lib/api.js       Django REST Framework client (endpoint map, token auth)
  data/seed.js     deterministic sample dataset (relative to today)
  context/AppContext.jsx   single source of truth — every mutation goes through
                   named actions; persistence + toasts live here
  components/ ui/ primitives + layout/ (Sidebar, Header, MobileActionBar) + widgets
  pages/      one file per screen
```

### Wiring the Django REST backend

1. Set `VITE_API_BASE_URL=https://api.rangposterco.in/api` at build time.
2. Implement the DRF resources mapped in `src/lib/api.js` (`/sales/`, `/designs/` + `/batches/`, `/orders/` + `/fulfill/`, `/reports/daily/`, …).
3. Swap `AppContext` action internals for `api.*` calls (optimistic updates recommended). The UI is written against the resource shapes already, so no page code changes.
4. Staff permissions, offline-first sync (PWA), backups and Excel import/export are backend concerns; the Settings screen already surfaces the expected contract.

### Data rules honoured

Inventory costing (print + sleeve) stays in inventory/COGS — never double-counted in expenses · pending orders never touch sales/stock · delivered orders become sales through one fulfilment path · discounts never exceed the bill · archived designs keep their history · cancelled sales restore stock and keep an audit trail.
