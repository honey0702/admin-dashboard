import { PackageSearch } from 'lucide-react';

export function EmptyState({ icon: Icon = PackageSearch, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <p className="text-[0.92rem] font-semibold text-ink">{title}</p>
      {sub && <p className="max-w-sm text-[0.8rem] leading-relaxed text-muted">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
