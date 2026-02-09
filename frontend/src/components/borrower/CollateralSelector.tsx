'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Address } from 'viem';

export interface CollateralAsset {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  balance: string;
  rawBalance?: bigint;
  hasBalance: boolean;
  icon?: string;
}

interface CollateralSelectorProps {
  selected: CollateralAsset | null;
  onSelect: (asset: CollateralAsset) => void;
  assets: CollateralAsset[];
  isLoading?: boolean;
}

export function CollateralSelector({
  selected,
  onSelect,
  assets,
  isLoading = false,
}: CollateralSelectorProps) {
  const handleSelect = (asset: CollateralAsset) => {
    if (!asset.hasBalance) return;
    onSelect(asset);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <h2 className="text-xl font-semibold text-white mb-2 text-center">
        Choose collateral
      </h2>
      <p className="text-sm text-white/50 mb-6 text-center">
        Select the asset you want to use as security
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/50">No supported assets found.</p>
          <p className="text-sm text-white/30 mt-2">Please check your wallet connection or get test tokens from the faucet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-3xl mx-auto">
          {assets.map((asset, index) => {
            const isSelected = selected?.symbol === asset.symbol;
            const isDisabled = !asset.hasBalance;

            return (
              <motion.button
                key={asset.symbol}
                onClick={() => handleSelect(asset)}
                disabled={isDisabled}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  relative p-4 rounded-xl text-center transition-all duration-300
                  border-2 group
                  ${isDisabled
                    ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/[0.02]'
                    : isSelected
                      ? 'border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 cursor-pointer'
                  }
                `}
                whileHover={isDisabled ? {} : { y: -2 }}
                whileTap={isDisabled ? {} : { scale: 0.95 }}
              >
                {/* Token Logo */}
                <div className="w-12 h-12 mx-auto mb-2 relative">
                  <div
                    className={`
                      w-full h-full rounded-full flex items-center justify-center
                      text-sm font-bold transition-colors duration-300
                      ${isDisabled
                        ? 'bg-white/5 text-white/30'
                        : isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-white/60 group-hover:bg-white/20'
                      }
                    `}
                  >
                    {asset.symbol.slice(0, 2)}
                  </div>
                </div>

                {/* Token Name */}
                <p
                  className={`
                    font-semibold text-sm transition-colors duration-300
                    ${isDisabled ? 'text-white/30' : isSelected ? 'text-blue-400' : 'text-white'}
                  `}
                >
                  {asset.symbol}
                </p>

                {/* Balance */}
                <p className={`text-xs mt-1 ${isDisabled ? 'text-white/20' : 'text-white/40'}`}>
                  {asset.balance} available
                </p>

                {/* Selected Check */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
