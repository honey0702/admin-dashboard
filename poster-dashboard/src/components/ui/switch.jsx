import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Switch({ checked, onChange, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle'}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-pointer',
        checked ? 'bg-primary' : 'bg-[#d8d6cf]',
        className,
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm',
          checked ? 'right-0.5' : 'left-0.5',
        )}
      />
    </button>
  );
}
