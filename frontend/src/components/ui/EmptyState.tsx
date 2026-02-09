'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LottieAnimation } from './LottieAnimation';
import { Button } from './Button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
}

interface EmptyStateProps {
  /** Title displayed below the animation */
  title: string;
  /** Description text */
  description?: string;
  /** Path to .lottie animation file (optional) */
  lottieUrl?: string;
  /** Fallback icon if no lottie is provided */
  icon?: ReactNode;
  /** Width of the lottie animation */
  lottieWidth?: number | string;
  /** Height of the lottie animation */
  lottieHeight?: number | string;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether to animate the entrance */
  animated?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable empty state component with optional Lottie animation
 * Use this across the website for consistent empty state UI
 */
export function EmptyState({
  title,
  description,
  lottieUrl,
  icon,
  lottieWidth = 200,
  lottieHeight = 200,
  action,
  secondaryAction,
  className,
  animated = true,
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-8',
      title: 'text-lg',
      description: 'text-sm',
      lottieSize: 120,
    },
    md: {
      container: 'py-12',
      title: 'text-xl',
      description: 'text-base',
      lottieSize: 200,
    },
    lg: {
      container: 'py-20',
      title: 'text-2xl',
      description: 'text-lg',
      lottieSize: 280,
    },
  };

  const currentSize = sizeClasses[size];

  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        currentSize.container,
        className
      )}
    >
      {/* Lottie Animation or Fallback Icon */}
      {lottieUrl ? (
        <div className="mb-6">
          <LottieAnimation
            src={lottieUrl}
            width={typeof lottieWidth === 'number' ? lottieWidth : currentSize.lottieSize}
            height={typeof lottieHeight === 'number' ? lottieHeight : currentSize.lottieSize}
            loop={true}
            autoplay={true}
          />
        </div>
      ) : icon ? (
        <div className="mb-6 w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center">
          {icon}
        </div>
      ) : null}

      {/* Title */}
      <h3
        className={cn(
          'font-semibold text-white mb-2',
          currentSize.title
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-gray-400 max-w-md mb-6',
            currentSize.description
          )}
        >
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            action.href ? (
              <Link href={action.href}>
                <Button
                  variant={action.variant || 'primary'}
                  icon={action.icon}
                >
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant={action.variant || 'primary'}
                onClick={action.onClick}
                icon={action.icon}
              >
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Link href={secondaryAction.href}>
                <Button
                  variant={secondaryAction.variant || 'secondary'}
                  icon={secondaryAction.icon}
                >
                  {secondaryAction.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant={secondaryAction.variant || 'secondary'}
                onClick={secondaryAction.onClick}
                icon={secondaryAction.icon}
              >
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

export default EmptyState;
