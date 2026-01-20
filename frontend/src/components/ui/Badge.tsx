'use client';

import { cn } from '@/lib/utils';
import { LoanStatus, LoanRequestStatus, HealthStatus } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-gray-500/20 text-gray-300',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-primary-500/20 text-primary-400',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size]
      )}
    >
      {children}
    </span>
  );
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  const config = {
    [LoanStatus.NULL]: { label: 'None', variant: 'default' as const },
    [LoanStatus.ACTIVE]: { label: 'Active', variant: 'info' as const },
    [LoanStatus.REPAID]: { label: 'Repaid', variant: 'success' as const },
    [LoanStatus.LIQUIDATED]: { label: 'Liquidated', variant: 'danger' as const },
    [LoanStatus.DEFAULTED]: { label: 'Defaulted', variant: 'danger' as const },
  };

  const { label, variant } = config[status] || config[LoanStatus.NULL];

  return <Badge variant={variant}>{label}</Badge>;
}

export function RequestStatusBadge({ status }: { status: LoanRequestStatus }) {
  const config = {
    [LoanRequestStatus.PENDING]: { label: 'Pending', variant: 'warning' as const },
    [LoanRequestStatus.FUNDED]: { label: 'Funded', variant: 'success' as const },
    [LoanRequestStatus.EXPIRED]: { label: 'Expired', variant: 'default' as const },
    [LoanRequestStatus.CANCELLED]: { label: 'Cancelled', variant: 'danger' as const },
  };

  const { label, variant } = config[status] || config[LoanRequestStatus.PENDING];

  return <Badge variant={variant}>{label}</Badge>;
}

export function HealthBadge({ status, value }: { status: HealthStatus; value: string }) {
  const config = {
    healthy: { label: 'Healthy', variant: 'success' as const },
    warning: { label: 'Warning', variant: 'warning' as const },
    danger: { label: 'At Risk', variant: 'danger' as const },
    liquidatable: { label: 'Liquidatable', variant: 'danger' as const },
  };

  const { label, variant } = config[status];

  return (
    <Badge variant={variant}>
      {label} ({value})
    </Badge>
  );
}
