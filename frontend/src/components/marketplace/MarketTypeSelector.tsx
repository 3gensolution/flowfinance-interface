'use client';

import { motion } from 'framer-motion';
import { Coins, Banknote } from 'lucide-react';

export type MarketType = 'crypto' | 'fiat';

interface MarketTypeSelectorProps {
  marketType: MarketType;
  onMarketTypeChange: (type: MarketType) => void;
}

export function MarketTypeSelector({ marketType, onMarketTypeChange }: MarketTypeSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="flex justify-center gap-2 mb-6"
    >
      <button
        onClick={() => onMarketTypeChange('crypto')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
          marketType === 'crypto'
            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
            : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-600'
        }`}
      >
        <Coins className="w-4 h-4" />
        Crypto
      </button>
      <button
        onClick={() => onMarketTypeChange('fiat')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
          marketType === 'fiat'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-600'
        }`}
      >
        <Banknote className="w-4 h-4" />
        Fiat
      </button>
    </motion.div>
  );
}
