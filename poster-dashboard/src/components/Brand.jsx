import { cn } from '../lib/utils';

export function BrandMark({ size = 34, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={cn('shrink-0', className)} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#173D35" />
      <path d="M22.5 15.5h19a3.5 3.5 0 0 1 3.5 3.5v26a3.5 3.5 0 0 1-3.5 3.5h-19a3.5 3.5 0 0 1-3.5-3.5V19a3.5 3.5 0 0 1 3.5-3.5Z" stroke="#fff" strokeWidth="3.2" />
      <path d="M25 26h14M25 32.5h14M25 39h8.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ compact = false }) {
  if (compact) return <BrandMark size={30} />;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark size={34} />
      <div className="leading-none">
        <span className="font-display text-[1.28rem] font-semibold tracking-tight text-ink">Rang</span>
        <p className="mt-1 text-[0.55rem] font-bold uppercase tracking-[0.32em] text-muted">Poster Co.</p>
      </div>
    </div>
  );
}
