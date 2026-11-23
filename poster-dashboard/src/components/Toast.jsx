import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';

const ICONS = {
  success: { Icon: CheckCircle2, cls: 'bg-success-soft text-success' },
  info: { Icon: Info, cls: 'bg-primary-soft text-primary' },
  warning: { Icon: TriangleAlert, cls: 'bg-warning-soft text-warning' },
};

export function ToastViewport() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-[4.6rem] right-4 z-[70] flex w-[min(92vw,340px)] flex-col gap-2 lg:bottom-6 lg:right-6">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const { Icon, cls } = ICONS[t.type] || ICONS.info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-card p-3 shadow-pop"
              role="status"
            >
              <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', cls)}>
                <Icon size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.82rem] font-semibold leading-snug text-ink">{t.title}</p>
                {t.sub && <p className="mt-0.5 text-[0.73rem] leading-snug text-muted">{t.sub}</p>}
              </div>
              <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="rounded-md p-1 text-faint transition-colors hover:bg-black/5 hover:text-ink">
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
