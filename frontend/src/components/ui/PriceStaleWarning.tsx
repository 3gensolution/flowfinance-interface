'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Address } from 'viem';
import { useRefreshMockPrice } from '@/hooks/useContracts';
import toast from 'react-hot-toast';

interface PriceFeedInfo {
  isStale: boolean;
  priceFeedAddress?: unknown;
  price?: bigint;
  tokenAddress?: Address;
  refetch: () => void;
}

interface PriceStaleWarningProps {
  priceFeeds: PriceFeedInfo[];
  className?: string;
}

export function PriceStaleWarning({ priceFeeds, className = '' }: PriceStaleWarningProps) {
  const { refreshPrice, isPending } = useRefreshMockPrice();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if any price feed is stale
  const hasStaleData = priceFeeds.some(feed => feed.isStale);

  if (!hasStaleData) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh all stale price feeds
      for (const feed of priceFeeds) {
        if (feed.isStale && feed.priceFeedAddress && feed.price && feed.tokenAddress) {
          await refreshPrice(
            feed.priceFeedAddress as Address,
            BigInt(feed.price.toString()),
            feed.tokenAddress
          );
        }
      }

      // Refetch all price data
      for (const feed of priceFeeds) {
        feed.refetch();
      }

      toast.success('Price data refreshed!');
    } catch (error) {
      console.error('Failed to refresh prices:', error);
      toast.error('Failed to refresh price data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading = isPending || isRefreshing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-yellow-400">Price Data Outdated</h4>
          <p className="text-sm text-white/70 mt-1">
            The price information needs to be updated before you can proceed.
            Please refresh to get the latest prices.
          </p>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh Prices'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
