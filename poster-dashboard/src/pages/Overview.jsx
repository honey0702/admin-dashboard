import { useMemo } from 'react';
import { IndianRupee, PiggyBank, Layers3, Boxes } from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { SalesChart } from '../components/SalesChart';
import { RecentSales } from '../components/RecentSales';
import { BestSellers } from '../components/BestSellers';
import { LowStock } from '../components/LowStock';
import { useApp } from '../context/AppContext';
import { salesInRange, expensesInRange, expenseTotal, totals, inventoryView } from '../lib/finance';
import { subDays, startOfDay } from '../lib/dates';
import { inr } from '../lib/utils';

const deltaPct = (cur, prev) => {
  if (!prev || Math.abs(prev) < 1e-9) return undefined;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

/**
 * Overview — the business at a glance in five seconds:
 * four figures, one chart, latest activity, stock that needs reordering.
 */
export default function Overview() {
  const { state } = useApp();
  const { sales, expenses, designs } = state;

  const { cur, prev, profit, prevProfit, stockUnits, stockValue } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const from = subDays(today, 29);
    const prevFrom = subDays(today, 59);
    const prevTo = subDays(from, 1);

    const cur = totals(salesInRange(sales, from, now));
    const prev = totals(salesInRange(sales, prevFrom, new Date(prevTo.getTime() + 86399999)));
    const profit = cur.net - cur.cogs - expenseTotal(expensesInRange(expenses, from, now));
    const prevProfit = prev.net - prev.cogs - expenseTotal(expensesInRange(expenses, prevFrom, new Date(prevTo.getTime() + 86399999)));

    const inv = inventoryView(designs, sales);
    const stockUnits = inv.reduce((a, d) => a + (d.archived ? 0 : d.remaining), 0);
    const stockValue = inv.reduce((a, d) => a + (d.archived ? 0 : d.stockValue), 0);
    return { cur, prev, profit, prevProfit, stockUnits, stockValue };
  }, [sales, expenses, designs]);

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* Four essential figures — nothing else competes for attention */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard index={0} label="Revenue" value={cur.net} format="inr" delta={deltaPct(cur.net, prev.net)} icon={IndianRupee} tone="primary" foot="net, 30 days" />
        <KpiCard index={1} label="Net profit" value={profit} format="inr" delta={deltaPct(profit, prevProfit)} icon={PiggyBank} tone="success" foot="after COGS + spend" />
        <KpiCard index={2} label="Posters sold" value={cur.posters} format="num" delta={deltaPct(cur.posters, prev.posters)} icon={Layers3} tone="ink" foot="last 30 days" />
        <KpiCard index={3} label="In stock" value={stockUnits} format="num" icon={Boxes} tone="warning" foot={`≈ ${inr(stockValue)} at cost`} />
      </div>

      {/* One chart + quiet side rail */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <SalesChart className="xl:col-span-8" />
        <div className="flex flex-col gap-5 xl:col-span-4">
          <RecentSales />
          <BestSellers />
          <LowStock />
        </div>
      </div>
    </div>
  );
}
