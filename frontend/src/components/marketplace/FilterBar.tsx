'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPPORTED_TOKENS } from '@/config/contracts';
import { SUPPORTED_FIAT_CURRENCIES } from '@/hooks/useFiatOracle';

export interface FilterState {
  assetType: 'all' | 'crypto' | 'fiat';
  tokens: string[];
  amountRange: { min: number; max: number };
  interestRange: { min: number; max: number };
  duration: string[];
  sortBy: 'newest' | 'lowest_interest' | 'highest_interest' | 'amount_high' | 'amount_low';
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  resultCount: number;
}

// Get crypto token symbols from config (cast to string[] to avoid readonly type issues)
const CRYPTO_TOKENS: string[] = Object.values(SUPPORTED_TOKENS).map(t => t.symbol);
// Get fiat currency codes from config
const FIAT_CURRENCIES: string[] = SUPPORTED_FIAT_CURRENCIES.map(c => c.code);
const DURATIONS = ['7 days', '14 days', '30 days', '60 days', '90 days'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'lowest_interest', label: 'Lowest Interest' },
  { value: 'highest_interest', label: 'Highest Interest' },
  { value: 'amount_high', label: 'Amount (High to Low)' },
  { value: 'amount_low', label: 'Amount (Low to High)' },
];

export function FilterBar({ filters, onFilterChange, resultCount }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Get available tokens based on asset type
  const availableTokens = useMemo(() => {
    switch (filters.assetType) {
      case 'crypto':
        return CRYPTO_TOKENS;
      case 'fiat':
        return FIAT_CURRENCIES;
      default:
        return [...CRYPTO_TOKENS, ...FIAT_CURRENCIES];
    }
  }, [filters.assetType]);

  // Clear token selection when asset type changes
  useEffect(() => {
    if (filters.tokens.length > 0) {
      // Keep only tokens that are still available
      const validTokens = filters.tokens.filter(t => availableTokens.includes(t));
      if (validTokens.length !== filters.tokens.length) {
        onFilterChange({ ...filters, tokens: validTokens });
      }
    }
  }, [filters.assetType, availableTokens, filters.tokens, onFilterChange, filters]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const toggleToken = (token: string) => {
    const newTokens = filters.tokens.includes(token)
      ? filters.tokens.filter(t => t !== token)
      : [...filters.tokens, token];
    updateFilter('tokens', newTokens);
  };

  const toggleDuration = (duration: string) => {
    const newDurations = filters.duration.includes(duration)
      ? filters.duration.filter(d => d !== duration)
      : [...filters.duration, duration];
    updateFilter('duration', newDurations);
  };

  const clearFilters = () => {
    onFilterChange({
      assetType: 'all',
      tokens: [],
      amountRange: { min: 0, max: 1000000 },
      interestRange: { min: 0, max: 100 },
      duration: [],
      sortBy: 'newest',
    });
  };

  const hasActiveFilters =
    filters.assetType !== 'all' ||
    filters.tokens.length > 0 ||
    filters.duration.length > 0 ||
    filters.sortBy !== 'newest';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-20 z-30 mb-6"
    >
      <div className="glass-card p-4">
        {/* Main Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mobile Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="md:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-orange-500" />
            )}
          </button>

          {/* Desktop Filters */}
          <div className={cn(
            'flex-1 flex flex-wrap items-center gap-3',
            'max-md:hidden',
            isExpanded && 'max-md:flex'
          )}>
            {/* Asset Type Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'assetType' ? null : 'assetType')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-400">Type:</span>
                <span className="capitalize">{filters.assetType}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-gray-400 transition-transform',
                  openDropdown === 'assetType' && 'rotate-180'
                )} />
              </button>
              <AnimatePresence>
                {openDropdown === 'assetType' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-40 py-2 rounded-lg bg-navy-800 border border-white/10 shadow-lg z-50"
                  >
                    {['all', 'crypto', 'fiat'].map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          updateFilter('assetType', type as FilterState['assetType']);
                          setOpenDropdown(null);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm capitalize hover:bg-white/5',
                          filters.assetType === type && 'text-primary-400 bg-white/5'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Token Multi-select */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'tokens' ? null : 'tokens')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-400">
                  {filters.assetType === 'fiat' ? 'Currency:' : 'Token:'}
                </span>
                <span>
                  {filters.tokens.length === 0
                    ? 'All'
                    : filters.tokens.length > 2
                    ? `${filters.tokens.length} selected`
                    : filters.tokens.join(', ')}
                </span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-gray-400 transition-transform',
                  openDropdown === 'tokens' && 'rotate-180'
                )} />
              </button>
              <AnimatePresence>
                {openDropdown === 'tokens' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-48 rounded-lg bg-navy-800 border border-white/10 shadow-lg z-50 max-h-64 overflow-hidden"
                  >
                    <div
                      className="max-h-64 overflow-y-auto py-2"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}
                    >
                      {availableTokens.map((token) => (
                        <button
                          key={token}
                          onClick={() => toggleToken(token)}
                          className={cn(
                            'w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-white/5',
                            filters.tokens.includes(token) && 'text-primary-400'
                          )}
                        >
                          {token}
                          {filters.tokens.includes(token) && (
                            <span className="w-2 h-2 rounded-full bg-primary-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Interest Range */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
              <span className="text-gray-400">Interest:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.interestRange.min}
                onChange={(e) =>
                  updateFilter('interestRange', {
                    ...filters.interestRange,
                    min: Number(e.target.value),
                  })
                }
                className="w-12 bg-transparent border-none text-center focus:outline-none"
                placeholder="0"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.interestRange.max}
                onChange={(e) =>
                  updateFilter('interestRange', {
                    ...filters.interestRange,
                    max: Number(e.target.value),
                  })
                }
                className="w-12 bg-transparent border-none text-center focus:outline-none"
                placeholder="100"
              />
              <span className="text-gray-500">%</span>
            </div>

            {/* Duration Pills */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Duration:</span>
              <div className="flex flex-wrap gap-1">
                {DURATIONS.map((duration) => (
                  <button
                    key={duration}
                    onClick={() => toggleDuration(duration)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs transition-colors',
                      filters.duration.includes(duration)
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    )}
                  >
                    {duration}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="relative ml-auto">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-400">Sort:</span>
                <span>{SORT_OPTIONS.find(o => o.value === filters.sortBy)?.label}</span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-gray-400 transition-transform',
                  openDropdown === 'sort' && 'rotate-180'
                )} />
              </button>
              <AnimatePresence>
                {openDropdown === 'sort' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-48 py-2 rounded-lg bg-navy-800 border border-white/10 shadow-lg z-50"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          updateFilter('sortBy', option.value as FilterState['sortBy']);
                          setOpenDropdown(null);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm hover:bg-white/5',
                          filters.sortBy === option.value && 'text-primary-400 bg-white/5'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Result Count & Clear */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-gray-400">
              <span className="font-medium text-white">{resultCount}</span> results
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Mobile Expanded Filters */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 pt-4 border-t border-white/10 space-y-4"
            >
              {/* Asset Type */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Asset Type</label>
                <div className="flex gap-2">
                  {['all', 'crypto', 'fiat'].map((type) => (
                    <button
                      key={type}
                      onClick={() => updateFilter('assetType', type as FilterState['assetType'])}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm capitalize transition-colors',
                        filters.assetType === type
                          ? 'bg-primary-500 text-white'
                          : 'bg-white/5 text-gray-400'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tokens */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  {filters.assetType === 'fiat' ? 'Currencies' : filters.assetType === 'crypto' ? 'Tokens' : 'Tokens / Currencies'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTokens.map((token) => (
                    <button
                      key={token}
                      onClick={() => toggleToken(token)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm transition-colors',
                        filters.tokens.includes(token)
                          ? 'bg-primary-500 text-white'
                          : 'bg-white/5 text-gray-400'
                      )}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((duration) => (
                    <button
                      key={duration}
                      onClick={() => toggleDuration(duration)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm transition-colors',
                        filters.duration.includes(duration)
                          ? 'bg-primary-500 text-white'
                          : 'bg-white/5 text-gray-400'
                      )}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interest Range */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Interest Range</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.interestRange.min}
                    onChange={(e) =>
                      updateFilter('interestRange', {
                        ...filters.interestRange,
                        min: Number(e.target.value),
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-sm text-white w-16 text-center">
                    {filters.interestRange.min}% - {filters.interestRange.max}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.interestRange.max}
                    onChange={(e) =>
                      updateFilter('interestRange', {
                        ...filters.interestRange,
                        max: Number(e.target.value),
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value as FilterState['sortBy'])}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
