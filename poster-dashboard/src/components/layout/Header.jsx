import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, Search, Bell, Plus, Truck, ChevronDown, TriangleAlert, PackageX, CalendarClock,
  Settings, LogOut, Download,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn, fullDate, greetingFor, downloadJSON } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { inventoryView } from '../../lib/finance';
import { Button } from '../ui/button';

const TITLES = {
  '/': 'Overview',
  '/inventory': 'Inventory',
  '/sales': 'Sales',
  '/sales/new': 'New Sale',
  '/home-delivery': 'Home Delivery',
  '/expenses': 'Expenses',
  '/daily-summary': 'Daily Summary',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, onClose]);
}

function DropdownPanel({ open, children, className }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className={cn('absolute right-0 z-50 mt-2 overflow-hidden rounded-xl border border-line bg-card shadow-pop', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Header({ onOpenMobileNav, onOpenPalette }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state, pushToast, logout } = useApp();
  const settings = state.settings;
  const now = new Date();

  const title = TITLES[pathname] || TITLES['/' + pathname.split('/')[1]] || 'Overview';
  const firstName = (settings.ownerName || 'there').split(' ')[0];

  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bellRef = useRef(null);
  const profileRef = useRef(null);
  useClickOutside(bellRef, () => setBellOpen(false));
  useClickOutside(profileRef, () => setProfileOpen(false));
  useEffect(() => {
    setBellOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const alerts = useMemo(() => {
    const inv = inventoryView(state.designs, state.sales);
    const low = inv.filter((d) => !d.archived && d.remaining > 0 && d.remaining <= settings.lowStockThreshold);
    const out = inv.filter((d) => !d.archived && d.remaining === 0);
    const waiting = state.orders.filter((o) => o.status === 'waiting-stock').length;
    const list = [];
    out.slice(0, 3).forEach((d) => list.push({ icon: PackageX, tone: 'danger', text: `${d.id} “${d.name}” is sold out`, to: '/inventory' }));
    low.slice(0, 3).forEach((d) => list.push({ icon: TriangleAlert, tone: 'warning', text: `${d.id} has ${d.remaining} left in stock`, to: '/inventory' }));
    if (waiting > 0) list.push({ icon: CalendarClock, tone: 'primary', text: `${waiting} customer order${waiting > 1 ? 's' : ''} waiting for stock`, to: '/home-delivery' });
    return list;
  }, [state.designs, state.sales, state.orders, settings.lowStockThreshold]);

  const initials = (settings.ownerName || 'R P').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Mobile nav trigger */}
        <button
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-black/5 hover:text-ink lg:hidden"
        >
          <Menu size={20} strokeWidth={1.9} />
        </button>

        {/* Greeting + page title + date */}
        <div className="min-w-0 flex-1">
          <p className="hidden truncate text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted sm:block">
            {greetingFor(now)}, {firstName} <span className="mx-1.5 text-faint">·</span>
            <span className="normal-case tracking-normal text-faint">{fullDate(now)}</span>
          </p>
          <p className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-faint sm:hidden">{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <h1 className="truncate text-[1.15rem] font-semibold leading-tight tracking-tight text-ink sm:text-[1.28rem]">
            {title}
          </h1>
        </div>

        {/* Quick actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" onClick={() => navigate('/home-delivery', { state: { newOrder: true } })}>
            <Truck size={16} strokeWidth={2} /> <span className="hidden lg:inline">Home Delivery</span>
          </Button>
          <Button variant="primary" onClick={() => navigate('/sales/new')}>
            <Plus size={16} strokeWidth={2.4} /> New Sale
          </Button>
        </div>

        {/* Global search */}
        <button
          onClick={onOpenPalette}
          aria-label="Search (Ctrl+K)"
          className="hidden h-10 items-center gap-2 rounded-lg border border-line-2 bg-white pl-3 pr-2 text-[0.82rem] text-muted shadow-sm transition-all hover:border-primary hover:text-ink sm:flex lg:w-48 xl:w-56"
        >
          <Search size={15} strokeWidth={2} />
          <span className="flex-1 truncate text-left">Search…</span>
          <kbd className="kbd">Ctrl K</kbd>
        </button>
        <button onClick={onOpenPalette} aria-label="Search" className="rounded-lg p-2 text-ink-2 hover:bg-black/5 hover:text-ink sm:hidden">
          <Search size={20} strokeWidth={1.9} />
        </button>

        {/* Alerts */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen((v) => !v)}
            aria-label="Notifications"
            className={cn('relative rounded-lg p-2 transition-colors', bellOpen ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-black/5 hover:text-ink')}
          >
            <Bell size={19} strokeWidth={1.9} />
            {alerts.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.55rem] font-bold text-white ring-2 ring-paper">
                {alerts.length}
              </span>
            )}
          </button>
          <DropdownPanel open={bellOpen} className="w-80 max-w-[90vw]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted">Needs attention</p>
              <span className="text-[0.68rem] font-semibold text-faint">{alerts.length} item{alerts.length === 1 ? '' : 's'}</span>
            </div>
            <div className="max-h-80 overflow-y-auto scroll-thin p-1.5">
              {alerts.length === 0 ? (
                <p className="px-3 py-6 text-center text-[0.8rem] text-muted">All clear — nothing needs attention.</p>
              ) : (
                alerts.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => { setBellOpen(false); navigate(a.to); }}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-paper"
                    >
                      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        a.tone === 'danger' && 'bg-danger-soft text-danger',
                        a.tone === 'warning' && 'bg-warning-soft text-warning',
                        a.tone === 'primary' && 'bg-primary-soft text-primary')}>
                        <Icon size={15} strokeWidth={2} />
                      </span>
                      <span className="text-[0.78rem] leading-snug text-ink-2">{a.text}</span>
                    </button>
                  );
                })
              )}
            </div>
          </DropdownPanel>
        </div>

        {/* Divider + profile */}
        <div className="hidden h-6 w-px bg-line-2 sm:block" />
        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-black/5" aria-haspopup="true" aria-expanded={profileOpen}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[0.72rem] font-bold tracking-wide text-white">
              {initials}
            </span>
            <span className="hidden text-left xl:block">
              <span className="block text-[0.8rem] font-semibold leading-tight text-ink">{settings.ownerName}</span>
              <span className="block text-[0.64rem] font-medium uppercase tracking-[0.08em] text-muted">{settings.ownerRole}</span>
            </span>
            <ChevronDown size={14} strokeWidth={2.2} className={cn('hidden text-muted transition-transform duration-200 xl:block', profileOpen && 'rotate-180')} />
          </button>
          <DropdownPanel open={profileOpen} className="w-56 py-1.5">
            <button onClick={() => { setProfileOpen(false); navigate('/settings'); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.82rem] font-medium text-ink-2 transition-colors hover:bg-paper hover:text-ink">
              <Settings size={15} strokeWidth={1.9} /> Shop settings
            </button>
            <button
              onClick={() => { setProfileOpen(false); downloadJSON('rang-poster-co-backup.json', state); pushToast('success', 'Backup downloaded', 'A JSON snapshot of all data was saved.'); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.82rem] font-medium text-ink-2 transition-colors hover:bg-paper hover:text-ink"
            >
              <Download size={15} strokeWidth={1.9} /> Export backup
            </button>
            <div className="my-1.5 h-px bg-line" />
            <button onClick={() => { setProfileOpen(false); logout(); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[0.82rem] font-medium text-danger transition-colors hover:bg-danger-soft/50">
              <LogOut size={15} strokeWidth={1.9} /> Sign out
            </button>
          </DropdownPanel>
        </div>
      </div>
    </header>
  );
}
