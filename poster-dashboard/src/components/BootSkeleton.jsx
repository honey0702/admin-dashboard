import { Skeleton } from './ui/skeleton';
import { BrandMark } from './Brand';

/** First-paint skeleton — the whole shell, softly shimmering, ~600ms. */
export function BootSkeleton() {
  return (
    <div className="flex min-h-screen bg-paper font-sans" aria-busy="true" aria-label="Loading Rang Poster Co.">
      {/* Sidebar ghost */}
      <div className="hidden w-[248px] shrink-0 border-r border-line bg-card lg:flex lg:flex-col lg:p-4">
        <div className="flex h-12 items-center gap-2.5 border-b border-line pb-4">
          <BrandMark size={30} className="opacity-90" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
        <div className="mt-auto">
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>

      {/* Content ghost */}
      <div className="min-w-0 flex-1">
        <div className="flex h-16 items-center justify-between border-b border-line bg-paper px-4 sm:px-6 lg:px-8">
          <div className="space-y-1.5">
            <Skeleton className="h-2 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-lg max-sm:hidden" />
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px]" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Skeleton className="h-[360px] xl:col-span-8" style={{ animationDelay: '140ms' }} />
            <div className="flex flex-col gap-5 xl:col-span-4">
              <Skeleton className="h-[236px]" style={{ animationDelay: '200ms' }} />
              <Skeleton className="h-[150px]" style={{ animationDelay: '260ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
