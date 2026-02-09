'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { AssetType } from './AssetTypeSelector';
import { useCryptoAssets, useFiatAssets, CryptoAsset, FiatAsset } from '@/hooks/useSupplyAssets';

export interface Asset {
  symbol: string;
  name: string;
  balance: string;
  address?: string;
  decimals?: number;
  hasBalance?: boolean;
}

// Number of assets to show before "See more" - use 3 for testing, 8 for production
const INITIAL_VISIBLE_COUNT = 8;

interface AssetSelectorProps {
  assetType: AssetType;
  selected: Asset | null;
  onSelect: (asset: Asset) => void;
}

export function AssetSelector({ assetType, selected, onSelect }: AssetSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  // Fetch assets based on type
  const { assets: cryptoAssets, isLoading: isCryptoLoading } = useCryptoAssets();
  const { assets: fiatAssets, isLoading: isFiatLoading } = useFiatAssets();

  if (!assetType) return null;

  const isCrypto = assetType === 'crypto';
  const isLoading = isCrypto ? isCryptoLoading : isFiatLoading;

  // Transform assets to common format
  const allAssets: Asset[] = isCrypto
    ? cryptoAssets.map((a: CryptoAsset) => ({
        symbol: a.symbol,
        name: a.name,
        balance: a.balance,
        address: a.address,
        decimals: a.decimals,
        hasBalance: a.hasBalance,
      }))
    : fiatAssets.map((a: FiatAsset) => ({
        symbol: a.code,
        name: a.name,
        balance: `${a.symbol}${a.balance}`,
        hasBalance: a.hasBalance,
      }));

  // Determine visible assets based on showAll state
  const needsCollapsible = allAssets.length > INITIAL_VISIBLE_COUNT;
  const visibleAssets = showAll ? allAssets : allAssets.slice(0, INITIAL_VISIBLE_COUNT);
  const hiddenCount = allAssets.length - INITIAL_VISIBLE_COUNT;

  const handleSelect = (asset: Asset) => {
    // Only allow selection if asset has balance
    if (!asset.hasBalance) return;
    onSelect(asset);
  };

  return (
    <motion.div
      key={assetType}
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
      className="w-full"
    >
      {/* Section Label */}
      <h2 className="text-xl font-semibold text-white mb-6 text-center">
        {isCrypto ? 'Select a token' : 'Select a currency'}
      </h2>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          {/* Asset Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {visibleAssets.map((asset, index) => {
                const isSelected = selected?.symbol === asset.symbol;
                const isDisabled = !asset.hasBalance;

                return (
                  <motion.button
                    key={asset.symbol}
                    onClick={() => handleSelect(asset)}
                    disabled={isDisabled}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.03 }}
                    className={`
                      relative p-4 rounded-xl text-center transition-all duration-300
                      border-2 group
                      ${isDisabled
                        ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/[0.02]'
                        : isSelected
                          ? isCrypto
                            ? 'border-orange-500 bg-orange-500/10 shadow-md shadow-orange-500/20 cursor-pointer'
                            : 'border-primary-500 bg-primary-500/10 shadow-md shadow-primary-500/20 cursor-pointer'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 cursor-pointer'
                      }
                    `}
                    whileHover={isDisabled ? {} : { y: -2 }}
                    whileTap={isDisabled ? {} : { scale: 0.95 }}
                  >
                    {/* Asset Logo Placeholder */}
                    <div className="w-10 h-10 mx-auto mb-2 relative">
                      <div
                        className={`
                          w-full h-full rounded-full flex items-center justify-center
                          text-sm font-bold transition-colors duration-300
                          ${isDisabled
                            ? 'bg-white/5 text-white/30'
                            : isSelected
                              ? isCrypto
                                ? 'bg-orange-500 text-white'
                                : 'bg-blue-500 text-white'
                              : 'bg-white/10 text-white/60 group-hover:bg-white/20'
                          }
                        `}
                      >
                        {asset.symbol.slice(0, 2)}
                      </div>
                    </div>

                    {/* Asset Symbol */}
                    <p
                      className={`
                        font-semibold text-sm transition-colors duration-300
                        ${isDisabled
                          ? 'text-white/30'
                          : isSelected
                            ? isCrypto
                              ? 'text-orange-400'
                              : 'text-primary-400'
                            : 'text-white'
                        }
                      `}
                    >
                      {asset.symbol}
                    </p>

                    {/* Balance */}
                    <p className={`text-xs mt-1 truncate ${isDisabled ? 'text-white/20' : 'text-white/40'}`}>
                      {asset.balance}
                    </p>

                    {/* Selected Check */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`
                          absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full
                          flex items-center justify-center
                          ${isCrypto ? 'bg-orange-500' : 'bg-blue-500'}
                        `}
                      >
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* See More / See Less Button */}
          {needsCollapsible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-center"
            >
              <button
                onClick={() => setShowAll(!showAll)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg
                  text-sm font-medium transition-all duration-200
                  ${isCrypto
                    ? 'text-orange-400 hover:bg-orange-500/10'
                    : 'text-primary-400 hover:bg-primary-500/10'
                  }
                `}
              >
                {showAll ? (
                  <>
                    <span>Show less</span>
                    <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>See {hiddenCount} more</span>
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}
