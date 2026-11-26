import { useMemo } from 'react';
import { num } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { salesInRange, topDesigns } from '../lib/finance';
import { subDays, startOfDay } from '../lib/dates';

/**
 * Best sellers — top designs by units sold in the last 30 days (the same
 * window the Overview KPI cards use). Moved here from the removed Analytics
 * page so the home screen shows what's moving without a second tab.
 */
export function BestSellers() {
  const { state } = useApp();

  const top = useMemo(() => {
    const now = new Date();
    const from = subDays(startOfDay(now), 29);
    return topDesigns(state.designs, salesInRange(state.sales, from, now), 6);
  }, [state.designs, state.sales]);
  const maxTop = Math.max(1, ...top.map((x) => x.posters));

  return (
    <section className="card p-5" aria-label="Best selling designs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[0.9rem] font-semibold tracking-tight text-ink">Best sellers</h2>
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
  );
}
