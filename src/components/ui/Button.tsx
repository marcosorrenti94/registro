import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'bg-plum text-on-plum hover:bg-plum-strong disabled:bg-surface-2 disabled:text-ink-3 disabled:ring-1 disabled:ring-line-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2 disabled:opacity-50',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-40',
  danger: 'bg-uscite text-white hover:brightness-95 dark:text-[#2a0f14] disabled:opacity-50',
};

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-13 px-6 text-base',
  icon: 'size-11 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
