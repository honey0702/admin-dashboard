import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackagePlus, PackageX, ArrowRight } from 'lucide-react';
import { cn, num } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { inventoryView } from '../lib/finance';
import { RestockDialog } from './RestockDialog';

/** Compact low-stock alert list — top 3 tightest designs + quick restock. */
export function LowStock() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [restockId, setRestockId] = useState(null);

  const low = useMemo(() => {
    const threshold = state.settings.lowStockThreshold;
    return inventoryView(state.designs, state.sales)
      .filter((d) => !d.archived && d.remaining <= threshold)
      .sort((a, b) => a.remaining - b.remaining);
  }, [state.designs, state.sales, state.settings.lowStockThreshold]);

  const shown = low.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <section className="card p-5" aria-label="Low stock alerts">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[0.9rem] font-semibold tracking-tight text-ink">
          Low stock
          <span className="tnum text-[0.72rem] font-bold text-warning">{low.length}</span>
        </h2>
        <button
          onClick={() => navigate('/inventory', { state: { filter: 'low' } })}
          className="group inline-flex items-center gap-1 text-[0.72rem] font-semibold text-primary transition-colors hover:text-primary-2"
        >
          Manage
          <ArrowRight size={12} strokeWidth={2.4} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="mt-2 divide-y divide-[#efeee8]">
        {shown.map((d) => {
          const soldOut = d.remaining === 0;
          return (
            <div key={d.id} className="group flex items-center gap-2.5 py-2">
              <span className={cn('font-mono text-[0.68rem] font-bold', soldOut ? 'text-danger' : 'text-warning')}>{d.id}</span>
              <span className="min-w-0 flex-1 truncate text-[0.78rem] text-ink-2">{d.name}</span>
              <span className={cn('tnum shrink-0 text-[0.7rem] font-bold', soldOut ? 'text-danger' : 'text-warning')}>
                {soldOut ? 'Out' : `${num(d.remaining)} left`}
              </span>
              <button
                onClick={() => setRestockId(d.id)}
                title={`Restock ${d.id}`}
                aria-label={`Restock ${d.id}`}
                className="shrink-0 rounded-lg p-1.5 text-faint opacity-100 transition-all hover:bg-primary-soft hover:text-primary lg:opacity-0 lg:group-hover:opacity-100"
              >
                {soldOut ? <PackageX size={15} strokeWidth={1.9} /> : <PackagePlus size={15} strokeWidth={1.9} />}
              </button>
            </div>
          );
        })}
      </div>
      {low.length > shown.length && (
        <button onClick={() => navigate('/inventory', { state: { filter: 'low' } })} className="mt-2 w-full text-left text-[0.68rem] font-semibold text-muted transition-colors hover:text-primary">
          + {low.length - shown.length} more low on stock →
        </button>
      )}

      <RestockDialog designId={restockId} open={!!restockId} onClose={() => setRestockId(null)} />
    </section>
  );
}
