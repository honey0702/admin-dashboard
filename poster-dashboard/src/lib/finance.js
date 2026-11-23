/**
 * Pure finance & inventory selectors.
 * Everything derives from the local dataset (designs, sales, expenses) so the
 * dashboard, daily summary and analytics can never drift apart — the same
 * numbers flow everywhere.
 */

import { startOfDay, subDays, isSameDay, format } from './dates';
export { startOfDay };

/* ---------- date range helpers ---------- */

export const RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

export function rangeBounds(range, now = new Date()) {
  const today = startOfDay(now);
  switch (range) {
    case 'today':
      return { from: today, to: now };
    case 'yesterday': {
      const y = subDays(today, 1);
      return { from: y, to: today };
    }
    case '7d':
      return { from: subDays(today, 6), to: now };
    case '30d':
      return { from: subDays(today, 29), to: now };
    case '90d':
      return { from: subDays(today, 89), to: now };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'last-month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to };
    }
    case 'all':
    default:
      return { from: null, to: now };
  }
}

export function inRange(iso, from, to) {
  const t = new Date(iso).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export const completedSales = (sales) => sales.filter((s) => s.status === 'completed');

export function salesInRange(sales, from, to) {
  return completedSales(sales).filter((s) => inRange(s.date, from, to));
}

/* ---------- inventory view (merges sales into designs) ---------- */

export function designUnitCost(design) {
  const batches = design.batches || [];
  const copies = batches.reduce((a, b) => a + Number(b.copies || 0), 0);
  if (!copies) return Number(design.printCost || 0) + Number(design.sleeveCost || 0);
  const cost = batches.reduce((a, b) => a + b.copies * (Number(b.printCost) + Number(b.sleeveCost)), 0);
  return cost / copies;
}

export function inventoryView(designs, sales) {
  const soldByDesign = new Map();
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    for (const line of sale.lines) {
      soldByDesign.set(line.designId, (soldByDesign.get(line.designId) || 0) + line.qty);
    }
  }
  return designs.map((d) => {
    const planned = (d.batches || []).reduce((a, b) => a + b.copies, 0);
    const sold = soldByDesign.get(d.id) || 0;
    const damaged = Number(d.damaged || 0);
    const remaining = d.quantity != null ? Number(d.quantity) : Math.max(0, planned - sold - damaged);
    const unitCost = d.avgCost != null ? Number(d.avgCost) : designUnitCost(d);
    const stockValue = remaining * unitCost;
    return { ...d, planned, sold, damaged, remaining, unitCost, stockValue };
  });
}

/* ---------- totals ---------- */

export function totals(salesSubset) {
  const list = Array.isArray(salesSubset) ? salesSubset.filter((s) => s.status === 'completed') : [];
  const gross = list.reduce((a, s) => a + s.gross, 0);
  const discount = list.reduce((a, s) => a + s.discount, 0);
  const net = list.reduce((a, s) => a + s.net, 0);
  const posters = list.reduce((a, s) => a + s.lines.reduce((x, l) => x + l.qty, 0), 0);
  const cogs = list.reduce((a, s) => a + s.lines.reduce((x, l) => x + (l.unitCost || 0) * l.qty, 0), 0);
  const byPayment = { Cash: 0, UPI: 0, Other: 0 };
  for (const s of list) byPayment[s.payment] = (byPayment[s.payment] || 0) + s.net;
  const count = list.length;
  return {
    gross,
    discount,
    net,
    posters,
    cogs,
    count,
    byPayment,
    grossProfit: net - cogs,
    avgTicket: count ? net / count : 0,
    postersPerTxn: count ? posters / count : 0,
    avgDiscount: count ? discount / count : 0,
  };
}

export function expensesInRange(expenses, from, to) {
  return expenses.filter((e) => inRange(e.date, from, to));
}

export function expenseTotal(expenses) {
  return expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
}

/* ---------- daily series for charts ---------- */

export function dailySeries(sales, days, now = new Date()) {
  const today = startOfDay(now);
  const done = completedSales(sales);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i);
    const daySales = done.filter((s) => isSameDay(new Date(s.date), day));
    const t = totals(daySales);
    out.push({
      date: day.toISOString(),
      label: format(day, 'd MMM'),
      revenue: t.net,
      gross: t.gross,
      posters: t.posters,
      transactions: t.count,
    });
  }
  return out;
}

/* ---------- category & design rankings ---------- */

export function categoryRevenue(designs, sales) {
  const map = new Map();
  for (const sale of completedSales(sales)) {
    for (const line of sale.lines) {
      const design = designs.find((d) => d.id === line.designId);
      const cat = design?.category || 'Other';
      const cur = map.get(cat) || { name: cat, net: 0, posters: 0, value: 0 };
      cur.net += line.qty * line.unitPrice - 0; // pre-discount value; discounts are sale-level
      cur.posters += line.qty;
      map.set(cat, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export function topDesigns(designs, sales, n = 5) {
  const map = new Map();
  for (const sale of completedSales(sales)) {
    for (const line of sale.lines) {
      const cur = map.get(line.designId) || { id: line.designId, name: line.name, category: '', posters: 0, net: 0 };
      cur.posters += line.qty;
      cur.net += line.qty * line.unitPrice;
      map.set(line.designId, cur);
    }
  }
  const list = [...map.values()].map((e) => {
    const d = designs.find((x) => x.id === e.id);
    return { ...e, category: d?.category || '' };
  });
  return list.sort((a, b) => b.posters - a.posters).slice(0, n);
}

export function slowestDesigns(designs, sales, n = 5) {
  const soldMap = new Map();
  for (const sale of completedSales(sales)) {
    for (const line of sale.lines) soldMap.set(line.designId, (soldMap.get(line.designId) || 0) + line.qty);
  }
  return designs
    .filter((d) => !d.archived)
    .map((d) => ({ id: d.id, name: d.name, category: d.category, posters: soldMap.get(d.id) || 0 }))
    .sort((a, b) => a.posters - b.posters)
    .slice(0, n);
}

/* ---------- discount rules ---------- */

/**
 * Best applicable rule for a poster quantity.
 * Rules are tiered — e.g. 3+ posters save ₹40, 5+ save ₹50 — so we apply the
 * highest enabled threshold the cart qualifies for.
 */
export function suggestedDiscount(qty, rules) {
  const applicable = (rules || []).filter((r) => r.enabled && qty >= r.qty).sort((a, b) => b.qty - a.qty);
  return applicable.length ? applicable[0].save : 0;
}
