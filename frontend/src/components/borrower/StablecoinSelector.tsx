'use client';

import { motion } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import { Address } from 'viem';

export interface StablecoinAsset {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  icon?: string;
}

interface StablecoinSelectorProps {
  selected: StablecoinAsset | null;
  onSelect: (asset: StablecoinAsset) => void;
  assets: StablecoinAsset[];
  isLoading?: boolean;
}

export function StablecoinSelector({
  selected,
  onSelect,
  assets,
  isLoading = false,
}: StablecoinSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <h2 className="text-xl font-semibold text-white mb-2 text-center">
        What do you want to borrow?
      </h2>
      <p className="text-sm text-white/50 mb-6 text-center">
        Select the stablecoin you&apos;d like to receive
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-white/50">No stablecoins available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {assets.map((asset, index) => {
            const isSelected = selected?.symbol === asset.symbol;

            return (
              <motion.button
                key={asset.symbol}
                onClick={() => onSelect(asset)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  relative p-5 rounded-xl text-center transition-all duration-300
                  border-2 group
                  ${isSelected
                    ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/20'
                    : 'border-white/10 bg-white/5 hover:border-primary-500/50 hover:bg-white/10 cursor-pointer'
                  }
                `}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                )}

                {/* Icon */}
                <div
                  className={`
                    w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center
                    ${isSelected ? 'bg-primary-500/20' : 'bg-white/10'}
                  `}
                >
                  <span className={`text-lg font-bold ${isSelected ? 'text-primary-400' : 'text-white'}`}>
                    {asset.symbol.slice(0, 2)}
                  </span>
                </div>

                {/* Symbol */}
                <p
                  className={`
                    font-semibold text-lg
                    ${isSelected ? 'text-primary-400' : 'text-white'}
                  `}
                >
                  {asset.symbol}
                </p>

                {/* Name */}
                <p className="text-xs text-white/50 mt-1">{asset.name}</p>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
