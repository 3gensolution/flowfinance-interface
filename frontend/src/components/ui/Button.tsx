'use client';

import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary: 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-400 hover:to-accent-400 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 text-white',
      secondary: 'glass-card hover:bg-white/10 text-white',
      danger: 'bg-red-500 hover:bg-red-600 text-white',
      ghost: 'hover:bg-white/10 text-gray-300 hover:text-white',
    };

    const sizeClasses = {
      sm: 'px-4 py-2 text-sm rounded-lg gap-1.5',
      md: 'px-6 py-3 text-base rounded-xl gap-2',
      lg: 'px-8 py-4 text-lg rounded-xl gap-2',
    };

    return (
      <motion.button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        disabled={disabled || loading}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
