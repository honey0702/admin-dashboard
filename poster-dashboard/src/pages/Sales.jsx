import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Search, Plus, Download, Eye, X, Ban, CircleCheck, ReceiptText, Banknote, Smartphone, CreditCard, ChevronDown,
} from 'lucide-react';
import { cn, inr, num, downloadCSV, formatDateTime, formatTime } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { totals, salesInRange, expensesInRange, expenseTotal, rangeBounds } from '../lib/finance';
import { startOfDay, subDays } from '../lib/dates';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog } from '../components/ui/dialog';
import { EmptyState } from '../components/ui/empty-state';

const PAY_ICON = { Cash: Banknote, UPI: Smartphone, Other: CreditCard };

export default function Sales() {
  const { state, cancelSale, pushToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [payment, setPayment] = useState('all');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('30d');
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Deep-link: /sales with state.openId opens the sale detail
  useEffect(() => {
    if (location.state?.openId) {
      setOpenId(location.state.openId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => { setConfirmCancel(false); setCancelReason(''); }, [openId]);

  const { from, to } = rangeBounds(range === 'month' ? 'month' : range);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.sales]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((s) => {
        if (range !== 'all' && !(new Date(s.date) >= from && new Date(s.date) <= to)) return false;
        if (payment !== 'all' && s.payment !== payment) return false;
        if (status !== 'all' && s.status !== status) return false;
        if (!q) return true;
        const hay = [s.id, s.note, s.payment, ...s.lines.map((l) => `${l.designId} ${l.name} ${l.category}`)].join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [state.sales, query, payment, status, range, from, to]);

  const visible = showAll ? filtered : filtered.slice(0, 40);
  const monthStats = useMemo(() => totals(salesInRange(state.sales, new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date())), [state.sales]);

  const openSale = filtered.find((s) => s.id === openId) || state.sales.find((s) => s.id === openId) || null;

  const exportCSV = () => {
    downloadCSV(
      'rang-poster-co-sales.csv',
      ['Sale Ref', 'Date', 'Posters', 'Items', 'Gross', 'Discount', 'Net', 'Payment', 'Status'],
      filtered.map((s) => [
        s.id,
        new Date(s.date).toLocaleString('en-IN'),
        s.lines.reduce((a, l) => a + l.qty, 0),
        s.lines.map((l) => `${l.designId} x${l.qty}`).join(' | '),
        s.gross,
        s.discount,
        s.net,
        s.payment,
        s.status,
      ]),
    );
    pushToast('success', 'Sales exported', `${filtered.length} record${filtered.length === 1 ? '' : 's'} downloaded as CSV.`);
  };

  return (
    <div className="space-y-4">
      {/* Stat strip + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div><p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-faint">This month</p><p className="tnum text-[1.05rem] font-semibold text-ink">{inr(monthStats.net)}</p></div>
          <div className="hidden h-8 w-px bg-line-2 sm:block" />
          <div><p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-faint">Transactions</p><p className="tnum text-[1.05rem] font-semibold text-ink">{monthStats.count}</p></div>
          <div className="hidden h-8 w-px bg-line-2 sm:block" />
          <div><p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-faint">Avg ticket</p><p className="tnum text-[1.05rem] font-semibold text-ink">{inr(monthStats.avgTicket)}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={exportCSV}><Download size={15} strokeWidth={2} /> <span className="hidden sm:inline">Export CSV</span></Button>
          <Button variant="primary" onClick={() => navigate('/sales/new')}><Plus size={16} strokeWidth={2.4} /> New Sale</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={15} strokeWidth={2.1} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sale ref, design, or note…" className="field pl-9" aria-label="Search sales" />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          <Select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </Select>
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment method">
            <option value="all">All payments</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Other">Other</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-5">
          <p className="text-[0.74rem] font-semibold text-muted tnum">{filtered.length} of {state.sales.length} sales</p>
          <p className="hidden text-[0.68rem] text-faint sm:block">Cancelled sales are kept for history and never count as revenue.</p>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No matching sales" sub="Try clearing the search or widening the date range." />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="bg-[#fcfbf9]">
                  <th className="th">Date &amp; time</th>
                  <th className="th">Ref</th>
                  <th className="th">Items</th>
                  <th className="th text-right">Posters</th>
                  <th className="th text-right">Gross</th>
                  <th className="th text-right">Disc.</th>
                  <th className="th text-right">Net</th>
                  <th className="th">Payment</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => {
                  const posters = s.lines.reduce((a, l) => a + l.qty, 0);
                  const PayIcon = PAY_ICON[s.payment] || Banknote;
                  const cancelled = s.status === 'cancelled';
                  return (
                    <tr key={s.id} className={cn(cancelled && 'opacity-55')}>
                      <td className="td"><div className="text-[0.8rem] font-medium text-ink tnum">{formatDateTime(s.date)}</div></td>
                      <td className="td font-mono text-[0.73rem] font-semibold text-primary-ink">{s.id}</td>
                      <td className="td max-w-[180px]"><span className="block truncate text-[0.77rem] text-ink-2">{s.lines.map((l) => l.designId).join(', ')}</span></td>
                      <td className="td text-right tnum">{posters}</td>
                      <td className="td text-right tnum text-muted">{inr(s.gross)}</td>
                      <td className="td text-right tnum text-muted">{s.discount ? `−${inr(s.discount)}` : '—'}</td>
                      <td className="td text-right tnum font-semibold text-ink">{inr(s.net)}</td>
                      <td className="td"><span className="inline-flex items-center gap-1.5 text-[0.76rem] font-medium text-ink-2"><PayIcon size={13} strokeWidth={2} />{s.payment}</span></td>
                      <td className="td">{cancelled ? <Badge tone="danger">Cancelled</Badge> : <Badge tone="success">Completed</Badge>}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setOpenId(s.id)} className="rounded-lg p-2 text-muted transition-colors hover:bg-primary-soft hover:text-primary" aria-label={`View ${s.id}`} title="View sale"><Eye size={15} strokeWidth={1.9} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > visible.length && (
          <button onClick={() => setShowAll(true)} className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-[0.78rem] font-semibold text-primary transition-colors hover:bg-primary-soft/50">
            Show {filtered.length - visible.length} more <ChevronDown size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* Sale detail dialog */}
      <Dialog
        open={!!openSale}
        onClose={() => setOpenId(null)}
        size="md"
        title={openSale ? `Sale ${openSale.id}` : 'Sale'}
        subtitle={openSale ? formatDateTime(openSale.date) : undefined}
        footer={openSale && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {openSale.status === 'completed' ? (
              confirmCancel ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <input autoFocus value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional) — e.g. miscounted quantity" className="field h-9 flex-1 text-[0.8rem]" aria-label="Cancellation reason" />
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>Keep sale</Button>
                    <Button variant="danger" size="sm" onClick={async () => { if (!await cancelSale(openSale.id, cancelReason.trim())) return; setOpenId(null); pushToast('info', 'Sale cancelled', `${openSale.id} voided — stock restored and history kept.`); }}><Ban size={14} /> Confirm cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}><Ban size={14} /> Cancel sale</Button>
                  <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>Close</Button>
                </>
              )
            ) : (
              <>
                <p className="max-w-[60%] text-[0.72rem] leading-snug text-muted">Cancelled {openSale.cancelledAt ? formatDateTime(openSale.cancelledAt) : ''}{openSale.cancelReason ? ` — “${openSale.cancelReason}”` : ''}. Stock was restored.</p>
                <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>Close</Button>
              </>
            )}
          </div>
        )}
      >
        {openSale && (
          <div>
            <table className="w-full">
              <thead>
                <tr><th className="th !pl-0">Design</th><th className="th text-center">Qty</th><th className="th text-right">Rate</th><th className="th text-right !pr-0">Total</th></tr>
              </thead>
              <tbody>
                {openSale.lines.map((l) => (
                  <tr key={l.designId}>
                    <td className="td !pl-0"><span className="font-mono text-[0.72rem] font-bold text-primary-ink">{l.designId}</span> <span className="text-[0.8rem] text-ink">{l.name}</span></td>
                    <td className="td text-center tnum">{l.qty}</td>
                    <td className="td text-right tnum text-muted">{inr(l.unitPrice)}</td>
                    <td className="td text-right tnum font-semibold !pr-0">{inr(l.qty * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 rounded-xl border border-line bg-paper p-3.5 text-[0.83rem]">
              <div className="flex justify-between text-muted"><span>Original bill</span><span className="tnum">{inr(openSale.gross)}</span></div>
              <div className="flex justify-between text-muted"><span>Discount</span><span className="tnum">−{inr(openSale.discount)}</span></div>
              <div className="flex justify-between border-t border-line pt-1.5 text-[0.95rem] font-bold text-ink"><span>Net collected · {openSale.payment}</span><span className="tnum">{inr(openSale.net)}</span></div>
            </div>
            {openSale.note && <p className="mt-2.5 text-[0.76rem] text-muted">Note: {openSale.note}</p>}
            <p className="mt-1.5 text-[0.68rem] text-faint">COGS {inr(openSale.lines.reduce((a, l) => a + l.unitCost * l.qty, 0))} · gross profit {inr(openSale.net - openSale.lines.reduce((a, l) => a + l.unitCost * l.qty, 0))}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
