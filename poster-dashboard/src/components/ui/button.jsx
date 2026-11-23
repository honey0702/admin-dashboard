import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white shadow-sm hover:bg-primary-2 active:bg-primary-3 rounded-lg',
        dark: 'bg-ink text-white hover:bg-[#26332C] active:bg-[#18241F] rounded-lg shadow-sm',
        outline:
          'bg-white text-ink border border-line-2 hover:border-primary hover:text-primary rounded-lg',
        soft: 'bg-primary-soft text-primary-ink hover:bg-primary-soft2 rounded-lg',
        ghost: 'text-ink-2 hover:bg-black/[0.045] hover:text-ink rounded-lg',
        danger: 'bg-danger-soft text-danger hover:bg-[#f3dcd6] rounded-lg',
      },
      size: {
        sm: 'h-8 px-3 text-[0.78rem]',
        md: 'h-10 px-4 text-[0.85rem]',
        lg: 'h-11 px-5 text-[0.9rem]',
        icon: 'h-9 w-9 rounded-lg',
        iconSm: 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
