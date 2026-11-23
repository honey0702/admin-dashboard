import { cn } from '../../lib/utils';

const tones = {
  neutral: 'bg-[#f2f0ea] text-ink-2 border-transparent',
  primary: 'bg-primary-soft text-primary-ink border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  outline: 'bg-transparent text-ink-2 border-line-2',
  muted: 'bg-transparent text-muted border-line',
};
const dot = {
  neutral: 'bg-faint',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-[#c98a1b]',
  danger: 'bg-danger',
  outline: 'bg-faint',
  muted: 'bg-faint',
};

export function Badge({ tone = 'neutral', className, children, withDot = true }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[0.68rem] font-semibold leading-none tracking-[0.01em]',
        tones[tone],
        className,
      )}
    >
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full', dot[tone])} />}
      {children}
    </span>
  );
}
