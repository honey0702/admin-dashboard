import { useRef, useState } from 'react';
import {
  Store, SlidersHorizontal, BadgePercent, Tags, DatabaseBackup, Server, ShieldCheck,
  Plus, Trash2, Pencil, Check, X, Download, Upload, RotateCcw, Lock, UserRound,
} from 'lucide-react';
import { cn, inr, downloadJSON } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { apiMode, API_BASE_URL } from '../lib/api';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';

export default function Settings() {
  const { state, updateSettings, addRule, updateRule, deleteRule, addCategory, renameCategory, importBackup, resetDemoData, pushToast } = useApp();
  const { settings, rules, categories } = state;
  const backupInput = useRef(null);
  const [resetArmed, setResetArmed] = useState(false);
  const [ruleQty, setRuleQty] = useState('');
  const [ruleSave, setRuleSave] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingCat, setEditingCat] = useState(null); // { old, value }

  const set = (key, cast = (v) => v) => (e) => updateSettings({ [key]: cast(e.target.value) });

  const submitRule = async (e) => {
    e.preventDefault();
    const qty = Number(ruleQty); const save = Number(ruleSave);
    if (!qty || qty < 1 || !save || save < 1) return;
    if (!await addRule({ qty, save })) return;
    setRuleQty(''); setRuleSave('');
    pushToast('success', 'Discount rule added', `${qty}+ posters now save ${inr(save)}.`);
  };

  const submitCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    if (!await addCategory(newCategory)) return;
    pushToast('success', 'Category added', `“${newCategory.trim()}” is ready for new designs.`);
    setNewCategory('');
  };

  const commitRename = async () => {
    if (!editingCat) return;
    const next = editingCat.value.trim();
    if (next && next !== editingCat.old) {
      if (categories.includes(next)) { pushToast('warning', 'Category exists', `“${next}” already exists — not renamed.`); }
      else { if (!await renameCategory(editingCat.old, next)) return; pushToast('success', 'Category renamed', `“${editingCat.old}” → “${next}”.`); }
    }
    setEditingCat(null);
  };

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (!await importBackup(String(reader.result))) return;
        pushToast('success', 'Backup restored', `${file.name} imported — everything reloaded.`);
      } catch (err) {
        pushToast('warning', 'Import failed', err?.message || 'That file is not a Rang Poster Co. backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-12">
      {/* ---------- Left column ---------- */}
      <div className="space-y-4 sm:space-y-5 xl:col-span-7">
        {/* Business profile */}
        <section className="card p-5">
          <SectionTitle icon={Store} title="Business profile" sub="Used on summaries and exports" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Business name"><input className="field" value={settings.businessName} onChange={set('businessName')} /></Field>
            <Field label="Owner name"><input className="field" value={settings.ownerName} onChange={set('ownerName')} /></Field>
            <Field label="Mobile"><input className="field tnum" value={settings.phone} onChange={set('phone')} /></Field>
            <Field label="Currency"><input className="field bg-paper text-muted" value="INR — Indian Rupee (₹)" disabled aria-label="Currency (locked)" /></Field>
            <Field label="Stall address" wide><input className="field" value={settings.address} onChange={set('address')} /></Field>
          </div>
        </section>

        {/* Discount rules */}
        <section className="card p-5">
          <SectionTitle icon={BadgePercent} title="Quantity discount rules" sub="Highest qualifying tier applies at the till — tap to enable or disable" />
          <ul className="mt-4 divide-y divide-[#efede8]">
            {rules.length === 0 && <li className="py-4 text-center text-[0.8rem] text-muted">No rules yet — add your first combo below.</li>}
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft font-mono text-[0.78rem] font-bold text-primary-ink tnum">{rule.qty}+</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.84rem] font-semibold text-ink">Buy {rule.qty} posters, save {inr(rule.save)}</p>
                  <p className="text-[0.68rem] text-muted">{rule.enabled ? 'Suggested automatically in New Sale' : 'Disabled — never suggested'}</p>
                </div>
                <Switch checked={rule.enabled} onChange={(v) => updateRule(rule.id, { enabled: v })} label={`Toggle ${rule.qty}+ posters rule`} />
                <button onClick={async () => { if (!await deleteRule(rule.id)) return; pushToast('info', 'Rule removed', `${rule.qty}+ posters — save ${inr(rule.save)} deleted.`); }} className="rounded-lg p-2 text-faint transition-colors hover:bg-danger-soft hover:text-danger" aria-label="Delete rule"><Trash2 size={15} strokeWidth={1.9} /></button>
              </li>
            ))}
          </ul>
          <form onSubmit={submitRule} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <Field label="Poster qty"><input type="number" min="1" className="field tnum w-24" placeholder="7" value={ruleQty} onChange={(e) => setRuleQty(e.target.value)} aria-label="Quantity threshold" /></Field>
            <Field label="Customer saves ₹"><input type="number" min="1" className="field tnum w-28" placeholder="60" value={ruleSave} onChange={(e) => setRuleSave(e.target.value)} aria-label="Discount amount" /></Field>
            <Button type="submit" variant="soft" className="h-10"><Plus size={16} strokeWidth={2.4} /> Add rule</Button>
            <p className="w-full text-[0.66rem] text-faint">A discount can never exceed the original bill — the till caps it automatically.</p>
          </form>
        </section>

        {/* Categories */}
        <section className="card p-5">
          <SectionTitle icon={Tags} title="Catalogue categories" sub="Rename carefully — every design in the category follows" />
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((cat) =>
              editingCat?.old === cat ? (
                <span key={cat} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary-soft/60 py-1 pl-3 pr-1">
                  <input
                    autoFocus
                    className="w-32 bg-transparent text-[0.8rem] font-semibold text-primary-ink outline-none"
                    value={editingCat.value}
                    onChange={(e) => setEditingCat({ ...editingCat, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingCat(null); }}
                    aria-label={`Rename ${cat}`}
                  />
                  <button onClick={commitRename} className="rounded-full p-1 text-primary hover:bg-white" aria-label="Confirm rename"><Check size={13} strokeWidth={2.6} /></button>
                  <button onClick={() => setEditingCat(null)} className="rounded-full p-1 text-muted hover:bg-white" aria-label="Cancel rename"><X size={13} strokeWidth={2.4} /></button>
                </span>
              ) : (
                <button key={cat} onClick={() => setEditingCat({ old: cat, value: cat })} title="Click to rename" className="group inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-white py-1.5 pl-3 pr-2 text-[0.78rem] font-semibold text-ink-2 transition-all hover:border-primary hover:text-primary">
                  {cat}
                  <Pencil size={11} strokeWidth={2.2} className="text-faint transition-colors group-hover:text-primary" />
                </button>
              ),
            )}
          </div>
          <form onSubmit={submitCategory} className="mt-3 flex items-center gap-2 border-t border-line pt-4">
            <input className="field h-9 flex-1 sm:max-w-64" placeholder="New category — e.g. Photography" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} aria-label="New category" />
            <Button type="submit" variant="outline" size="md"><Plus size={15} strokeWidth={2.4} /> Add</Button>
          </form>
        </section>
      </div>

      {/* ---------- Right column ---------- */}
      <div className="space-y-4 sm:space-y-5 xl:col-span-5">
        {/* Preferences */}
        <section className="card p-5">
          <SectionTitle icon={SlidersHorizontal} title="Shop preferences" sub="Numbers the whole app leans on" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Default price ₹"><input type="number" min="0" className="field tnum" value={settings.defaultPrice} onChange={set('defaultPrice', Number)} /></Field>
            <Field label="Low-stock alert at"><input type="number" min="1" className="field tnum" value={settings.lowStockThreshold} onChange={set('lowStockThreshold', Number)} /></Field>
            <Field label="Monthly break-even ₹" wide><input type="number" min="0" step="500" className="field tnum" value={settings.breakEvenTarget} onChange={set('breakEvenTarget', Number)} /></Field>
            <Field label="Default payment at till" wide>
              <Select value={settings.defaultPayment || 'UPI'} onChange={set('defaultPayment')}><option>UPI</option><option>Cash</option><option>Other</option></Select>
            </Field>
          </div>
        </section>

        {/* Data & backup */}
        <section className="card p-5">
          <SectionTitle icon={DatabaseBackup} title="Data &amp; backup" sub="Everything is yours — take it with you anytime" />
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => { downloadJSON('rang-poster-co-backup.json', state); pushToast('success', 'Backup downloaded', 'Full snapshot saved as JSON.'); }}><Download size={15} strokeWidth={2} /> Download backup</Button>
            <Button variant="outline" onClick={() => backupInput.current?.click()}><Upload size={15} strokeWidth={2} /> Restore backup</Button>
            <input ref={backupInput} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} aria-hidden="true" tabIndex={-1} />
          </div>
          <div className="mt-3 border-t border-line pt-3">
            {resetArmed ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/25 bg-danger-soft/60 p-3">
                <p className="w-full text-[0.76rem] font-semibold text-danger">Reset replaces database records with demo data. Your real entries will be lost.</p>
                <Button variant="danger" size="sm" onClick={async () => { if (!await resetDemoData()) return; setResetArmed(false); pushToast('info', 'Demo data restored', 'Fresh sample shop loaded.'); }}><RotateCcw size={13} /> Yes, reset everything</Button>
                <Button variant="ghost" size="sm" onClick={() => setResetArmed(false)}>Keep my data</Button>
              </div>
            ) : (
              <button onClick={() => setResetArmed(true)} className="text-[0.74rem] font-semibold text-faint underline decoration-dotted underline-offset-2 transition-colors hover:text-danger">Reset demo data…</button>
            )}
          </div>
        </section>

        {/* Backend / API */}
        <section className="card p-5">
          <SectionTitle icon={Server} title="Backend — Django REST API" sub="Business data is loaded from the Django API" />
          <div className="mt-3 flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold', apiMode === 'live' ? 'bg-success-soft text-success' : 'bg-[#f1efe9] text-muted')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', apiMode === 'live' ? 'bg-success' : 'bg-faint')} />
              {apiMode === 'live' ? 'Live backend connected' : 'Demo mode — data on this device'}
            </span>
            <code className="hidden truncate rounded-md bg-paper px-2 py-1 font-mono text-[0.62rem] text-muted sm:block">VITE_API_BASE_URL{apiMode === 'live' ? ` = ${API_BASE_URL}` : ' = (not set)'}</code>
          </div>
          <pre className="scroll-thin mt-3 overflow-x-auto rounded-xl border border-line bg-[#14241F] p-3 font-mono text-[0.62rem] leading-relaxed text-[#A9BFAE]">{`GET    /api/sales/           ?from=&to=&payment=
POST   /api/sales/           atomic create → stock, log, COGS
POST   /api/sales/:id/cancel/
GET    /api/designs/         ?search=D002&category=Anime
POST   /api/designs/:id/batches/   new print run
GET    /api/orders/          ?status=waiting-stock
POST   /api/orders/:id/fulfill/    order → sale
GET    /api/reports/daily/   ?date=2026-11-23`}</pre>
          <p className="mt-2 text-[0.68rem] leading-snug text-faint">Configure VITE_API_BASE_URL for your server. Changes are saved to the backend.</p>
        </section>

        {/* Access */}
        <section className="card p-5">
          <SectionTitle icon={ShieldCheck} title="Access &amp; permissions" sub="Owner controls everything; staff get exactly what you allow" />
          <ul className="mt-4 space-y-2 text-[0.8rem]">
            <li className="flex items-center justify-between gap-3 rounded-xl border border-primary-soft2 bg-primary-soft/40 px-3.5 py-2.5">
              <span className="flex items-center gap-2 font-semibold text-primary-ink"><UserRound size={15} strokeWidth={2} /> You — Owner</span>
              <Badge tone="primary" withDot={false}>Full access</Badge>
            </li>
            <li className="rounded-xl border border-line px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold text-ink"><Lock size={14} strokeWidth={2} className="text-muted" /> Staff accounts</span>
                <span className="text-[0.66rem] font-semibold uppercase tracking-wide text-faint">Configurable</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[0.66rem] font-semibold">
                <span className="rounded-md bg-success-soft px-2 py-1 text-success">New Sale</span>
                <span className="rounded-md bg-success-soft px-2 py-1 text-success">Home Delivery</span>
                <span className="rounded-md bg-[#f1efe9] px-2 py-1 text-faint line-through">Inventory edit</span>
                <span className="rounded-md bg-[#f1efe9] px-2 py-1 text-faint line-through">Expenses</span>
                <span className="rounded-md bg-[#f1efe9] px-2 py-1 text-faint line-through">Financials</span>
                <span className="rounded-md bg-[#f1efe9] px-2 py-1 text-faint line-through">Settings</span>
              </div>
            </li>
          </ul>
          <p className="mt-2 text-[0.68rem] text-faint">Roles are enforced by the backend, not just hidden in the UI — staff cannot reach restricted data even via direct URL.</p>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, sub }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-[0.9rem] font-semibold tracking-tight text-ink"><Icon size={16} strokeWidth={2} className="text-primary" />{title}</h2>
      {sub && <p className="mt-0.5 text-[0.7rem] text-muted">{sub}</p>}
    </div>
  );
}

function Field({ label, children, wide }) {
  return (
    <label className={cn('block', wide && 'sm:col-span-2')}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
