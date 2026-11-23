import { useNavigate } from 'react-router-dom';
import { Banknote, Smartphone, CreditCard, ArrowRight, ReceiptText } from 'lucide-react';
import { inr, formatTime } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { EmptyState } from './ui/empty-state';

const PAYMENT_ICON = { Cash: Banknote, UPI: Smartphone, Other: CreditCard };

export function RecentSales() {
  const { state } = useApp();
  const navigate = useNavigate();

  const recent = [...state.sales]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  return (
    <section className="card p-5" aria-label="Recent sales">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[0.9rem] font-semibold tracking-tight text-ink">Recent sales</h2>
        <button
          onClick={() => navigate('/sales')}
          className="group inline-flex items-center gap-1 text-[0.72rem] font-semibold text-primary transition-colors hover:text-primary-2"
        >
          View all
          <ArrowRight size={12} strokeWidth={2.4} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="mt-2 -mx-2">
        {recent.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No sales yet" sub="Today's first sale will appear here." />
        ) : (
          recent.map((sale) => {
            const posters = sale.lines.reduce((a, l) => a + l.qty, 0);
            const ids = sale.lines.slice(0, 2).map((l) => l.designId).join(', ');
            const PayIcon = PAYMENT_ICON[sale.payment] || Banknote;
            return (
              <button
                key={sale.id}
                onClick={() => navigate('/sales', { state: { openId: sale.id } })}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-paper"
              >
                <PayIcon size={16} strokeWidth={1.8} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.79rem] font-semibold leading-tight text-ink tnum">{posters} poster{posters === 1 ? '' : 's'} · {ids}{sale.lines.length > 2 ? '…' : ''}</span>
                  <span className="block text-[0.64rem] text-faint">{formatTime(sale.date)} · {sale.payment}</span>
                </span>
                <span className="tnum shrink-0 text-[0.84rem] font-semibold text-ink">{inr(sale.net)}</span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
