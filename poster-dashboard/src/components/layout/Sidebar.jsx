import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Boxes, ReceiptText, Truck, Wallet, CalendarDays, Settings,
  PanelLeftClose, PanelLeftOpen, HardDrive, Target, X,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn, inr } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { salesInRange, totals } from '../../lib/finance';
import { BrandMark } from '../Brand';
import { Button } from '../ui/button';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/sales', label: 'Sales', icon: ReceiptText },
  { to: '/home-delivery', label: 'Home Delivery', icon: Truck, badge: 'orders' },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/daily-summary', label: 'Daily Summary', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function useMonthNet() {
  const { state } = useApp();
  return useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return totals(salesInRange(state.sales, from, now)).net;
  }, [state.sales]);
}

function NavItems({ collapsed, indicatorId, onNavigate }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state } = useApp();
  const pendingOrders = state.orders.filter((o) => ['request-received', 'waiting-stock'].includes(o.status)).length;

  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Primary">
      {NAV.map((item) => {
        const active = isActive(item.to);
        const Icon = item.icon;
        const badge = item.badge === 'orders' && pendingOrders > 0 ? pendingOrders : null;
        return (
          <button
            key={item.to}
            onClick={() => {
              navigate(item.to);
              onNavigate?.();
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex h-10 items-center gap-3 rounded-lg px-2.5 text-[0.845rem] font-medium outline-none transition-colors duration-150',
              active ? 'text-primary-ink' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? item.label : undefined}
          >
            {active && (
              <motion.span
                layoutId={indicatorId}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-lg bg-primary-soft"
              />
            )}
            <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
              <Icon size={19} strokeWidth={active ? 2.1 : 1.8} className={active ? 'text-primary' : 'text-muted transition-colors group-hover:text-ink'} />
            </span>
            {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
            {!collapsed && badge && (
              <span className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.62rem] font-bold text-white">
                {badge}
              </span>
            )}
            {collapsed && badge && <span className="absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-primary" />}
            {/* Collapsed hover tooltip */}
            {collapsed && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 -translate-x-1 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[0.72rem] font-medium text-white opacity-0 shadow-pop transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
                {item.label}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function BreakEvenMini({ collapsed }) {
  const { state } = useApp();
  const monthNet = useMonthNet();
  const target = state.settings.breakEvenTarget || 1;
  const progress = Math.min(100, (monthNet / target) * 100);

  if (collapsed) {
    return (
      <div className="flex justify-center px-3 pb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary" title={`Break-even: ${inr(monthNet)} of ${inr(target)}`}>
          <Target size={17} strokeWidth={1.9} />
        </div>
      </div>
    );
  }
  return (
    <div className="mx-3 mb-2 rounded-xl border border-line bg-[#fcfbf8] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.09em] text-muted">
          <Target size={12} strokeWidth={2.2} className="text-primary" /> Break-even
        </p>
        <span className="text-[0.68rem] font-semibold tnum text-ink-2">{Math.round(progress)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>
      <p className="mt-1.5 text-[0.68rem] leading-snug text-muted tnum">
        {inr(monthNet)} <span className="text-faint">of</span> {inr(target)} <span className="text-faint">this month</span>
      </p>
    </div>
  );
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCloseMobile();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCloseMobile]);

  const body = (indicatorId, isMobile) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn('flex h-16 shrink-0 items-center border-b border-line px-4', collapsed ? 'justify-center px-2' : 'justify-between')}>
        {collapsed ? (
          <BrandMark size={30} />
        ) : (
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <div className="leading-none">
              <span className="font-display text-[1.22rem] font-semibold tracking-tight text-ink">Rang</span>
              <p className="mt-[3px] text-[0.52rem] font-bold uppercase tracking-[0.34em] text-muted">Poster Co.</p>
            </div>
          </div>
        )}
        {isMobile && (
          <button onClick={onCloseMobile} aria-label="Close menu" className="rounded-lg p-2 text-muted hover:bg-black/5 hover:text-ink">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="scroll-thin grow overflow-y-auto py-4">
        <NavItems collapsed={collapsed && !isMobile} indicatorId={indicatorId} onNavigate={isMobile ? onCloseMobile : undefined} />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-line pt-2">
        <BreakEvenMini collapsed={collapsed && !isMobile} />
        {!collapsed && (
          <div className="flex items-center gap-2 px-5 pb-1.5 text-[0.66rem] text-faint">
            <HardDrive size={12} strokeWidth={2} />
            <span className="truncate">Connected to database</span>
          </div>
        )}
        <div className={cn('flex px-3 pb-3', collapsed && !isMobile ? 'justify-center' : 'justify-end')}>
          {!isMobile && (
            <Button variant="ghost" size="iconSm" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / laptop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-card transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block',
          collapsed ? 'w-[76px]' : 'w-[248px]',
        )}
      >
        {body('nav-active-desktop', false)}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-[#121F1A]/48 backdrop-blur-[2px] lg:hidden"
              onClick={onCloseMobile}
            />
            <motion.aside
              key="drawer"
              initial={reduce ? { opacity: 0 } : { x: -300 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { x: -300 }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 w-[278px] border-r border-line bg-card lg:hidden"
            >
              {body('nav-active-mobile', true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
