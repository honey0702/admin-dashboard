import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn, inr, num } from '../lib/utils';
import { useCountUp } from '../hooks/useCountUp';

const toneStyles = {
  primary: 'bg-primary-soft text-primary',
  ink: 'bg-[#efeee8] text-ink-2',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
};

/**
 * Slim KPI tile — count-up value, quiet delta line.
 * `invert` flags metrics where "up" is bad.
 */
export function KpiCard({ label, value, format = 'inr', delta, icon: Icon, tone = 'primary', invert = false, suffix, foot, index = 0 }) {
  const animated = useCountUp(Number(value) || 0, { duration: 1.1 });
  const display = format === 'inr' ? inr(animated) : num(animated);

  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const up = hasDelta && delta > 0;
  const flat = hasDelta && Math.abs(delta) < 0.05;
  const good = flat ? null : invert ? !up : up;
  const DeltaIcon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="card group p-4 transition-shadow duration-300 hover:shadow-lift"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.64rem] font-bold uppercase tracking-[0.13em] text-muted">{label}</p>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-transform duration-300 group-hover:scale-105', toneStyles[tone])}>
          <Icon size={14} strokeWidth={2} />
        </span>
      </div>
      <p className="tnum mt-2 text-[1.38rem] font-semibold leading-none tracking-tight text-ink sm:text-[1.5rem]">
        {display}
        {suffix && <span className="ml-1.5 text-[0.7rem] font-medium text-muted">{suffix}</span>}
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-[0.65rem] font-medium">
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 tnum',
              good === null && 'bg-[#efeee8] text-muted',
              good === true && 'bg-success-soft text-success',
              good === false && 'bg-danger-soft text-danger',
            )}
          >
            <DeltaIcon size={11} strokeWidth={2.4} />
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        <span className="truncate text-faint">{foot ?? 'vs prior 30d'}</span>
      </div>
    </motion.div>
  );
}
