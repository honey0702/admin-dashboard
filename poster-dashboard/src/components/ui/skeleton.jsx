import { cn } from '../../lib/utils';

/** Shimmer placeholder used while chunks/data are loading. */
export function Skeleton({ className, ...rest }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-xl', className)} {...rest} />;
}
