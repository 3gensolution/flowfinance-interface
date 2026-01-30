'use client';

import { Address } from 'viem';
import { useTokenPrice, useRefreshMockPrice } from '@/hooks/useContracts';
import { getTokenByAddress } from '@/config/contracts';
import { RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface PriceFeedDisplayProps {
  tokenAddress: Address;
  variant?: 'compact' | 'full' | 'inline';
  showRefresh?: boolean;
  className?: string;
}

export function PriceFeedDisplay({
  tokenAddress,
  variant = 'compact',
  showRefresh = true,
  className = '',
}: PriceFeedDisplayProps) {
  const {
    price,
    isStale,
    secondsUntilStale,
    priceFeedAddress,
    refetch,
    isLoading,
  } = useTokenPrice(tokenAddress);

  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();
  const tokenInfo = getTokenByAddress(tokenAddress);

  const handleRefresh = async () => {
    if (!priceFeedAddress || !price) {
      toast.error('Price feed not available');
      return;
    }

    try {
      await refreshPrice(priceFeedAddress as Address, price, tokenAddress);
      toast.success(`${tokenInfo?.symbol || 'Token'} price refreshed!`);
      refetch();
    } catch (error) {
      console.error('Error refreshing price:', error);
      toast.error('Failed to refresh price. You may not have permission.');
    }
  };

  const priceDisplay = price ? `$${(Number(price) / 1e8).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--';
  const freshMinutes = secondsUntilStale ? Math.floor(secondsUntilStale / 60) : 0;
  const freshSeconds = secondsUntilStale ? secondsUntilStale % 60 : 0;

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="text-sm text-gray-300">{priceDisplay}</span>
        {isStale && (
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
        )}
        {showRefresh && isStale && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshingPrice}
            className="text-primary-400 hover:text-primary-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
          </button>
        )}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg ${className}`}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">{tokenInfo?.symbol || 'Token'}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-sm text-gray-500">Loading...</span>
          ) : (
            <>
              <span className="text-sm font-medium text-gray-200">{priceDisplay}</span>
              {isStale ? (
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  {showRefresh && (
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshingPrice}
                      className="text-primary-400 hover:text-primary-300 p-0.5"
                      title="Refresh price feed"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              ) : secondsUntilStale !== undefined && secondsUntilStale < 300 ? (
                <span className="text-xs text-yellow-400">
                  {freshMinutes}:{freshSeconds.toString().padStart(2, '0')}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-green-400" title="Price is fresh" />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`p-4 bg-white/5 border border-gray-700 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-400" />
          <span className="font-medium text-gray-200">{tokenInfo?.symbol || 'Token'} Price</span>
        </div>
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshingPrice || !isStale}
            className={`p-1.5 rounded-lg transition-colors ${
              isStale
                ? 'text-primary-400 hover:text-primary-300 hover:bg-white/5'
                : 'text-gray-600 cursor-not-allowed'
            }`}
            title={isStale ? 'Refresh price feed' : 'Price is fresh'}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-100">{priceDisplay}</span>
        {isStale ? (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Stale</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs">Fresh</span>
          </div>
        )}
      </div>

      {isStale && (
        <p className="text-xs text-gray-500 mt-2">
          Price data is older than 15 minutes. Refresh to update.
        </p>
      )}
      {!isStale && secondsUntilStale !== undefined && secondsUntilStale < 300 && (
        <p className="text-xs text-yellow-400 mt-2">
          Expires in {freshMinutes}:{freshSeconds.toString().padStart(2, '0')}
        </p>
      )}
    </div>
  );
}
