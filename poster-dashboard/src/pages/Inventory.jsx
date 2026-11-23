import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, Plus, Download, PackagePlus, ShieldAlert, Pencil, Archive, ArchiveRestore,
  ArrowUpDown, ArrowUp, ArrowDown, Boxes, IndianRupee, TriangleAlert, PackageX, X,
} from 'lucide-react';
import { cn, inr, num, downloadCSV } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { inventoryView } from '../lib/finance';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog } from '../components/ui/dialog';
import { EmptyState } from '../components/ui/empty-state';
import { RestockDialog } from '../components/RestockDialog';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'instock', label: 'In stock' },
  { id: 'low', label: 'Low stock' },
  { id: 'out', label: 'Sold out' },
  { id: 'archived', label: 'Archived' },
];

const sortTh = (label, key, sort, setSort, className) => (
  <th className={cn('th', className)}>
    <button className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-ink" onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
      {label}
      {sort.key === key ? (sort.dir === 'asc' ? <ArrowUp size={11} strokeWidth={2.6} /> : <ArrowDown size={11} strokeWidth={2.6} />) : <ArrowUpDown size={11} strokeWidth={2.2} className="text-faint" />}
    </button>
  </th>
);

export default function Inventory() {
  const { state, addDesign, updateDesign, archiveDesign, recordDamage, pushToast } = useApp();
  const location = useLocation();

  const [query, setQuery] = useState(location.state?.highlightId || '');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState(location.state?.filter === 'low' ? 'low' : 'all');
  const [sort, setSort] = useState({ key: 'id', dir: 'asc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // design object or null (= create)
  const [restockId, setRestockId] = useState(null);
  const [damageId, setDamageId] = useState(null);

  useEffect(() => {
    if (location.state?.highlightId) setQuery(location.state.highlightId);
    if (location.state?.filter) setStatus(location.state.filter);
  }, [location.state]);

  const lowThreshold = state.settings.lowStockThreshold;

  const inv = useMemo(() => inventoryView(state.designs, state.sales), [state.designs, state.sales]);

  const stats = useMemo(() => {
    const active = inv.filter((d) => !d.archived);
    return {
      designs: active.length,
      stockValue: active.reduce((a, d) => a + d.stockValue, 0),
      low: active.filter((d) => d.remaining > 0 && d.remaining <= lowThreshold).length,
      out: active.filter((d) => d.remaining === 0).length,
    };
  }, [inv, lowThreshold]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = inv.filter((d) => {
      if (status === 'archived') { if (!d.archived) return false; } else if (d.archived) return false;
      if (category !== 'All' && d.category !== category) return false;
      if (status === 'low' && !(d.remaining > 0 && d.remaining <= lowThreshold)) return false;
      if (status === 'out' && d.remaining !== 0) return false;
      if (status === 'instock' && d.remaining <= 0) return false;
      if (!q) return true;
      return [d.id, d.name, d.category, d.notes].join(' ').toLowerCase().includes(q);
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    const keyFn = {
      id: (d) => d.id,
      price: (d) => d.price,
      sold: (d) => d.sold,
      remaining: (d) => d.remaining,
      value: (d) => d.stockValue,
      planned: (d) => d.planned,
    }[sort.key] || ((d) => d.id);
    return [...list].sort((a, b) => (keyFn(a) > keyFn(b) ? 1 : keyFn(a) < keyFn(b) ? -1 : 0) * dir);
  }, [inv, query, category, status, sort, lowThreshold]);

  const exportCSV = () => {
    downloadCSV(
      'rang-poster-co-inventory.csv',
      ['Design ID', 'Name', 'Category', 'Price', 'Planned', 'Sold', 'Damaged', 'Remaining', 'Stock Value (cost)', 'Archived'],
      rows.map((d) => [d.id, d.name, d.category, d.price, d.planned, d.sold, d.damaged, d.remaining, d.stockValue.toFixed(0), d.archived ? 'yes' : 'no']),
    );
    pushToast('success', 'Inventory exported', `${rows.length} design${rows.length === 1 ? '' : 's'} downloaded as CSV.`);
  };

  return (
    <div className="space-y-4">
      {/* Stat strip + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatChip icon={Boxes} label="Designs" value={num(stats.designs)} />
          <div className="hidden h-8 w-px bg-line-2 sm:block" />
          <StatChip icon={IndianRupee} label="Stock at cost" value={inr(stats.stockValue)} />
          <div className="hidden h-8 w-px bg-line-2 sm:block" />
          <StatChip icon={TriangleAlert} label="Low stock" value={num(stats.low)} tone={stats.low ? 'warning' : undefined} />
          <div className="hidden h-8 w-px bg-line-2 sm:block" />
          <StatChip icon={PackageX} label="Sold out" value={num(stats.out)} tone={stats.out ? 'danger' : undefined} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV}><Download size={15} strokeWidth={2} /> <span className="hidden sm:inline">Export</span></Button>
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} strokeWidth={2.4} /> Add design</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={15} strokeWidth={2.1} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, name or category…" className="field pl-9" aria-label="Search inventory" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="w-36">
            <option value="All">All categories</option>
            {state.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <div className="scroll-thin flex gap-1.5 overflow-x-auto">
            {STATUS_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setStatus(f.id)} className={cn('chip', status === f.id && 'chip-active')}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-5">
          <p className="text-[0.74rem] font-semibold text-muted tnum">{rows.length} design{rows.length === 1 ? '' : 's'}</p>
          <p className="hidden text-[0.68rem] text-faint md:block">Printing &amp; sleeve costs flow into stock value — never into expenses twice.</p>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No designs found" sub="Try a different search, or add a new design to the catalogue." />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[1020px] border-collapse">
              <thead>
                <tr className="bg-[#fcfbf9]">
                  {sortTh('ID', 'id', sort, setSort)}
                  <th className="th">Design</th>
                  {sortTh('Price', 'price', sort, setSort, 'text-right')}
                  {sortTh('Planned', 'planned', sort, setSort, 'text-right')}
                  {sortTh('Sold', 'sold', sort, setSort, 'text-right')}
                  <th className="th text-right">Damaged</th>
                  {sortTh('Remaining', 'remaining', sort, setSort, 'text-right')}
                  {sortTh('Stock value', 'value', sort, setSort, 'text-right')}
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const out = d.remaining === 0;
                  const low = !out && d.remaining <= lowThreshold;
                  return (
                    <tr key={d.id} className={cn(d.archived && 'opacity-55')}>
                      <td className="td"><span className="font-mono text-[0.72rem] font-bold text-primary-ink">{d.id}</span>{d.archived && <span className="ml-1.5 align-middle"><Badge tone="muted" withDot={false}>Archived</Badge></span>}</td>
                      <td className="td max-w-[260px]"><span className="block truncate text-[0.8rem] font-medium text-ink">{d.name}</span><span className="text-[0.65rem] text-faint">{d.category}</span></td>
                      <td className="td text-right tnum">{inr(d.price)}</td>
                      <td className="td text-right tnum text-muted">{num(d.planned)}</td>
                      <td className="td text-right tnum text-muted">{num(d.sold)}</td>
                      <td className="td text-right tnum text-muted">{d.damaged ? num(d.damaged) : '—'}</td>
                      <td className="td text-right">
                        <span className={cn('inline-flex min-w-12 items-center justify-end gap-1.5 text-[0.8rem] font-bold tnum', out ? 'text-danger' : low ? 'text-warning' : 'text-ink')}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', out ? 'bg-danger' : low ? 'bg-warning' : 'bg-success')} />
                          {num(d.remaining)}
                        </span>
                      </td>
                      <td className="td text-right tnum text-muted">{inr(d.stockValue)}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconBtn title="Add printing batch" onClick={() => setRestockId(d.id)}><PackagePlus size={15} strokeWidth={1.9} /></IconBtn>
                          <IconBtn title="Record damaged stock" onClick={() => setDamageId(d.id)}><ShieldAlert size={15} strokeWidth={1.9} /></IconBtn>
                          <IconBtn title="Edit design" onClick={() => { setEditing(d); setFormOpen(true); }}><Pencil size={15} strokeWidth={1.9} /></IconBtn>
                          <IconBtn title={d.archived ? 'Restore design' : 'Archive design'} onClick={async () => { if (!await archiveDesign(d.id, !d.archived)) return; pushToast('info', d.archived ? `${d.id} restored` : `${d.id} archived`, d.archived ? 'Back in the active catalogue.' : 'Sales history is kept; hidden from billing.'); }}>
                            {d.archived ? <ArchiveRestore size={15} strokeWidth={1.9} /> : <Archive size={15} strokeWidth={1.9} />}
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / edit dialog */}
      <DesignFormDialog open={formOpen} onClose={() => setFormOpen(false)} design={editing} categories={state.categories} addDesign={addDesign} updateDesign={updateDesign} defaultPrice={state.settings.defaultPrice} designs={state.designs} pushToast={pushToast} />

      {/* Restock dialog (shared) */}
      <RestockDialog designId={restockId} open={!!restockId} onClose={() => setRestockId(null)} />

      {/* Damage dialog */}
      <DamageDialog designId={damageId} onClose={() => setDamageId(null)} recordDamage={recordDamage} pushToast={pushToast} designs={state.designs} />
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary')}>
        <Icon size={17} strokeWidth={2} />
      </span>
      <span>
        <span className="block text-[0.6rem] font-bold uppercase tracking-[0.1em] text-faint">{label}</span>
        <span className="tnum text-[0.95rem] font-semibold leading-tight text-ink">{value}</span>
      </span>
    </div>
  );
}

function IconBtn({ title, onClick, children }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="rounded-lg p-2 text-muted transition-colors hover:bg-primary-soft hover:text-primary">
      {children}
    </button>
  );
}

/* ---------- Add / edit design ---------- */

function DesignFormDialog({ open, onClose, design, categories, addDesign, updateDesign, defaultPrice, designs, pushToast }) {
  const isEdit = !!design;
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(
      design
        ? { id: design.id, name: design.name, category: design.category, price: String(design.price), notes: design.notes || '', rights: design.rights || '' }
        : { id: nextDesignId(designs), name: '', category: categories[0] || 'Anime', price: String(defaultPrice), copies: '30', printCost: '10', sleeveCost: '2', notes: '', rights: 'Original artwork — rights cleared' },
    );
  }, [open, design, categories, defaultPrice, designs]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    if (isEdit) {
      if (!await updateDesign(design.id, { name: form.name.trim(), category: form.category, price: Number(form.price) || defaultPrice, notes: form.notes, rights: form.rights })) return;
      pushToast('success', `${design.id} updated`, 'Catalogue details saved.');
    } else {
      const idTaken = designs.some((d) => d.id.toLowerCase() === form.id.trim().toLowerCase());
      if (idTaken) { pushToast('warning', 'Design ID exists', `${form.id.trim()} is already used — pick another.`); return; }
      if (!await addDesign({ id: form.id.trim(), name: form.name.trim(), category: form.category, price: form.price, copies: form.copies, printCost: form.printCost, sleeveCost: form.sleeveCost, notes: form.notes, rights: form.rights })) return;
      pushToast('success', `${form.id.trim()} added`, 'Print batch recorded and linked to inventory.');
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} size="md" title={isEdit ? `Edit ${design.id}` : 'Add new design'} subtitle={isEdit ? 'Batch history below is preserved as printed.' : 'Creates the design and its first print batch.'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[7.5rem_1fr]">
          <div>
            <label className="label" htmlFor="df-id">Design ID</label>
            <input id="df-id" className="field font-mono font-semibold disabled:bg-paper disabled:text-muted" value={form.id || ''} onChange={set('id')} disabled={isEdit} required />
          </div>
          <div>
            <label className="label" htmlFor="df-name">Name / description</label>
            <input id="df-name" className="field" value={form.name || ''} onChange={set('name')} placeholder="e.g. Midnight Tokyo Skyline" autoFocus required />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="df-cat">Category</label>
            <Select id="df-cat" value={form.category || ''} onChange={set('category')}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          </div>
          <div>
            <label className="label" htmlFor="df-price">Selling price ₹</label>
            <input id="df-price" type="number" min="0" className="field tnum" value={form.price || ''} onChange={set('price')} required />
          </div>
        </div>
        {!isEdit && (
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-paper p-3">
            <div><label className="label" htmlFor="df-copies">Initial copies</label><input id="df-copies" type="number" min="1" className="field tnum" value={form.copies || ''} onChange={set('copies')} required /></div>
            <div><label className="label" htmlFor="df-print">Print ₹/copy</label><input id="df-print" type="number" min="0" step="0.5" className="field tnum" value={form.printCost || ''} onChange={set('printCost')} required /></div>
            <div><label className="label" htmlFor="df-sleeve">Sleeve ₹/copy</label><input id="df-sleeve" type="number" min="0" step="0.5" className="field tnum" value={form.sleeveCost || ''} onChange={set('sleeveCost')} required /></div>
          </div>
        )}
        {isEdit && design.batches?.length > 0 && (
          <div>
            <span className="label">Print batches — history preserved</span>
            <div className="scroll-thin max-h-36 overflow-y-auto rounded-xl border border-line">
              <table className="w-full">
                <thead><tr className="bg-[#fcfbf9]"><th className="th !py-1.5">Date</th><th className="th !py-1.5 text-right">Copies</th><th className="th !py-1.5 text-right">Print + Sleeve</th><th className="th !py-1.5 text-right">Unit</th></tr></thead>
                <tbody>
                  {design.batches.map((b) => (
                    <tr key={b.id}>
                      <td className="td !py-1.5 text-[0.74rem] text-muted">{new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="td !py-1.5 text-right tnum text-[0.76rem]">{b.copies}</td>
                      <td className="td !py-1.5 text-right tnum text-[0.76rem] text-muted">₹{b.printCost} + ₹{b.sleeveCost}</td>
                      <td className="td !py-1.5 text-right tnum text-[0.76rem] font-semibold">₹{(b.printCost + b.sleeveCost).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="df-notes">Notes</label><input id="df-notes" className="field" value={form.notes || ''} onChange={set('notes')} placeholder="e.g. Numbered limited edition of 40" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="df-rights">Rights / source</label><input id="df-rights" className="field" value={form.rights || ''} onChange={set('rights')} placeholder="Original artwork — rights cleared" /></div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{isEdit ? 'Save changes' : 'Add design'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

const nextDesignId = (designs) => {
  const max = designs.reduce((m, d) => {
    const n = parseInt(String(d.id).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `D${String(max + 1).padStart(3, '0')}`;
};

/* ---------- Damaged stock ---------- */

function DamageDialog({ designId, onClose, recordDamage, pushToast, designs }) {
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('Misprint / handling');

  useEffect(() => {
    if (designId) {
      setQty('1');
      setReason('Misprint / handling');
    }
  }, [designId]);

  const design = designs.find((d) => d.id === designId);
  if (!design) return <Dialog open={false} onClose={onClose} title="" />;

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(qty);
    if (!n || n <= 0) return;
    if (!await recordDamage(design.id, { qty: n, reason })) return;
    pushToast('info', `Damage logged for ${design.id}`, `${n} ${n === 1 ? 'copy' : 'copies'} marked unusable — ${reason}.`);
    onClose();
  };

  return (
    <Dialog open={!!designId} onClose={onClose} size="sm" title={`Record damaged stock — ${design.id}`} subtitle="Damaged copies leave sellable stock but stay in the books.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="dmg-qty">Damaged copies</label>
          <input id="dmg-qty" type="number" min="1" className="field tnum" value={qty} onChange={(e) => setQty(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="dmg-reason">Reason</label>
          <Select id="dmg-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option>Misprint / handling</option>
            <option>Transit damage</option>
            <option>Water / weather damage</option>
            <option>Customer return — unusable</option>
            <option>Display wear and tear</option>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary"><ShieldAlert size={16} strokeWidth={2} /> Log damage</Button>
        </div>
      </form>
    </Dialog>
  );
}
