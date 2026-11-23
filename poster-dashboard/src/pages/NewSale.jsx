import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, X, Trash2, Banknote, Smartphone, CreditCard, ReceiptText, Sparkles, CircleCheck,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn, inr, num } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { inventoryView, suggestedDiscount } from '../lib/finance';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { EmptyState } from '../components/ui/empty-state';

const PAYMENTS = [
  { id: 'Cash', icon: Banknote },
  { id: 'UPI', icon: Smartphone },
  { id: 'Other', icon: CreditCard },
];

export default function NewSale() {
  const { state, addSale, pushToast } = useApp();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]); // { designId, design snapshot fields, qty }
  const [discountMode, setDiscountMode] = useState('auto'); // auto | custom | none
  const [customDiscount, setCustomDiscount] = useState('');
  const [payment, setPayment] = useState(() => (state.settings.defaultPayment || 'UPI'));
  const [note, setNote] = useState('');
  const [justSaved, setJustSaved] = useState(null);
  const searchRef = useRef(null);

  const inv = useMemo(() => inventoryView(state.designs, state.sales), [state.designs, state.sales]);
  const stockById = useMemo(() => new Map(inv.map((d) => [d.id, d])), [inv]);

  // Ctrl/Cmd + K focuses the design search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // let the global palette win; only plain typing focuses search
        return;
      }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inv.filter((d) => {
      if (d.archived) return false;
      if (category !== 'All' && d.category !== category) return false;
      if (!q) return true;
      return [d.id, d.name, d.category].join(' ').toLowerCase().includes(q);
    });
  }, [inv, query, category]);

  const categories = useMemo(() => ['All', ...state.categories], [state.categories]);

  const posters = cart.reduce((a, l) => a + l.qty, 0);
  const gross = cart.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const suggestion = suggestedDiscount(posters, state.rules);
  const effectiveDiscount = discountMode === 'none' ? 0 : discountMode === 'custom'
    ? Math.min(Math.max(0, Number(customDiscount) || 0), gross)
    : Math.min(suggestion, gross);
  const net = Math.max(0, gross - effectiveDiscount);

  // If the cart drops below the suggestion threshold, fall back to auto behaviour cleanly
  useEffect(() => {
    if (discountMode === 'auto' && suggestion === 0) return;
  }, [suggestion, discountMode]);

  const addToCart = (design) => {
    const stock = stockById.get(design.id)?.remaining ?? 0;
    if (stock <= 0) return;
    // Check against current cart *outside* the updater — updaters run during
    // render and must stay pure (no toasts/setState of other components).
    const current = cart.find((l) => l.designId === design.id)?.qty || 0;
    if (current >= stock) {
      pushToast('warning', `Only ${stock} of ${design.id} left`, 'The full stock is already in this bill.');
      return;
    }
    setCart((prev) => {
      const line = prev.find((l) => l.designId === design.id);
      if (line) return prev.map((l) => (l.designId === design.id ? { ...l, qty: Math.min(l.qty + 1, stock) } : l));
      return [...prev, { designId: design.id, name: design.name, category: design.category, unitPrice: design.price, unitCost: stockById.get(design.id)?.unitCost || 0, qty: 1 }];
    });
  };

  const setQty = (designId, qty) => {
    const stock = stockById.get(designId)?.remaining ?? 0;
    const clamped = Math.max(0, Math.min(stock, qty));
    setCart((prev) => (clamped === 0 ? prev.filter((l) => l.designId !== designId) : prev.map((l) => (l.designId === designId ? { ...l, qty: clamped } : l))));
  };

  const removeLine = (designId) => setCart((prev) => prev.filter((l) => l.designId !== designId));
  const clearCart = () => { setCart([]); setDiscountMode('auto'); setCustomDiscount(''); setNote(''); };

  const completeSale = async () => {
    if (!cart.length || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    const sale = await addSale({ lines: cart, discount: effectiveDiscount, payment, note: note.trim() });
    savingRef.current = false; setSaving(false);
    if (!sale) return;
    setJustSaved(sale.id);
    clearCart();
    pushToast('success', `Sale ${sale.id} recorded`, `${posters} poster${posters === 1 ? '' : 's'} · ${inr(net)} · ${payment}`);
    window.setTimeout(() => setJustSaved(null), 3500);
  };

  return (
    <div className="grid grid-cols-1 gap-4 pb-2 xl:grid-cols-12 xl:gap-6">
      {/* ---------- Catalog ---------- */}
      <div className="xl:col-span-7 2xl:col-span-8">
        <div className="relative">
          <Search size={16} strokeWidth={2.1} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Design ID, name or category…  ( / )"
            className="field h-11 rounded-xl pl-10 text-[0.9rem] shadow-sm"
            aria-label="Search designs"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="scroll-thin -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:mx-0 xl:flex-wrap xl:overflow-visible xl:px-0">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={cn('chip', category === c && 'chip-active')}>
              {c}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 2xl:grid-cols-4">
          {filtered.map((d) => {
            const inCart = cart.find((l) => l.designId === d.id)?.qty || 0;
            const soldOut = d.remaining === 0;
            const low = !soldOut && d.remaining <= state.settings.lowStockThreshold;
            return (
              <button
                key={d.id}
                onClick={() => addToCart(d)}
                disabled={soldOut}
                className={cn(
                  'group relative flex flex-col rounded-xl border p-2.5 text-left transition-all duration-150',
                  soldOut
                    ? 'cursor-not-allowed border-line bg-[#faf9f6] opacity-60'
                    : 'border-line bg-white hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift active:scale-[0.98]',
                )}
                aria-label={`Add ${d.name} to sale`}
              >
                {inCart > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[0.66rem] font-bold text-white shadow-sm tnum">
                    {inCart}
                  </span>
                )}
                <span className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[0.66rem] font-bold text-primary-ink">{d.id}</span>
                  <span className="tnum text-[0.78rem] font-bold text-ink">{inr(d.price)}</span>
                </span>
                <span className="mt-1.5 line-clamp-2 min-h-[2.15rem] text-[0.74rem] font-medium leading-snug text-ink-2">{d.name}</span>
                <span className="mt-auto flex items-center justify-between gap-1 pt-2">
                  <span className={cn('flex items-center gap-1 text-[0.62rem] font-semibold', soldOut ? 'text-danger' : low ? 'text-warning' : 'text-faint')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', soldOut ? 'bg-danger' : low ? 'bg-warning' : 'bg-success')} />
                    {soldOut ? 'Sold out' : `${num(d.remaining)} left`}
                  </span>
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full transition-colors', soldOut ? 'bg-line text-faint' : 'bg-primary-soft text-primary group-hover:bg-primary group-hover:text-white')}>
                    <Plus size={13} strokeWidth={2.6} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <EmptyState icon={Search} title="No designs found" sub={`Nothing matches “${query}”. Try an ID like “D002”, or another category.`} />
        )}
      </div>

      {/* ---------- Bill ---------- */}
      <div className="xl:col-span-5 2xl:col-span-4">
        <div className="card flex max-h-none flex-col overflow-hidden xl:sticky xl:top-[4.5rem]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-[0.92rem] font-semibold tracking-tight text-ink">
              <ReceiptText size={16} className="text-primary" strokeWidth={2} /> Current sale
              {posters > 0 && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.68rem] font-bold text-primary-ink tnum">{posters} poster{posters === 1 ? '' : 's'}</span>}
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="flex items-center gap-1 text-[0.72rem] font-semibold text-muted transition-colors hover:text-danger">
                <Trash2 size={13} strokeWidth={2.1} /> Clear
              </button>
            )}
          </div>

          {/* Lines */}
          <div className="scroll-thin max-h-56 overflow-y-auto px-3 py-2 sm:max-h-64">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-dashed border-line-2 text-faint"><ReceiptText size={19} strokeWidth={1.6} /></span>
                <p className="text-[0.8rem] font-medium text-muted">Tap designs to build the customer&apos;s bill.</p>
                <p className="text-[0.66rem] text-faint">Combo discounts apply automatically by quantity.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#efede8]">
                <AnimatePresence initial={false}>
                  {cart.map((l) => (
                    <motion.li
                      key={l.designId}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="flex items-center gap-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8rem] font-semibold text-ink"><span className="font-mono text-[0.7rem] text-primary-ink">{l.designId}</span> · {l.name}</p>
                        <p className="mt-0.5 text-[0.66rem] text-faint tnum">{inr(l.unitPrice)} each</p>
                      </div>
                      <div className="flex shrink-0 items-center rounded-md border border-line-2">
                        <button onClick={() => setQty(l.designId, l.qty - 1)} className="p-1.5 text-muted hover:text-ink" aria-label="Decrease"><Minus size={11} strokeWidth={2.6} /></button>
                        <span className="tnum w-6 text-center text-[0.8rem] font-bold">{l.qty}</span>
                        <button onClick={() => setQty(l.designId, l.qty + 1)} className="p-1.5 text-muted hover:text-ink" aria-label="Increase"><Plus size={11} strokeWidth={2.6} /></button>
                      </div>
                      <span className="tnum w-12 shrink-0 text-right text-[0.8rem] font-bold text-ink">{inr(l.qty * l.unitPrice)}</span>
                      <button onClick={() => removeLine(l.designId)} className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-danger-soft hover:text-danger" aria-label="Remove"><X size={14} /></button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          {/* Discount */}
          <div className="border-t border-line px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.09em] text-muted"><Sparkles size={11} strokeWidth={2.3} className="text-primary" /> Discount</p>
              {suggestion > 0 && discountMode === 'auto' && <span className="flex items-center gap-1 text-[0.66rem] font-bold text-success"><CircleCheck size={11} strokeWidth={2.6} /> Combo applied</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button onClick={() => setDiscountMode('auto')} disabled={suggestion === 0} className={cn('chip h-7 disabled:cursor-not-allowed disabled:opacity-40', discountMode === 'auto' && 'chip-active')}>
                Suggested {suggestion > 0 ? `−${inr(suggestion)}` : '—'}
              </button>
              <button onClick={() => setDiscountMode('none')} className={cn('chip h-7', discountMode === 'none' && 'chip-active')}>No discount</button>
              <button onClick={() => setDiscountMode('custom')} className={cn('chip h-7', discountMode === 'custom' && 'chip-active')}>Custom…</button>
              {discountMode === 'custom' && (
                <input type="number" min="0" max={gross} value={customDiscount} onChange={(e) => setCustomDiscount(e.target.value)} placeholder="₹" autoFocus className="field h-7 w-20 px-2 text-[0.8rem] tnum" aria-label="Custom discount in rupees" />
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1 border-t border-line px-5 py-3 text-[0.82rem]">
            <div className="flex items-center justify-between text-muted"><span>Original bill</span><span className="tnum">{inr(gross)}</span></div>
            <div className="flex items-center justify-between text-muted"><span>Discount</span><span className={cn('tnum', effectiveDiscount > 0 && 'font-semibold text-success')}>−{inr(effectiveDiscount)}</span></div>
            <div className="flex items-baseline justify-between border-t border-line pt-1.5">
              <span className="text-[0.78rem] font-bold uppercase tracking-[0.09em] text-ink">Total</span>
              <span className="tnum font-display text-[1.5rem] font-semibold leading-none text-primary-ink">{inr(net)}</span>
            </div>
          </div>

          {/* Payment + note + CTA */}
          <div className="border-t border-line px-5 py-4">
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-paper p-1">
              {PAYMENTS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPayment(id)}
                  aria-pressed={payment === id}
                  className={cn(
                    'flex h-10 items-center justify-center gap-1.5 rounded-lg text-[0.82rem] font-semibold transition-all duration-150',
                    payment === id ? 'bg-white text-primary shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
                  )}
                >
                  <Icon size={15} strokeWidth={2} /> {id}
                </button>
              ))}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. birthday combo" className="field mt-2 h-9 text-[0.8rem]" aria-label="Sale note" />
            <Button size="lg" className="mt-3 h-12 w-full text-[0.95rem]" onClick={completeSale} disabled={cart.length === 0 || saving}>
              {justSaved ? <><CircleCheck size={18} /> Recorded — ready for next</> : `Complete sale${posters ? ` · ${inr(net)}` : ''}`}
            </Button>
            <button onClick={() => navigate('/sales')} className="mt-2 w-full text-center text-[0.68rem] font-medium text-faint transition-colors hover:text-muted">View sales log →</button>
          </div>
        </div>
      </div>

      {/* Sticky checkout bar — mobile/tablet only (desktop has the side rail) */}
      {posters > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-2 backdrop-blur-md xl:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 shrink-0 leading-tight">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-faint tnum">{posters} poster{posters === 1 ? '' : 's'}</p>
              <p className="tnum text-[1.05rem] font-bold text-ink">{inr(net)}</p>
            </div>
            <Button size="lg" className="h-11 flex-1 text-[0.92rem]" onClick={completeSale} disabled={saving}>
              Complete sale
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
