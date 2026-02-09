'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileX } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

// Skeleton card component for loading state
function SkeletonCard() {
  return (
    <div className="glass-card p-6 rounded-2xl animate-pulse">
      {/* Header with badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="h-4 w-16 bg-white/10 rounded" />
        </div>
        <div className="h-5 w-20 bg-white/10 rounded-full" />
      </div>

      {/* Amount */}
      <div className="mb-4">
        <div className="h-3 w-20 bg-white/10 rounded mb-2" />
        <div className="h-6 w-32 bg-white/10 rounded" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="h-3 w-16 bg-white/10 rounded mb-2" />
          <div className="h-5 w-20 bg-white/10 rounded" />
        </div>
        <div>
          <div className="h-3 w-16 bg-white/10 rounded mb-2" />
          <div className="h-5 w-20 bg-white/10 rounded" />
        </div>
      </div>

      {/* Collateral */}
      <div className="p-3 bg-white/5 rounded-lg mb-4">
        <div className="h-3 w-24 bg-white/10 rounded mb-2" />
        <div className="h-5 w-28 bg-white/10 rounded" />
      </div>

      {/* Button */}
      <div className="h-10 w-full bg-white/10 rounded-xl" />
    </div>
  );
}

interface ListingsGridProps {
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: {
    label: string;
    href: string;
  };
}

export function ListingsGrid({
  children,
  isLoading,
  isEmpty,
  emptyTitle = 'No listings found',
  emptyDescription = 'Try adjusting your filters or check back later.',
  emptyAction,
}: ListingsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        lottieUrl="/empty.json"
        lottieWidth={200}
        lottieHeight={200}
        icon={<FileX className="w-8 h-8 text-gray-500" />}
        action={emptyAction ? {
          label: emptyAction.label,
          href: emptyAction.href,
          variant: 'primary',
        } : undefined}
        size="lg"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center gap-2 mt-8"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      <div className="flex items-center gap-1">
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="w-10 h-10 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors"
            >
              1
            </button>
            {startPage > 2 && <span className="text-gray-500 px-2">...</span>}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-10 h-10 rounded-lg text-sm transition-colors ${
              page === currentPage
                ? 'bg-primary-500 text-white'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-gray-500 px-2">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="w-10 h-10 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </motion.div>
  );
}
