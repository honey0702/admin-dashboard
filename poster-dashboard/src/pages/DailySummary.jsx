import { useMemo, useState } from 'react';
import {
  CalendarDays, Download, Banknote, Smartphone, CreditCard, ReceiptText, Info, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { cn, inr, num, downloadCSV } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { salesInRange, expensesInRange, expenseTotal, totals } from '../lib/finance';
import { startOfDay, subDays, format } from '../lib/dates';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';

const fmtDateInput = (d) => format(d, 'yyyy-MM-dd');
const pretty = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

export default function DailySummary() {
  const { state, pushToast } = useApp();
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const dayData = useMemo(() => computeDay(state.sales, state.expenses, selected), [state.sales, state.expenses, selected]);
  const prevData = useMemo(() => computeDay(state.sales, state.expenses, subDays(selected, 1)), [state.sales, state.expenses, selected]);

  const days14 = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => computeDay(state.sales, state.expenses, subDays(today, 13 - i))).reverse();
  }, [state.sales, state.expenses]);

  const fortnight = useMemo(() => {
    const today = startOfDay(new Date());
    let posters = 0, net = 0, gross = 0, discount = 0, expenses = 0, cogs = 0, count = 0;
    for (let i = 0; i < 14; i++) {
      const d = computeDay(state.sales, state.expenses, subDays(today, i));
      posters += d.t.posters; net += d.t.net; gross += d.t.gross; discount += d.t.discount; expenses += d.expenses; cogs += d.t.cogs; count += d.t.count;
    }
    return { posters, net, gross, discount, expenses, cogs, count, grossProfit: net - cogs, opProfit: net - cogs - expenses };
  }, [state.sales, state.expenses]);

  const isToday = startOfDay(new Date()).getTime() === selected.getTime();
  const opDelta = dayData.opProfit - prevData.opProfit;

  const exportCSV = () => {
    downloadCSV(
      'rang-poster-co-daily-summary.csv',
      ['Date', 'Transactions', 'Posters', 'Gross', 'Discounts', 'Net collected', 'COGS', 'Expenses', 'Gross profit', 'Operating profit'],
      [...days14].reverse().map((d) => [
        format(d.date, 'yyyy-MM-dd'), d.t.count, d.t.posters, d.t.gross, d.t.discount, d.t.net,
        d.t.cogs.toFixed(0), d.expenses, (d.t.net - d.t.cogs).toFixed(0), (d.t.net - d.t.cogs - d.expenses).toFixed(0),
      ]),
    );
    pushToast('success', 'Summary exported', 'Last 14 days downloaded as CSV — opens cleanly in Excel.');
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
      {/* ---------- Selected day ---------- */}
      <section className="xl:col-span-5">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-ink"><CalendarDays size={16} className="text-primary" strokeWidth={2} /> Day closing</h2>
            <div className="flex items-center gap-1.5">
              <button className={cn('chip', isToday && 'chip-active')} onClick={() => setSelected(startOfDay(new Date()))}>Today</button>
              <button className="chip" onClick={() => setSelected(subDays(startOfDay(new Date()), 1))}>Yesterday</button>
            </div>
          </div>
          <input
            type="date"
            className="field mt-3"
            value={fmtDateInput(selected)}
            max={fmtDateInput(new Date())}
            onChange={(e) => e.target.value && setSelected(startOfDay(new Date(`${e.target.value}T00:00:00`)))}
            aria-label="Pick a date"
          />
          <p className="mt-2 text-[0.78rem] font-medium text-muted">{pretty(selected)}</p>

          {dayData.t.count === 0 && dayData.expenses === 0 ? (
            <EmptyState title="No activity this day" sub="No sales or expenses were recorded. Pick another date from the list on the right." />
          ) : (
            <>
              {/* Headline numbers */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <HeadStat label="Transactions" value={num(dayData.t.count)} />
                <HeadStat label="Posters sold" value={num(dayData.t.posters)} />
                <HeadStat label="Net collected" value={inr(dayData.t.net)} tone="primary" />
              </div>

              {/* Ledger rows */}
              <div className="mt-4 space-y-[7px] border-t border-line pt-4 text-[0.83rem]">
                <Row label="Gross sales (before discounts)" value={inr(dayData.t.gross)} />
                <Row label="Discounts given" value={`−${inr(dayData.t.discount)}`} tone={dayData.t.discount ? 'warning' : undefined} />
                <Row label="Cost of goods sold" value={inr(dayData.t.cogs)} />
                <Row label="Operating expenses" value={inr(dayData.expenses)} />
                <div className="border-t border-dashed border-line-2 pt-[7px]">
                  <Row label="Gross profit (sales − COGS)" value={inr(dayData.t.grossProfit)} tone="success" strong />
                  <Row label="Operating profit (after expenses)" value={inr(dayData.opProfit)} tone={dayData.opProfit >= 0 ? 'success' : 'danger'} strong valueExtra={
                    <span className={cn('tnum inline-flex items-center gap-0.5 text-[0.66rem] font-bold', opDelta >= 0 ? 'text-success' : 'text-danger')}>
                      {opDelta >= 0 ? <ArrowUpRight size={11} strokeWidth={2.6} /> : <ArrowDownRight size={11} strokeWidth={2.6} />}
                      {inr(Math.abs(opDelta))} vs previous day
                    </span>
                  } />
                  <Row label="Net cash movement" value={inr(dayData.t.net - dayData.expenses)} />
                </div>
              </div>

              {/* Payment split */}
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-muted">Money in, by method</p>
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-line" role="img" aria-label="Payment method split">
                  {['Cash', 'UPI', 'Other'].map((m) => {
                    const share = dayData.t.net > 0 ? (dayData.t.byPayment[m] / dayData.t.net) * 100 : 0;
                    const color = m === 'Cash' ? '#39845F' : m === 'UPI' ? '#173D35' : '#A9AFA3';
                    return share > 0 ? <div key={m} style={{ width: `${share}%`, background: color }} className="h-full transition-all duration-700" /> : null;
                  })}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[0.73rem]">
                  {[
                    { m: 'Cash', icon: Banknote },
                    { m: 'UPI', icon: Smartphone },
                    { m: 'Other', icon: CreditCard },
                  ].map(({ m, icon: Icon }) => (
                    <div key={m} className="rounded-lg border border-line bg-[#fcfbf8] px-2.5 py-2">
                      <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted"><Icon size={11} strokeWidth={2.2} />{m}</p>
                      <p className="tnum mt-0.5 text-[0.85rem] font-semibold text-ink">{inr(dayData.t.byPayment[m])}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <p className="mt-4 flex items-start gap-1.5 border-t border-line pt-3 text-[0.68rem] leading-snug text-faint"><Info size={12} strokeWidth={2} className="mt-0.5 shrink-0" /> Auto-generated from the Sales Log and Expense Log — enter figures once, everywhere follows.</p>
        </div>
      </section>

      {/* ---------- Last 14 days ---------- */}
      <section className="xl:col-span-7">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-[0.9rem] font-semibold tracking-tight text-ink">Last 14 days</h2>
              <p className="mt-0.5 text-[0.68rem] text-muted">Tap a day to open its full closing view</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download size={14} strokeWidth={2} /> Export</Button>
          </div>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[620px] border-collapse">
              <thead><tr className="bg-[#fcfbf9]"><th className="th">Date</th><th className="th text-right">Txns</th><th className="th text-right">Posters</th><th className="th text-right">Net</th><th className="th text-right">Expenses</th><th className="th text-right">Op. profit</th></tr></thead>
              <tbody>
                {days14.map((d) => {
                  const isSel = d.date.getTime() === selected.getTime();
                  return (
                    <tr key={d.iso} className={cn('cursor-pointer', isSel && '!bg-primary-soft/50 hover:!bg-primary-soft/60')} onClick={() => setSelected(d.date)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(d.date); } }}>
                      <td className="td font-medium text-ink">{d.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}{isToday && d.date.getTime() === startOfDay(new Date()).getTime() && <span className="ml-1.5 rounded bg-primary px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide text-white">Today</span>}</td>
                      <td className="td text-right tnum text-muted">{d.t.count || '—'}</td>
                      <td className="td text-right tnum text-muted">{d.t.posters || '—'}</td>
                      <td className="td text-right tnum font-medium">{d.t.net ? inr(d.t.net) : '—'}</td>
                      <td className="td text-right tnum text-muted">{d.expenses ? inr(d.expenses) : '—'}</td>
                      <td className={cn('td text-right tnum font-semibold', d.opProfit >= 0 ? 'text-success' : 'text-danger')}>{d.t.count || d.expenses ? inr(d.opProfit) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line-2 bg-[#fcfbf9]">
                  <td className="td font-bold text-ink">14-day total</td>
                  <td className="td text-right tnum font-bold">{fortnight.count}</td>
                  <td className="td text-right tnum font-bold">{num(fortnight.posters)}</td>
                  <td className="td text-right tnum font-bold">{inr(fortnight.net)}</td>
                  <td className="td text-right tnum font-bold">{inr(fortnight.expenses)}</td>
                  <td className={cn('td text-right tnum font-bold', fortnight.opProfit >= 0 ? 'text-success' : 'text-danger')}>{inr(fortnight.opProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function computeDay(sales, expenses, date) {
  const from = startOfDay(date);
  const to = new Date(from.getTime() + 86399999);
  const daySales = salesInRange(sales, from, to);
  const t = totals(daySales);
  const exp = expenseTotal(expensesInRange(expenses, from, to));
  return {
    date: from,
    iso: format(from, 'yyyy-MM-dd'),
    t: { ...t, grossProfit: t.net - t.cogs },
    expenses: exp,
    opProfit: t.net - t.cogs - exp,
  };
}

function HeadStat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-line bg-[#fcfbf8] px-3 py-3">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-faint">{label}</p>
      <p className={cn('tnum mt-1 text-[1.02rem] font-bold leading-none', tone === 'primary' ? 'text-primary-ink' : 'text-ink')}>{value}</p>
    </div>
  );
}

function Row({ label, value, tone, strong, valueExtra }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('text-muted', strong && 'font-medium text-ink-2')}>{label}</span>
      <span className="flex flex-col items-end">
        <span className={cn('tnum', strong ? 'font-bold' : 'font-medium text-ink', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>{value}</span>
        {valueExtra}
      </span>
    </div>
  );
}
