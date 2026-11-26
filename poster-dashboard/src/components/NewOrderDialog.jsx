import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Minus, Truck, Store, UserRound } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Select } from './ui/select';
import { Button } from './ui/button';
import { cn, inr } from '../lib/utils';
import { validateName, validatePhone, validatePin, validateAddress, normalizePhone, sanitizePhoneInput } from '../lib/validate';
import { useApp } from '../context/AppContext';
import { suggestedDiscount } from '../lib/finance';

const emptyCustomer = { name: '', phone: '', address: '', area: '', city: 'Surat', pin: '' };
const emptyErrors = { name: '', phone: '', address: '', pin: '' };

export function NewOrderDialog({ open, onClose }) {
  const { state, addOrder, pushToast } = useApp();
  const designs = useMemo(() => state.designs.filter((d) => !d.archived), [state.designs]);

  const [customer, setCustomer] = useState(emptyCustomer);
  const [items, setItems] = useState([{ designId: '', qty: 1 }]);
  const [method, setMethod] = useState('Home Delivery');
  const [payMode, setPayMode] = useState('Cash');
  const [payStatus, setPayStatus] = useState('unpaid');
  const [amountOverride, setAmountOverride] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState(emptyErrors);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomer(emptyCustomer);
      setItems([{ designId: '', qty: 1 }]);
      setMethod('Home Delivery');
      setPayMode('Cash');
      setPayStatus('unpaid');
      setAmountOverride(null);
      setNote('');
      setError('');
      setErrors(emptyErrors);
    }
  }, [open]);

  const priced = items.map((item) => {
    const design = designs.find((d) => d.id === item.designId);
    return { ...item, design, lineTotal: design ? design.price * item.qty : 0 };
  });
  const posters = priced.reduce((a, i) => a + (i.designId ? i.qty : 0), 0);
  const gross = priced.reduce((a, i) => a + i.lineTotal, 0);
  const discount = Math.min(suggestedDiscount(posters, state.rules), gross);
  const payable = amountOverride ?? Math.max(0, gross - discount);

  const setItem = (idx, patch) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  /** Validate one customer field; returns the error string ('' when valid). */
  const fieldError = (k, value) => {
    switch (k) {
      case 'name': return validateName(value);
      case 'phone': return validatePhone(value);
      case 'address': return validateAddress(value);
      case 'pin': return validatePin(value);
      default: return '';
    }
  };

  const setCust = (k) => (e) => {
    let value = e.target.value;
    if (k === 'phone') value = sanitizePhoneInput(value);
    if (k === 'pin') value = value.replace(/\D/g, '').slice(0, 6);
    setCustomer((c) => ({ ...c, [k]: value }));
    // re-validate live once a field has been flagged, so the error clears as the user fixes it
    setErrors((er) => (er[k] ? { ...er, [k]: fieldError(k, value) } : er));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanItems = priced.filter((i) => i.designId).map((i) => ({ designId: i.designId, qty: Math.max(1, i.qty | 0) }));

    const nextErrors = {
      name: fieldError('name', customer.name),
      phone: fieldError('phone', customer.phone),
      address: fieldError('address', customer.address),
      pin: fieldError('pin', customer.pin),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return setError('Please fix the highlighted customer fields.');
    }
    if (!cleanItems.length) return setError('Add at least one design to the order.');
    if (saving) return;

    setSaving(true);
    const phone = normalizePhone(customer.phone);
    const order = await addOrder({
      customer: {
        ...customer,
        name: customer.name.trim(),
        phone: phone.value, // normalized +91XXXXXXXXXX
        area: customer.area.trim(),
        address: customer.address.trim(),
        pin: customer.pin.trim(),
      },
      items: cleanItems,
      method,
      payment: { mode: payMode, amount: payable, status: payStatus },
      note: note.trim(),
    });
    setSaving(false);
    if (!order) { setError('Order could not be saved. Check the error and try again.'); return; }
    pushToast('success', `Order ${order.id} created`, `${cleanItems.length} design${cleanItems.length > 1 ? 's' : ''} · ${inr(payable)} · ${method}.`);
    onClose();
  };

  const fieldCls = (k) => cn('field', errors[k] && 'border-danger bg-danger-soft/40');

  return (
    <Dialog open={open} onClose={onClose} size="lg" title="New home delivery order" subtitle="Capture customer requests — nothing enters sales until fulfilled.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {/* Customer */}
        <fieldset>
          <legend className="label flex items-center gap-1.5"><UserRound size={12} strokeWidth={2.2} /> Customer</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <input className={fieldCls('name')} placeholder="Full name *" value={customer.name} onChange={setCust('name')} aria-label="Customer name" aria-invalid={!!errors.name} />
              {errors.name && <p className="mt-1 text-[0.68rem] font-medium text-danger">{errors.name}</p>}
            </div>
            <div>
              <input className={cn(fieldCls('phone'), 'tnum')} placeholder="Mobile number * (+91…)" inputMode="numeric" value={customer.phone} onChange={setCust('phone')} aria-label="Mobile number" aria-invalid={!!errors.phone} />
              {errors.phone && <p className="mt-1 text-[0.68rem] font-medium text-danger">{errors.phone}</p>}
            </div>
            <div className="sm:col-span-2">
              <input className={fieldCls('address')} placeholder="Address — building, society, landmark *" value={customer.address} onChange={setCust('address')} aria-label="Address" aria-invalid={!!errors.address} />
              {errors.address && <p className="mt-1 text-[0.68rem] font-medium text-danger">{errors.address}</p>}
            </div>
            <input className="field" placeholder="Area / locality" value={customer.area} onChange={setCust('area')} aria-label="Area" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input className={fieldCls('pin')} placeholder="PIN code" inputMode="numeric" value={customer.pin} onChange={setCust('pin')} aria-label="PIN code" aria-invalid={!!errors.pin} />
                {errors.pin && <p className="mt-1 text-[0.68rem] font-medium text-danger">{errors.pin}</p>}
              </div>
              <input className="field" placeholder="City" value={customer.city} onChange={setCust('city')} aria-label="City" />
            </div>
          </div>
        </fieldset>

        {/* Designs */}
        <fieldset>
          <legend className="label">Designs requested</legend>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={item.designId} onChange={(e) => setItem(idx, { designId: e.target.value })} className="min-w-0 flex-1" aria-label={`Design line ${idx + 1}`}>
                  <option value="">Select design…</option>
                  {designs.map((d) => (
                    <option key={d.id} value={d.id}>{d.id} — {d.name} · {inr(d.price)}</option>
                  ))}
                </Select>
                <div className="flex shrink-0 items-center rounded-lg border border-line-2 bg-white">
                  <button type="button" onClick={() => setItem(idx, { qty: Math.max(1, item.qty - 1) })} className="p-2 text-muted transition-colors hover:text-ink" aria-label="Decrease quantity"><Minus size={13} strokeWidth={2.4} /></button>
                  <input
                    type="number" min="1" value={item.qty}
                    onChange={(e) => setItem(idx, { qty: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
                    className="tnum h-8 w-11 border-x border-line text-center text-[0.85rem] font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label="Quantity"
                  />
                  <button type="button" onClick={() => setItem(idx, { qty: Math.min(99, item.qty + 1) })} className="p-2 text-muted transition-colors hover:text-ink" aria-label="Increase quantity"><Plus size={13} strokeWidth={2.4} /></button>
                </div>
                <button type="button" onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))} className="shrink-0 rounded-lg p-2 text-faint transition-colors hover:bg-danger-soft hover:text-danger" aria-label="Remove line">
                  <Trash2 size={16} strokeWidth={1.9} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setItems((arr) => [...arr, { designId: '', qty: 1 }])} className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-2 text-[0.78rem] font-semibold text-muted transition-colors hover:border-primary hover:text-primary">
            <Plus size={14} strokeWidth={2.4} /> Add design
          </button>
        </fieldset>

        {/* Fulfilment + payment */}
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Fulfilment</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-paper p-1">
              {[
                { id: 'Home Delivery', icon: Truck, label: 'Home Delivery' },
                { id: 'Customer Pickup', icon: Store, label: 'Pickup at stall' },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = method === opt.id;
                return (
                  <button
                    key={opt.id} type="button" onClick={() => setMethod(opt.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex h-9 items-center justify-center gap-1.5 rounded-md text-[0.75rem] font-semibold transition-all duration-150',
                      active ? 'bg-white text-primary shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
                    )}
                  >
                    <Icon size={14} strokeWidth={2} /> {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Payment</legend>
            <div className="grid grid-cols-2 gap-2">
              <Select value={payMode} onChange={(e) => setPayMode(e.target.value)} aria-label="Payment mode">
                <option>Cash</option>
                <option>UPI</option>
                <option>Other</option>
              </Select>
              <Select value={payStatus} onChange={(e) => setPayStatus(e.target.value)} aria-label="Payment status">
                <option value="unpaid">Due on delivery</option>
                <option value="paid">Paid in advance</option>
              </Select>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted">Payable</span>
              <input
                type="number" min="0" step="1"
                className="tnum w-24 bg-transparent text-right text-[0.95rem] font-bold text-ink outline-none"
                value={payable}
                onChange={(e) => setAmountOverride(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
                aria-label="Payable amount"
              />
            </div>
          </fieldset>
        </div>

        <div>
          <label className="label" htmlFor="order-note">Note <span className="normal-case text-faint">(optional)</span></label>
          <input id="order-note" className="field" placeholder="e.g. Call before delivery" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {/* Live total strip */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-primary-soft2 bg-primary-soft/40 px-4 py-2.5 text-[0.75rem]">
          <span className="text-muted"><strong className="text-ink tnum">{items.filter((i) => i.designId).length}</strong> design{items.filter((i) => i.designId).length === 1 ? '' : 's'}</span>
          <span className="text-muted"><strong className="text-ink tnum">{posters}</strong> poster{posters === 1 ? '' : 's'}</span>
          <span className="text-muted">Gross <strong className="text-ink tnum">{inr(gross)}</strong></span>
          {discount > 0 && <span className="text-muted">Combo saving <strong className="text-success tnum">−{inr(discount)}</strong></span>}
          <span className="ml-auto text-[0.85rem] font-bold text-primary-ink tnum">{inr(payable)}</span>
        </div>

        {error && <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[0.78rem] font-medium text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} type="submit" variant="primary"><Truck size={16} strokeWidth={2.1} /> Save order</Button>
        </div>
      </form>
    </Dialog>
  );
}
