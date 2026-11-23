import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Trash2, Pencil, Download, Wallet, BadgeInfo, PieChart, CalendarDays, RefreshCcw, Zap,
} from 'lucide-react';
import { cn, inr, downloadCSV, formatDay } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { expensesInRange, expenseTotal } from '../lib/finance';
import { startOfDay } from '../lib/dates';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog } from '../components/ui/dialog';
import { EmptyState } from '../components/ui/empty-state';

export default function Expenses() {
  const { state, addExpense, updateExpense, deleteExpense, pushToast } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [mode, setMode] = useState('all');
  const [kind, setKind] = useState('all');
  const [editing, setEditing] = useState(null); // expense | 'new' | null
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { expenses } = state;

  const monthExpenses = useMemo(() => {
    const now = new Date();
    return expensesInRange(expenses, new Date(now.getFullYear(), now.getMonth(), 1), now);
  }, [expenses]);

  const summary = useMemo(() => {
    const total = expenseTotal(monthExpenses);
    const oneTime = expenseTotal(monthExpenses.filter((e) => e.kind !== 'recurring'));
    const recurring = total - oneTime;
    const byCat = new Map();
    for (const e of monthExpenses) byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount);
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, oneTime, recurring, cats, max: Math.max(1, ...cats.map(([, v]) => v)) };
  }, [monthExpenses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((e) => {
        if (category !== 'all' && e.category !== category) return false;
        if (mode !== 'all' && e.mode !== mode) return false;
        if (kind !== 'all' && e.kind !== kind) return false;
        if (!q) return true;
        return [e.description, e.note, e.category, e.mode].join(' ').toLowerCase().includes(q);
      });
  }, [expenses, query, category, mode, kind]);

  const categories = useMemo(() => [...new Set([...(state.expenseCategories || []), ...expenses.map((e) => e.category)])].sort(), [expenses, state.expenseCategories]);

  const exportCSV = () => {
    downloadCSV('rang-poster-co-expenses.csv', ['Date', 'Category', 'Description', 'Amount', 'Mode', 'Type', 'Note'], filtered.map((e) => [new Date(e.date).toLocaleDateString('en-IN'), e.category, e.description, e.amount, e.mode, e.kind, e.note || '']));
    pushToast('success', 'Expenses exported', `${filtered.length} record${filtered.length === 1 ? '' : 's'} downloaded as CSV.`);
  };

  const isNew = editing === 'new';
  const editingExpense = editing && editing !== 'new' ? editing : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
      {/* ---------- Summary rail ---------- */}
      <aside className="space-y-4 xl:col-span-4 2xl:col-span-3">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[0.9rem] font-semibold tracking-tight text-ink"><Wallet size={15} className="text-primary" strokeWidth={2} /> This month</h2>
            <Badge tone="outline" withDot={false}><CalendarDays size={11} className="mr-1" />{new Date().toLocaleDateString('en-IN', { month: 'long' })}</Badge>
          </div>
          <p className="tnum mt-3 font-display text-[1.9rem] font-semibold leading-none tracking-tight text-ink">{inr(summary.total)}</p>
          <p className="mt-1 text-[0.7rem] text-muted">{monthExpenses.length} entr{monthExpenses.length === 1 ? 'y' : 'ies'} recorded</p>

          <div className="mt-4 space-y-2 border-t border-line pt-4 text-[0.78rem]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted"><Zap size={12} strokeWidth={2.2} className="text-warning" /> One-time</span>
              <span className="tnum font-semibold text-ink">{inr(summary.oneTime)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-warning transition-all duration-700" style={{ width: `${summary.total ? (summary.oneTime / summary.total) * 100 : 0}%` }} /></div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted"><RefreshCcw size={12} strokeWidth={2.2} className="text-primary" /> Recurring</span>
              <span className="tnum font-semibold text-ink">{inr(summary.recurring)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${summary.total ? (summary.recurring / summary.total) * 100 : 0}%` }} /></div>
          </div>

          {summary.cats.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.1em] text-muted"><PieChart size={11} strokeWidth={2.3} /> Where it went</p>
              <ul className="mt-2 space-y-1.5">
                {summary.cats.map(([cat, amount]) => (
                  <li key={cat} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[0.73rem]">
                    <span className="truncate text-ink-2">{cat}</span>
                    <span className="tnum font-semibold text-ink">{inr(amount)}</span>
                    <span className="col-span-2 h-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${(amount / summary.max) * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3 rounded-xl border border-primary-soft2 bg-primary-soft/40 p-3.5">
          <BadgeInfo size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-[0.72rem] leading-relaxed text-primary-ink"><strong>No double-counting.</strong> Printing &amp; sleeve costs live inside inventory (COGS) and never appear here. This log is only for running the stall — transport, setup, daily bits.</p>
        </div>
      </aside>

      {/* ---------- Table ---------- */}
      <section className="xl:col-span-8 2xl:col-span-9">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[170px] flex-1">
            <Search size={15} strokeWidth={2.1} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search description, category, note…" className="field pl-9" aria-label="Search expenses" />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="w-36 sm:w-40">
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Payment mode" className="w-24 sm:w-28">
            <option value="all">All modes</option>
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
            <option>Bank</option>
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Expense type" className="w-32 sm:w-36">
            <option value="all">All types</option>
            <option value="one-time">One-time</option>
            <option value="recurring">Recurring</option>
          </Select>
          <Button variant="primary" onClick={() => setEditing('new')}><Plus size={16} strokeWidth={2.4} /> Add expense</Button>
        </div>

        <div className="card mt-3 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
            <p className="text-[0.74rem] font-semibold text-muted tnum">{filtered.length} record{filtered.length === 1 ? '' : 's'} · {inr(expenseTotal(filtered))}</p>
            <div className="flex items-center gap-3">
              <p className="hidden text-[0.68rem] text-faint lg:block">Totals respect the active filters.</p>
              <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-primary transition-colors hover:text-primary-2"><Download size={13} strokeWidth={2.2} /> Export CSV</button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={Wallet} title="No expenses found" sub="Nothing matches these filters. Add the first one, or widen the search." action={<Button size="sm" variant="primary" onClick={() => setEditing('new')}><Plus size={14} strokeWidth={2.4} /> Add expense</Button>} />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="dense-table w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="bg-[#fcfbf9]"><th className="th">Date</th><th className="th">Category</th><th className="th">Description</th><th className="th">Mode</th><th className="th">Type</th><th className="th text-right">Amount</th><th className="th text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="td tnum text-[0.78rem] text-muted">{formatDay(e.date)}</td>
                      <td className="td"><span className="inline-flex max-w-44 truncate rounded-md bg-paper px-2 py-1 text-[0.7rem] font-semibold text-ink-2" title={e.category}>{e.category}</span></td>
                      <td className="td max-w-[210px]"><span className="block truncate text-[0.8rem] text-ink" title={e.description}>{e.description}</span>{e.note && <span className="text-[0.64rem] text-faint">{e.note}</span>}</td>
                      <td className="td text-[0.76rem] text-ink-2">{e.mode}</td>
                      <td className="td">{e.kind === 'recurring' ? <Badge tone="primary" withDot={false}><RefreshCcw size={10} className="mr-1" />Recurring</Badge> : <Badge tone="neutral" withDot={false}><Zap size={10} className="mr-1" />One-time</Badge>}</td>
                      <td className="td text-right tnum font-semibold text-ink">{inr(e.amount)}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => setEditing(e)} className="rounded-lg p-2 text-muted transition-colors hover:bg-primary-soft hover:text-primary" aria-label="Edit expense" title="Edit"><Pencil size={14} strokeWidth={1.9} /></button>
                          {confirmDelete === e.id ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-danger-soft px-1.5 py-1">
                              <span className="text-[0.65rem] font-bold text-danger">Delete?</span>
                              <button className="rounded px-1 py-0.5 text-[0.68rem] font-bold text-danger hover:underline" onClick={async () => { if (!await deleteExpense(e.id)) return; setConfirmDelete(null); pushToast('info', 'Expense deleted', `${inr(e.amount)} — ${e.category}. Daily summaries recalculated.`); }}>Yes</button>
                              <button className="rounded px-1 py-0.5 text-[0.68rem] font-bold text-muted hover:underline" onClick={() => setConfirmDelete(null)}>No</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDelete(e.id)} className="rounded-lg p-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger" aria-label="Delete expense" title="Delete"><Trash2 size={14} strokeWidth={1.9} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Add / edit dialog */}
      <ExpenseFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        expense={editingExpense}
        isNew={isNew}
        categories={[...new Set([...categories])]}
        addExpense={addExpense}
        updateExpense={updateExpense}
        pushToast={pushToast}
      />
    </div>
  );
}

function ExpenseFormDialog({ open, onClose, expense, isNew, categories, addExpense, updateExpense, pushToast }) {
  const [form, setForm] = useState({});
  const [customCat, setCustomCat] = useState("");

  useEffect(() => {
    if (!open) return;
    setCustomCat('');
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    setForm(
      expense
        ? { date: new Date(expense.date).toISOString().slice(0, 10), category: expense.category, description: expense.description, amount: String(expense.amount), mode: expense.mode, kind: expense.kind, note: expense.note || '' }
        : { date: iso, category: categories[0] || '', description: '', amount: '', mode: 'Cash', kind: 'one-time', note: '' },
    );
  }, [open, expense, categories]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const finalCategory = form.category === '__new__' ? customCat.trim() : form.category;

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.description?.trim() || !amount || amount <= 0 || !finalCategory) return;
    const payload = { date: new Date(form.date).toISOString(), category: finalCategory, description: form.description.trim(), amount, mode: form.mode, kind: form.kind, note: form.note?.trim() || '' };
    if (isNew) {
      if (!await addExpense(payload)) return;
      pushToast('success', 'Expense added', `${inr(amount)} — ${finalCategory}. Daily summary updated.`);
    } else {
      if (!await updateExpense(expense.id, payload)) return;
      pushToast('success', 'Expense updated', `${inr(amount)} — ${finalCategory}.`);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm" title={isNew ? 'Add expense' : 'Edit expense'} subtitle="Daily summary and net profit update instantly.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="exp-date">Date</label><input id="exp-date" type="date" className="field" value={form.date || ''} onChange={set('date')} required /></div>
          <div><label className="label" htmlFor="exp-amount">Amount ₹</label><input id="exp-amount" type="number" min="0" step="1" className="field tnum" placeholder="0" value={form.amount || ''} onChange={set('amount')} required autoFocus={!isNew} /></div>
        </div>
        <div>
          <label className="label" htmlFor="exp-cat">Category</label>
          <Select id="exp-cat" value={form.category || ''} onChange={set('category')}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">+ New category…</option>
          </Select>
          {form.category === '__new__' && <input className="field mt-2" autoFocus placeholder="Category name — e.g. Sticker Sleeves" value={customCat} onChange={(e) => setCustomCat(e.target.value)} required aria-label="New category name" />}
        </div>
        <div><label className="label" htmlFor="exp-desc">Description</label><input id="exp-desc" className="field" placeholder="e.g. Auto to stall and back" value={form.description || ''} onChange={set('description')} required autoFocus={isNew} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="exp-mode">Payment mode</label>
            <Select id="exp-mode" value={form.mode || 'Cash'} onChange={set('mode')}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank</option></Select>
          </div>
          <div>
            <span className="label">Type</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-paper p-1">
              {[{ id: 'one-time', label: 'One-time' }, { id: 'recurring', label: 'Recurring' }].map((o) => (
                <button key={o.id} type="button" onClick={() => setForm((f) => ({ ...f, kind: o.id }))} aria-pressed={form.kind === o.id} className={cn('h-8 rounded-md text-[0.74rem] font-semibold transition-all', form.kind === o.id ? 'bg-white text-primary shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink')}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div><label className="label" htmlFor="exp-note">Receipt / note <span className="normal-case text-faint">(optional)</span></label><input id="exp-note" className="field" placeholder="e.g. Bill no. 2314" value={form.note || ''} onChange={set('note')} /></div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{isNew ? 'Add expense' : 'Save changes'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
