import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Phone, MapPin, Truck, Store, CalendarClock, Package, CircleCheck, CircleX,
  PackageCheck, PackageOpen, Undo2, ChevronDown, ChevronUp, BellRing, Hourglass,
} from 'lucide-react';
import { cn, inr, formatTime } from '../lib/utils';
import { useApp, orderStatusMeta } from '../context/AppContext';
import { inventoryView } from '../lib/finance';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { NewOrderDialog } from '../components/NewOrderDialog';

const TABS = [
  { id: 'pending', label: 'Action queue', match: (s) => ['request-received', 'waiting-stock'].includes(s) },
  { id: 'progress', label: 'Ready / Out', match: (s) => ['ready-pickup', 'out-for-delivery'].includes(s) },
  { id: 'delivered', label: 'Delivered', match: (s) => s === 'delivered' },
  { id: 'unsuccessful', label: 'Not delivered', match: (s) => ['not-delivered', 'cancelled'].includes(s) },
  { id: 'all', label: 'All orders', match: () => true },
];

export default function HomeDelivery() {
  const { state, setOrderStatus, fulfillOrder, pushToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState(location.state?.highlightId || '');
  const [method, setMethod] = useState('all');
  const [tab, setTab] = useState('pending');
  const [newOpen, setNewOpen] = useState(!!location.state?.newOrder);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    if (location.state?.newOrder) {
      setNewOpen(true);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.highlightId) setQuery(location.state.highlightId);
  }, [location.state]);

  const inv = useMemo(() => inventoryView(state.designs, state.sales), [state.designs, state.sales]);
  const stockById = useMemo(() => new Map(inv.map((d) => [d.id, d])), [inv]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tabDef = TABS.find((t) => t.id === tab);
    return [...state.orders]
      .filter((o) => tabDef.match(o.status))
      .filter((o) => (method === 'all' ? true : o.method === method))
      .filter((o) => {
        if (!q) return true;
        const hay = [o.id, o.customer?.name, o.customer?.phone, o.customer?.pin, o.customer?.area, ...(o.items || []).map((i) => i.designId)].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [state.orders, query, method, tab]);

  const counts = useMemo(() => {
    const c = {};
    for (const t of TABS) c[t.id] = state.orders.filter((o) => t.match(o.status)).length;
    return c;
  }, [state.orders]);

  // Waiting-for-stock radar: which customers are queued for which design
  const waitingDesigns = useMemo(() => {
    const waiting = state.orders.filter((o) => o.status === 'waiting-stock');
    const byDesign = new Map();
    for (const o of waiting) {
      for (const item of o.items || []) {
        if (!byDesign.has(item.designId)) byDesign.set(item.designId, []);
        byDesign.get(item.designId).push({ orderId: o.id, name: o.customer?.name, phone: o.customer?.phone, qty: item.qty });
      }
    }
    return [...byDesign.entries()].map(([designId, customers]) => ({
      designId,
      customers,
      stock: stockById.get(designId)?.remaining ?? 0,
      design: stockById.get(designId),
    }));
  }, [state.orders, stockById]);

  const markReady = async (order) => {
    const next = order.method === 'Customer Pickup' ? 'ready-pickup' : 'out-for-delivery';
    if (!await setOrderStatus(order.id, next)) return;
    pushToast('success', order.method === 'Customer Pickup' ? 'Marked ready for pickup' : 'Out for delivery', `${order.id} — ${order.customer?.name}`);
  };

  const markDelivered = async (order) => {
    const saleRef = await fulfillOrder(order.id, { paymentMode: order.payment?.mode || 'Cash' });
    if (!saleRef) return;
    pushToast('success', saleRef ? `Delivered — sale ${saleRef} created` : 'Order delivered', saleRef ? 'Stock reduced · revenue, summary and reports updated.' : 'Order marked delivered.');
  };

  const markWaiting = async (order) => { if (!await setOrderStatus(order.id, 'waiting-stock')) return; pushToast('info', 'Waiting for stock', `${order.id} queued — it will appear in the restock radar.`); };

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div><p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-faint">Action queue</p><p className="tnum text-[1.05rem] font-semibold text-ink">{counts.pending}</p></div>
          <div className="hidden h-8 w-px bg-line-2 sm:block" />
          <div><p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-faint">Ready / out</p><p className="tnum text-[1.05rem] font-semibold text-ink">{counts.progress}</p></div>
          <div className="hidden h-8 w-px bg-line-2 sm:block" />
          <div><p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-faint">Delivered</p><p className="tnum text-[1.05rem] font-semibold text-success">{counts.delivered}</p></div>
        </div>
        <Button variant="primary" onClick={() => setNewOpen(true)}><Plus size={16} strokeWidth={2.4} /> New order</Button>
      </div>

      {/* Waiting-for-stock radar */}
      {waitingDesigns.length > 0 && (
        <section className="card overflow-hidden">
          <button onClick={() => setPanelOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-paper sm:px-5" aria-expanded={panelOpen}>
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft text-warning"><Hourglass size={16} strokeWidth={2} /></span>
              <span>
                <span className="block text-[0.85rem] font-semibold text-ink">Waiting for stock — {waitingDesigns.length} design{waitingDesigns.length > 1 ? 's' : ''}</span>
                <span className="block text-[0.68rem] text-muted">Customers queued to buy the moment stock lands</span>
              </span>
            </span>
            {panelOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
          </button>
          {panelOpen && (
            <div className="border-t border-line p-3 sm:p-4">
              <div className="grid gap-2 lg:grid-cols-2">
                {waitingDesigns.map(({ designId, customers, stock, design }) => (
                  <div key={designId} className="flex items-start gap-3 rounded-xl border border-line bg-[#fcfbf8] p-3">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-[0.62rem] font-bold', stock > 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>{designId}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8rem] font-semibold text-ink">{design?.name || designId}</p>
                      <p className="mt-0.5 text-[0.66rem] font-semibold uppercase tracking-wide text-muted">{stock > 0 ? `${stock} in stock now — call them!` : 'Still sold out'}</p>
                      <ul className="mt-1.5 space-y-0.5">
                        {customers.map((c) => (
                          <li key={c.orderId} className="flex items-center justify-between gap-2 text-[0.72rem]">
                            <span className="truncate text-ink-2">{c.name} <span className="text-faint">× {c.qty}</span></span>
                            <a href={`tel:${c.phone}`} className="tnum inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:text-primary-2"><Phone size={11} strokeWidth={2.4} />{c.phone}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tabs + filters */}
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div role="tablist" className="scroll-thin -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[0.78rem] font-semibold transition-all duration-150',
                tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-black/[0.04] hover:text-ink',
              )}
            >
              {t.label}
              <span className={cn('tnum text-[0.66rem] font-bold', tab === t.id ? 'text-white/80' : 'text-faint')}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 xl:w-72">
            <Search size={15} strokeWidth={2.1} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer, phone, PIN or design…" className="field pl-9" aria-label="Search orders" />
          </div>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Fulfilment method">
            <option value="all">All methods</option>
            <option value="Home Delivery">Home Delivery</option>
            <option value="Customer Pickup">Pickup at stall</option>
          </Select>
        </div>
      </div>

      {/* Order cards */}
      {filtered.length === 0 ? (
        <EmptyState icon={Truck} title="No orders here" sub="Nothing matches this view yet. New orders you create will show up here." action={<Button variant="primary" size="sm" onClick={() => setNewOpen(true)}><Plus size={14} strokeWidth={2.4} /> New order</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((order) => <OrderCard key={order.id} order={order} onMarkReady={markReady} onMarkDelivered={markDelivered} onMarkWaiting={markWaiting} setOrderStatus={setOrderStatus} pushToast={pushToast} stockById={stockById} navigate={navigate} />)}
        </div>
      )}

      <NewOrderDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function OrderCard({ order, onMarkReady, onMarkDelivered, onMarkWaiting, setOrderStatus, pushToast, stockById, navigate }) {
  const meta = orderStatusMeta[order.status] || orderStatusMeta['request-received'];
  const MethodIcon = order.method === 'Customer Pickup' ? Store : Truck;
  const done = order.status === 'delivered';
  const dead = order.status === 'cancelled' || order.status === 'not-delivered';
  const allStocked = (order.items || []).every((i) => (stockById.get(i.designId)?.remaining ?? 0) >= i.qty);

  return (
    <article className={cn('card flex flex-col p-4', done && 'border-success/25', order.status === 'cancelled' && 'opacity-70')}>
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[0.72rem] font-bold text-primary-ink">{order.id}</span>
        <div className="flex items-center gap-2">
          <span className="tnum text-[0.66rem] text-faint">{new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatTime(order.date)}</span>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
      </div>

      {/* Customer */}
      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.92rem] font-semibold leading-tight text-ink">{order.customer?.name}</p>
          <a href={`tel:${order.customer?.phone}`} className="tnum mt-0.5 inline-flex items-center gap-1 text-[0.74rem] font-semibold text-primary hover:text-primary-2"><Phone size={11} strokeWidth={2.5} />{order.customer?.phone}</a>
          {(order.customer?.address || order.customer?.area) && (
            <p className="mt-1 flex items-start gap-1 text-[0.7rem] leading-snug text-muted"><MapPin size={11} strokeWidth={2.2} className="mt-0.5 shrink-0" /><span className="line-clamp-1">{[order.customer?.address, order.customer?.area, order.customer?.pin].filter(Boolean).join(' · ')}</span></p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1 text-[0.65rem] font-semibold text-ink-2"><MethodIcon size={11} strokeWidth={2.2} />{order.method === 'Customer Pickup' ? 'Pickup' : 'Delivery'}</span>
          <span className={cn('text-[0.65rem] font-bold', order.payment?.status === 'paid' ? 'text-success' : 'text-warning')}>{order.payment?.status === 'paid' ? 'Paid' : 'Due'} · {inr(order.payment?.amount || 0)} {order.payment?.mode}</span>
        </div>
      </div>

      {/* Items */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {(order.items || []).map((item) => {
          const stock = stockById.get(item.designId)?.remaining;
          const short = stock !== undefined && stock < item.qty;
          return (
            <span key={item.designId} className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.7rem] font-semibold', short ? 'border-danger/20 bg-danger-soft text-danger' : 'border-line bg-white text-ink-2')}>
              <Package size={11} strokeWidth={2.2} />{item.designId} <span className="text-faint">×</span> {item.qty}
              {short && <span className="text-[0.58rem] uppercase tracking-wide">· {stock === 0 ? 'out' : `${stock} left`}</span>}
            </span>
          );
        })}
      </div>

      {order.note && <p className="mt-2 rounded-lg bg-warning-soft/60 px-2.5 py-1.5 text-[0.7rem] font-medium leading-snug text-warning">“{order.note}”</p>}

      {order.expectedDate && !done && (
        <p className="tnum mt-2 flex items-center gap-1.5 text-[0.68rem] font-semibold text-muted"><CalendarClock size={12} strokeWidth={2.2} /> Expected {new Date(order.expectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {order.status === 'request-received' && (
          <>
            <Button size="sm" variant="primary" onClick={() => onMarkReady(order)} disabled={!allStocked} title={allStocked ? undefined : 'Not enough stock — move to waiting queue'}>
              <PackageCheck size={14} /> {order.method === 'Customer Pickup' ? 'Ready for pickup' : 'Out for delivery'}
            </Button>
            <Button size="sm" variant="soft" onClick={() => onMarkWaiting(order)}><Hourglass size={13} /> Waiting for stock</Button>
            <CancelButton onCancel={async () => { if (!await setOrderStatus(order.id, 'cancelled')) return; pushToast('info', 'Order cancelled', `${order.id} moved to cancelled — kept in history.`); }} />
          </>
        )}
        {order.status === 'waiting-stock' && (
          <>
            <Button size="sm" variant="primary" onClick={() => onMarkReady(order)} disabled={!allStocked} title={allStocked ? 'Stock available — mark ready' : 'Stock not available yet'}>
              <PackageCheck size={14} /> {allStocked ? 'Stock arrived — mark ready' : 'Awaiting stock…'}
            </Button>
            <CancelButton onCancel={async () => { if (!await setOrderStatus(order.id, 'cancelled')) return; pushToast('info', 'Order cancelled', `${order.id} moved to cancelled — kept in history.`); }} />
          </>
        )}
        {order.status === 'ready-pickup' && (
          <Button size="sm" variant="primary" onClick={() => onMarkDelivered(order)}><CircleCheck size={14} /> Collected — complete sale</Button>
        )}
        {order.status === 'out-for-delivery' && (
          <>
            <Button size="sm" variant="primary" onClick={() => onMarkDelivered(order)}><CircleCheck size={14} /> Delivered — complete sale</Button>
            <Button size="sm" variant="danger" onClick={async () => { if (!await setOrderStatus(order.id, 'not-delivered')) return; pushToast('warning', 'Not delivered', `${order.id} marked unsuccessful. No sale created.`); }}><CircleX size={14} /> Not delivered</Button>
          </>
        )}
        {order.status === 'not-delivered' && (
          <>
            <Button size="sm" variant="soft" onClick={async () => { if (!await setOrderStatus(order.id, 'out-for-delivery')) return; pushToast('info', 'Retry queued', `${order.id} back out for delivery.`); }}><Undo2 size={13} /> Retry delivery</Button>
            <CancelButton onCancel={async () => { if (!await setOrderStatus(order.id, 'cancelled')) return; pushToast('info', 'Order cancelled', `${order.id} moved to cancelled — kept in history.`); }} />
          </>
        )}
        {done && (
          <button onClick={() => navigate('/sales', { state: { openId: order.fulfilledSaleId } })} className="inline-flex items-center gap-1.5 text-[0.74rem] font-semibold text-primary hover:text-primary-2">
            <CircleCheck size={13} strokeWidth={2.3} /> Delivered — sold as {order.fulfilledSaleId || 'sale'} <span aria-hidden>→</span>
          </button>
        )}
        {order.status === 'cancelled' && (
          <span className="inline-flex items-center gap-1.5 text-[0.74rem] font-medium text-muted"><PackageOpen size={13} strokeWidth={2} /> Cancelled — not counted in sales or stock.</span>
        )}
      </div>
    </article>
  );
}

function CancelButton({ onCancel }) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[0.7rem] font-semibold text-muted">Cancel order?</span>
        <Button size="sm" variant="danger" onClick={onCancel}>Yes, cancel</Button>
        <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Keep</Button>
      </span>
    );
  }
  return <Button size="sm" variant="ghost" onClick={() => setArmed(true)}>Cancel</Button>;
}
