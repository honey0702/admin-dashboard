import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * shadcn-style dialog: portal, backdrop blur, escape to close,
 * spring-eased entrance, reduced-motion aware.
 */
export function Dialog({ open, onClose, title, subtitle, children, footer, size = 'md', className }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-[#121F1A]/48 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className={cn(
              'relative z-10 flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-pop sm:rounded-2xl',
              sizes[size],
              className,
            )}
          >
            {(title || subtitle) && (
              <div className="flex items-start justify-between gap-6 border-b border-line px-5 py-4 sm:px-6">
                <div>
                  {title && <h2 className="text-[1.02rem] font-semibold tracking-tight text-ink">{title}</h2>}
                  {subtitle && <p className="mt-0.5 text-[0.78rem] text-muted">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1.5 rounded-lg p-1.5 text-muted transition-colors hover:bg-black/5 hover:text-ink"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            )}
            <div className="scroll-thin grow overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="border-t border-line bg-[#fcfbf9] px-5 py-3.5 sm:px-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
