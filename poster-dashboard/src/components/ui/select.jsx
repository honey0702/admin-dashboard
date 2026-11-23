import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Native select with chevron — robust on every device, zero dependencies. */
export function Select({ className, children, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <select className="field appearance-none pr-8 cursor-pointer" {...props}>
        {children}
      </select>
      <ChevronDown size={14} strokeWidth={2.2} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}
