import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { cn, inr, inrCr } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { dailySeries } from '../lib/finance';

const RANGES = [
  { id: 14, label: '14D' },
  { id: 30, label: '30D' },
  { id: 90, label: '90D' },
];

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const date = new Date(p.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 shadow-pop">
      <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-muted">{date}</p>
      <p className="tnum mt-0.5 text-[0.92rem] font-semibold text-ink">{inr(p.revenue)}</p>
    </div>
  );
}

export function SalesChart({ className }) {
  const { state } = useApp();
  const [days, setDays] = useState(14);

  const data = useMemo(() => dailySeries(state.sales, days), [state.sales, days]);

  return (
    <section className={cn('card flex flex-col p-5 sm:p-6', className)} aria-label="Sales performance">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">Sales performance</h2>
          <p className="mt-0.5 text-[0.73rem] text-muted">Net revenue · last {days} days</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-paper p-1" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={days === r.id}
              onClick={() => setDays(r.id)}
              className={cn(
                'h-7 rounded-md px-2.5 text-[0.72rem] font-semibold transition-all duration-200',
                days === r.id ? 'bg-white text-primary shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 min-h-[248px] w-full flex-1 sm:min-h-[284px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="#ecebe4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={{ fontSize: 11, fill: '#a9aea2' }}
              dy={8}
            />
            <YAxis
              width={46}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#a9aea2' }}
              tickFormatter={(v) => inrCr(v)}
            />
            <Tooltip content={<ChartTip />} cursor={{ stroke: '#173d35', strokeOpacity: 0.25, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Net revenue"
              stroke="#173d35"
              strokeWidth={2.3}
              fill="#173d35"
              fillOpacity={0.09}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 0, fill: '#173d35' }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
