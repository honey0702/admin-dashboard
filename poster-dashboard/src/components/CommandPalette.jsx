import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Search, LayoutDashboard, Boxes, ReceiptText, Truck, Wallet, CalendarDays, Settings,
  Package, ShoppingBag, CornerDownLeft, Plus, UserRound, Hash, ArrowRight,
} from 'lucide-react';
import { cn, inr } from '../lib/utils';
import { useApp } from '../context/AppContext';

const PAGES = [
  { label: 'Overview', hint: 'Dashboard & KPIs', to: '/', icon: LayoutDashboard, keywords: 'home dashboard kpi' },
  { label: 'Inventory', hint: 'Designs, stock & batches', to: '/inventory', icon: Boxes, keywords: 'stock designs catalogue copies low restock running out' },
  { label: 'Sales', hint: 'Sales log & refunds', to: '/sales', icon: ReceiptText, keywords: 'transactions log history receipt' },
  { label: 'Home Delivery', hint: 'Customer orders & fulfilment', to: '/home-delivery', icon: Truck, keywords: 'orders customer delivery pickup' },
  { label: 'Expenses', hint: 'Stall spend & reports', to: '/expenses', icon: Wallet, keywords: 'costs spend money out' },
  { label: 'Daily Summary', hint: 'Closing sheet per day', to: '/daily-summary', icon: CalendarDays, keywords: 'closing sheet report eod' },
  { label: 'Settings', hint: 'Business, prices & rules', to: '/settings', icon: Settings, keywords: 'profile prices discount backup api' },
];

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { state } = useApp();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', onKey, true);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('keydown', onKey, true);
      };
    }
  }, [open, onClose]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    const groups = [];
    // Actions first when query is empty
    if (!q) {
      groups.push({
        title: 'Quick actions',
        items: [
          { id: 'act-sale', icon: Plus, label: 'New Sale', hint: 'Open sales entry', run: () => navigate('/sales/new') },
          { id: 'act-order', icon: Truck, label: 'New Home Delivery Order', hint: 'Create customer order', run: () => navigate('/home-delivery', { state: { newOrder: true } }) },
        ],
      });
      groups.push({ title: 'Go to', items: PAGES.map((p) => ({ id: `page-${p.to}`, icon: p.icon, label: p.label, hint: p.hint, run: () => navigate(p.to) })) });
      return groups;
    }

    const pages = PAGES.filter((p) => `${p.label} ${p.keywords}`.toLowerCase().includes(q))
      .map((p) => ({ id: `page-${p.to}`, icon: p.icon, label: p.label, hint: p.hint, run: () => navigate(p.to) }));
    if (pages.length) groups.push({ title: 'Go to', items: pages });

    const designs = state.designs
      .filter((d) => !d.archived && [d.id, d.name, d.category].join(' ').toLowerCase().includes(q))
      .slice(0, 5)
      .map((d) => ({
        id: `design-${d.id}`, icon: Package, label: `${d.id} — ${d.name}`, hint: `${d.category} · ${inr(d.price)}`,
        run: () => navigate('/inventory', { state: { highlightId: d.id } }),
      }));
    if (designs.length) groups.push({ title: 'Designs', items: designs });

    const sales = state.sales
      .filter((s) => s.id.toLowerCase().includes(q) || s.lines.some((l) => l.designId.toLowerCase().includes(q)))
      .slice(-5)
      .reverse()
      .map((s) => ({
        id: `sale-${s.id}`, icon: Hash, label: s.id, hint: `${s.lines.length} item${s.lines.length > 1 ? 's' : ''} · ${inr(s.net)}`,
        run: () => navigate('/sales', { state: { openId: s.id } }),
      }));
    if (sales.length) groups.push({ title: 'Sales', items: sales });

    const orders = state.orders
      .filter((o) => [o.id, o.customer?.name, o.customer?.phone, o.customer?.pin, ...(o.items || []).map((i) => i.designId)].join(' ').toLowerCase().includes(q))
      .slice(0, 4)
      .map((o) => ({
        id: `order-${o.id}`, icon: UserRound, label: `${o.id} — ${o.customer?.name}`, hint: o.customer?.area ? `${o.customer.area} · ${o.status.replace(/-/g, ' ')}` : o.status,
        run: () => navigate('/home-delivery', { state: { highlightId: o.id } }),
      }));
    if (orders.length) groups.push({ title: 'Orders', items: orders });

    return groups;
  }, [q, state.designs, state.sales, state.orders, navigate]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);
  useEffect(() => setIndex(0), [q]);

  const runAt = (i) => {
    const item = flat[i];
    if (item) {
      item.run();
      onClose();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(index); }
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[85] flex justify-center px-4 pt-[10vh] sm:pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-[#121F1A]/45 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="relative flex max-h-[62vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={17} className="shrink-0 text-muted" strokeWidth={2} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search designs, sales, customers, pages…"
                className="h-14 w-full bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-faint"
                aria-label="Search everything"
              />
              <kbd className="kbd shrink-0">ESC</kbd>
            </div>
            <div className="scroll-thin grow overflow-y-auto p-2">
              {flat.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <ShoppingBag size={20} className="text-faint" />
                  <p className="text-[0.85rem] font-medium text-muted">Nothing found for “{query}”</p>
                </div>
              )}
              {results.map((group) => (
                <div key={group.title} className="mb-1 last:mb-0">
                  <p className="px-3 pb-1 pt-2 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-faint">{group.title}</p>
                  {group.items.map((item) => {
                    flatIndex += 1;
                    const i = flatIndex;
                    const Icon = item.icon;
                    const active = i === index;
                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setIndex(i)}
                        onClick={() => runAt(i)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100',
                          active ? 'bg-primary-soft' : 'bg-transparent',
                        )}
                      >
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', active ? 'bg-white text-primary' : 'bg-paper text-muted')}>
                          <Icon size={15} strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.84rem] font-medium text-ink">{item.label}</span>
                          {item.hint && <span className="block truncate text-[0.68rem] text-muted">{item.hint}</span>}
                        </span>
                        {active && <CornerDownLeft size={14} className="shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line bg-[#fcfbf9] px-4 py-2 text-[0.66rem] text-faint">
              <span className="flex items-center gap-1.5"><kbd className="kbd">↑↓</kbd> navigate <kbd className="kbd">↵</kbd> open</span>
              <span className="hidden items-center gap-1 sm:flex">Search across the whole shop <ArrowRight size={11} /></span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
