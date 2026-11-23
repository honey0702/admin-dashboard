import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { IndianRupee, ReceiptText, Layers3, Percent, TrendingUp, Target, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn, inr, inrCr, num, pct } from '../lib/utils';
import { useApp } from '../context/AppContext';
import {
  salesInRange, expensesInRange, expenseTotal, totals, dailySeries, categoryRevenue, topDesigns, slowestDesigns, rangeBounds,
} from '../lib/finance';
import { startOfDay, subDays } from '../lib/dates';

const RANGES = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All time' },
];
const PIE_COLORS = ['#173D35', '#5F7A68', '#ACBBA6'];

function TrendTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-pop">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted">{row?.full || label}</p>
      <p className="tnum mt-1 text-[0.92rem] font-semibold text-primary-ink">Revenue {inr(row?.revenue || 0)}</p>
      <p className="tnum mt-0.5 text-[0.78rem] font-medium text-muted">Expenses {inr(row?.expenses || 0)}</p>
    </div>
  );
}

export default function Analytics() {
  const { state } = useApp();
  const [range, setRange] = useState('30d');
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 63;

  const { from, to } = rangeBounds(range, new Date());
  const rangeSales = useMemo(() => salesInRange(state.sales, from, to), [state.sales, from, to]);
  const rangeExpenses = useMemo(() => expensesInRange(state.expenses, from, to), [state.expenses, from, to]);
  const t = useMemo(() => totals(rangeSales), [rangeSales]);
  const expTotal = expenseTotal(rangeExpenses);
  const grossMargin = t.net > 0 ? ((t.net - t.cogs) / t.net) * 100 : 0;

  // Trend series with per-day expenses
  const trend = useMemo(() => {
    const series = dailySeries(state.sales, days);
    return series.map((d) => {
      const dayFrom = startOfDay(new Date(d.date));
      const dayTo = new Date(dayFrom.getTime() + 86399999);
      return {
        ...d,
        full: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        expenses: expenseTotal(expensesInRange(state.expenses, dayFrom, dayTo)),
      };
    });
  }, [state.sales, state.expenses, days]);

  const categories = useMemo(() => categoryRevenue(state.designs, rangeSales), [state.designs, rangeSales]);
  const maxCat = Math.max(1, ...categories.map((c) => c.net));
  const catTotal = categories.reduce((a, c) => a + c.net, 0) || 1;

  const top = useMemo(() => topDesigns(state.designs, rangeSales, 6), [state.designs, rangeSales]);
  const maxTop = Math.max(1, ...top.map((x) => x.posters));
  const slowest = useMemo(() => slowestDesigns(state.designs, rangeSales, 5), [state.designs, rangeSales]);

  const paymentData = [
    { name: 'Cash', value: t.byPayment.Cash },
    { name: 'UPI', value: t.byPayment.UPI },
    { name: 'Other', value: t.byPayment.Other },
  ];

  // Break-even (always month-to-date vs target)
  const now = new Date();
  const monthNet = useMemo(() => totals(salesInRange(state.sales, new Date(now.getFullYear(), now.getMonth(), 1), now)).net, [state.sales]);
  const target = state.settings.breakEvenTarget || 1;
  const be = Math.min(100, (monthNet / target) * 100);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-ink"><TrendingUp size={16} className="text-primary" strokeWidth={2} /> Performance deep-dive</h2>
          <p className="mt-0.5 text-[0.73rem] text-muted">Print vs. sell, what moves, what doesn&apos;t — for the selected window.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-paper p-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)} aria-pressed={range === r.id} className={cn('h-7 rounded-md px-3 text-[0.72rem] font-semibold transition-all duration-150', range === r.id ? 'bg-white text-primary shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink')}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi icon={IndianRupee} label="Avg ticket" value={inr(t.avgTicket)} />
        <MiniKpi icon={Layers3} label="Posters / sale" value={t.postersPerTxn ? t.postersPerTxn.toFixed(2) : '0'} />
        <MiniKpi icon={Percent} label="Gross margin" value={pct(grossMargin, 1)} tone={grossMargin >= 60 ? 'success' : grossMargin >= 40 ? undefined : 'warning'} />
        <MiniKpi icon={ReceiptText} label="Avg discount" value={inr(t.avgDiscount)} foot={`${t.count} sales`} />
      </div>

      {/* Trend + payment split */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
        <section className="card p-5 xl:col-span-8" aria-label="Revenue and expenses trend">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[0.9rem] font-semibold tracking-tight text-ink">Revenue vs. expenses</h3>
              <p className="mt-0.5 text-[0.7rem] text-muted">Daily net collection against running costs</p>
            </div>
            <div className="flex items-center gap-3 text-[0.68rem] font-medium text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-primary" /> Net revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-[#E1E0D4]" /> Expenses</span>
            </div>
          </div>
          <div className="mt-3 h-[240px] w-full sm:h-[264px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 10, right: 2, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="#ECEBE4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} tick={{ fontSize: 10, fill: '#a6a3ae' }} dy={8} />
                <YAxis width={46} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#a6a3ae' }} tickFormatter={(v) => inrCr(v)} />
                <Tooltip content={<TrendTip />} cursor={{ fill: 'rgba(23,61,53,0.055)' }} />
                <Bar dataKey="expenses" name="Expenses" fill="#E1E0D4" radius={[3, 3, 0, 0]} animationDuration={700} />
                <Area type="monotone" dataKey="revenue" name="Net revenue" stroke="#173D35" strokeWidth={2.2} fill="#173D35" fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={800} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card flex flex-col p-5 xl:col-span-4" aria-label="Payment method split">
          <h3 className="text-[0.9rem] font-semibold tracking-tight text-ink">Where the money came from</h3>
          <p className="mt-0.5 text-[0.7rem] text-muted">Net collected, split by payment method</p>
          <div className="relative mx-auto mt-2 h-[150px] w-full max-w-[220px] sm:h-[168px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} dataKey="value" innerRadius={52} outerRadius={74} paddingAngle={3} strokeWidth={2} stroke="#ffffff" animationDuration={800}>
                  {paymentData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => inr(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E8E9E3', fontSize: 12, boxShadow: '0 12px 32px -12px rgba(23,32,27,.3)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="tnum text-[1.05rem] font-bold leading-none text-ink">{inr(t.net)}</p>
              <p className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-faint">Collected</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {paymentData.map((p, i) => (
              <li key={p.name} className="flex items-center gap-2 text-[0.76rem]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                <span className="text-ink-2">{p.name}</span>
                <span className="tnum ml-auto font-semibold text-ink">{inr(p.value)}</span>
                <span className="tnum w-10 text-right text-[0.66rem] font-medium text-faint">{t.net ? pct((p.value / t.net) * 100, 0) : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
        <section className="card p-5 xl:col-span-5" aria-label="Best selling designs">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.9rem] font-semibold tracking-tight text-ink">Best sellers</h3>
            <span className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-faint">By units</span>
          </div>
          <ol className="mt-3 space-y-2.5">
            {top.map((d, i) => (
              <li key={d.id} className="flex items-center gap-2.5">
                <span className="tnum w-5 text-[0.72rem] font-bold text-faint">0{i + 1}</span>
                <span className="font-mono text-[0.66rem] font-bold text-primary-ink">{d.id}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[0.75rem] font-medium text-ink">{d.name}</span>
                    <span className="tnum shrink-0 text-[0.72rem] font-bold text-ink">{num(d.posters)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(d.posters / maxTop) * 100}%` }} /></div>
                </div>
              </li>
            ))}
            {top.length === 0 && <p className="py-6 text-center text-[0.8rem] text-muted">No sales in this window yet.</p>}
          </ol>
        </section>

        <section className="card p-5 xl:col-span-4" aria-label="Revenue by category">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.9rem] font-semibold tracking-tight text-ink">Revenue by category</h3>
            <Link to="/inventory" className="inline-flex items-center gap-0.5 text-[0.68rem] font-semibold text-primary hover:text-primary-2">Catalogue <ArrowRight size={11} strokeWidth={2.5} /></Link>
          </div>
          <ul className="mt-3 space-y-2">
            {categories.slice(0, 7).map((c) => (
              <li key={c.name}>
                <div className="flex items-baseline justify-between gap-2 text-[0.74rem]">
                  <span className="truncate font-medium text-ink">{c.name}</span>
                  <span className="shrink-0 tnum text-[0.7rem] text-muted">{inrCr(c.net)} · <span className="text-faint">{pct((c.net / catTotal) * 100, 0)}</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-[#5F7A68] transition-all duration-700" style={{ width: `${(c.net / maxCat) * 100}%` }} /></div>
              </li>
            ))}
            {categories.length === 0 && <p className="py-6 text-center text-[0.8rem] text-muted">No category data in this window.</p>}
          </ul>
        </section>

        <section className="card p-5 xl:col-span-3" aria-label="Slowest movers">
          <div className="flex items-center justify-between gap-2"><h3 className="text-[0.9rem] font-semibold tracking-tight text-ink">Slowest movers</h3><span className="whitespace-nowrap text-[0.6rem] font-bold uppercase tracking-[0.1em] text-faint">Reorder less</span></div>
          <ul className="mt-3 divide-y divide-[#efede8]">
            {slowest.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <span className="font-mono text-[0.66rem] font-bold text-muted">{d.id}</span>
                <span className="min-w-0 flex-1 truncate text-[0.74rem] text-ink-2">{d.name}</span>
                <span className={cn('tnum rounded-full px-2 py-0.5 text-[0.65rem] font-bold', d.posters === 0 ? 'bg-danger-soft text-danger' : 'bg-[#f1efe9] text-muted')}>{d.posters} sold</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Break-even */}
      <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6" aria-label="Break-even progress">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Target size={20} strokeWidth={1.9} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <p className="text-[0.85rem] font-semibold text-ink">Break-even this month <span className="font-normal text-faint">· {daysLeft} day{daysLeft === 1 ? '' : 's'} left</span></p>
            <p className="tnum text-[0.76rem] font-semibold text-muted">{inr(monthNet)} <span className="text-faint">of</span> {inr(target)}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <motion.div className={cn('h-full rounded-full', be >= 100 ? 'bg-success' : 'bg-primary')} initial={{ width: 0 }} animate={{ width: `${be}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="mt-1.5 text-[0.68rem] text-muted">{be >= 100 ? 'Break-even crossed — every rupee from here is upside.' : `${inr(Math.max(0, target - monthNet))} to go. Prices and combo rules decide how fast this fills.`}</p>
        </div>
      </section>
    </div>
  );
}

function MiniKpi({ icon: Icon, label, value, foot, tone }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone === 'success' ? 'bg-success-soft text-success' : tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary')}><Icon size={18} strokeWidth={2} /></span>
      <span className="min-w-0">
        <span className="block text-[0.6rem] font-bold uppercase tracking-[0.1em] text-faint">{label}</span>
        <span className="tnum block text-[1.05rem] font-bold leading-tight text-ink">{value}{foot && <span className="ml-1.5 text-[0.64rem] font-medium text-faint">{foot}</span>}</span>
      </span>
    </div>
  );
}
