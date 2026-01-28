'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover = false, gradient = false, onClick }: CardProps) {
  const baseClasses = 'glass-card p-6';
  const hoverClasses = hover ? 'glass-card-hover cursor-pointer' : '';
  const gradientClasses = gradient ? 'gradient-border' : '';

  return (
    <motion.div
      className={cn(baseClasses, hoverClasses, gradientClasses, className)}
      onClick={onClick}
      whileHover={hover ? { scale: 1.02 } : undefined}
      whileTap={hover ? { scale: 0.98 } : undefined}
    >
      {children}
    </motion.div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, subValue, icon }: StatCardProps) {
  return (
    <Card className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{label}</span>
        {icon && <div className="text-accent-500">{icon}</div>}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subValue && <div className="text-sm text-gray-500 mt-1">{subValue}</div>}
    </Card>
  );
}
