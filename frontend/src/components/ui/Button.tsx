'use client';

import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import Link from 'next/link';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children?: React.ReactNode;
  href?: string;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      icon,
      iconPosition = 'left',
      children,
      disabled,
      href,
      fullWidth,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      // Primary - Orange CTA (main action)
      primary: cn(
        'bg-orange-500 text-white',
        'shadow-lg shadow-orange-500/25',
        'hover:bg-orange-400 hover:shadow-orange-500/40 hover:shadow-glow-orange',
        'active:scale-[0.98]'
      ),
      // Secondary - Outlined Blue
      secondary: cn(
        'bg-transparent border-2 border-blue-500/50 text-white',
        'hover:border-blue-400 hover:bg-blue-500/10',
        'active:scale-[0.98]'
      ),
      // Accent - Teal (success/growth actions)
      accent: cn(
        'bg-teal-500 text-white',
        'shadow-lg shadow-teal-500/25',
        'hover:bg-teal-400 hover:shadow-teal-500/40',
        'active:scale-[0.98]'
      ),
      // Danger - For destructive actions
      danger: cn(
        'bg-red-500 text-white',
        'shadow-lg shadow-red-500/25',
        'hover:bg-red-600 hover:shadow-red-500/40',
        'active:scale-[0.98]'
      ),
      // Ghost - Subtle hover
      ghost: cn(
        'bg-transparent text-gray-300',
        'hover:bg-white/10 hover:text-white',
        'active:scale-[0.98]'
      ),
      // Outline - Glass effect
      outline: cn(
        'glass-card border-white/20 text-white',
        'hover:bg-white/10 hover:border-white/30',
        'active:scale-[0.98]'
      ),
    };

    const sizeClasses = {
      sm: 'px-4 py-2 text-sm rounded-lg gap-1.5',
      md: 'px-6 py-3 text-base rounded-xl gap-2',
      lg: 'px-8 py-4 text-lg rounded-xl gap-2',
      xl: 'px-10 py-5 text-xl rounded-2xl gap-3',
    };

    const buttonContent = (
      <>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : icon && iconPosition === 'left' ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
        {!loading && icon && iconPosition === 'right' ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
      </>
    );

    const allClasses = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && 'w-full',
      className
    );

    // If href is provided, render as Link
    if (href) {
      return (
        <Link href={href}>
          <motion.span
            className={allClasses}
            whileHover={{ scale: disabled || loading ? 1 : 1.03 }}
            whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
          >
            {buttonContent}
          </motion.span>
        </Link>
      );
    }

    return (
      <motion.button
        ref={ref}
        className={allClasses}
        disabled={disabled || loading}
        whileHover={{ scale: disabled || loading ? 1 : 1.03 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        {...props}
      >
        {buttonContent}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
