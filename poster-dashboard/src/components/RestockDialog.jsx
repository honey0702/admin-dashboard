import { useEffect, useMemo, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Select } from './ui/select';
import { Button } from './ui/button';
import { todayISO, inr } from '../lib/utils';
import { useApp } from '../context/AppContext';

/** Record a new printing batch (historical costs are preserved per batch). */
export function RestockDialog({ designId, open, onClose }) {
  const { state, addBatch, pushToast } = useApp();
  const designs = state.designs;

  const [selectedId, setSelectedId] = useState(designId);
  const [copies, setCopies] = useState('20');
  const [printCost, setPrintCost] = useState('12');
  const [sleeveCost, setSleeveCost] = useState('2.5');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && designId) {
      setSelectedId(designId);
      const design = designs.find((d) => d.id === designId);
      const last = design?.batches?.[design.batches.length - 1];
      if (last) {
        setPrintCost(String(last.printCost));
        setSleeveCost(String(last.sleeveCost));
      }
    }
  }, [open, designId, designs]);

  const design = designs.find((d) => d.id === selectedId);
  const unit = (Number(printCost) || 0) + (Number(sleeveCost) || 0);
  const total = unit * (Number(copies) || 0);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(copies);
    if (!design || !n || n <= 0) return;
    if (!await addBatch(design.id, { copies: n, printCost: Number(printCost) || 0, sleeveCost: Number(sleeveCost) || 0, date: new Date(date).toISOString(), note: note || 'Restock' })) return;
    pushToast('success', `${design.id} restocked`, `+${n} copies added at ${inr(unit)} per poster (${inr(total)}).`);
    onClose();
    setCopies('20');
    setNote('');
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm" title="Add printing batch" subtitle="Historical batch costs are kept — COGS stays accurate.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="restock-design">Design</label>
          <Select id="restock-design" value={selectedId || ''} onChange={(e) => setSelectedId(e.target.value)} required>
            <option value="" disabled>Select a design…</option>
            {designs.filter((d) => !d.archived).map((d) => (
              <option key={d.id} value={d.id}>{d.id} — {d.name}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="restock-copies">Copies</label>
            <input id="restock-copies" type="number" min="1" className="field tnum" value={copies} onChange={(e) => setCopies(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="restock-print">Print ₹/copy</label>
            <input id="restock-print" type="number" min="0" step="0.5" className="field tnum" value={printCost} onChange={(e) => setPrintCost(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="restock-sleeve">Sleeve ₹/copy</label>
            <input id="restock-sleeve" type="number" min="0" step="0.5" className="field tnum" value={sleeveCost} onChange={(e) => setSleeveCost(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="restock-date">Print date</label>
            <input id="restock-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <span className="label">Batch value</span>
            <div className="field flex items-center justify-between bg-paper font-semibold tnum text-primary-ink">
              <span className="text-[0.72rem] font-medium text-muted">{copies || 0} × {inr(unit)}</span>
              {inr(total)}
            </div>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="restock-note">Note <span className="normal-case text-faint">(optional)</span></label>
          <input id="restock-note" className="field" placeholder="e.g. Reprint — rates increased" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary"><PackagePlus size={16} strokeWidth={2.1} /> Add batch</Button>
        </div>
      </form>
    </Dialog>
  );
}
