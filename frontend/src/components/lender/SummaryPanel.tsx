'use client';

import { motion } from 'framer-motion';
import { Info, CheckCircle } from 'lucide-react';
import { Asset } from './AssetSelector';
import { AssetType } from './AssetTypeSelector';

interface SummaryPanelProps {
  assetType: AssetType;
  asset: Asset | null;
  amount: string;
  rate: number;
}

export function SummaryPanel({ assetType, asset, amount, rate }: SummaryPanelProps) {
  const hasData = asset && amount && parseFloat(amount) > 0;
  const isCrypto = assetType === 'crypto';

  if (!hasData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      className="w-full max-w-xl mx-auto"
    >
      {/* Section Label */}
      <h2 className="text-xl font-semibold text-white mb-6 text-center">
        Review your supply
      </h2>

      {/* Summary Card */}
      <div
        className={`
          p-6 rounded-2xl border-2 bg-white/5
          ${isCrypto ? 'border-orange-500/30' : 'border-primary-500/30'}
        `}
      >
        {/* Summary Items */}
        <div className="space-y-4">
          {/* You're Supplying */}
          <div className="flex items-center justify-between py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-white/60">You&apos;re supplying</span>
            </div>
            <motion.span
              key={`${amount}-${asset.symbol}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`
                text-lg font-bold
                ${isCrypto ? 'text-orange-400' : 'text-primary-400'}
              `}
            >
              {parseFloat(amount).toLocaleString()} {asset.symbol}
            </motion.span>
          </div>

          {/* Your Interest Rate */}
          <div className="flex items-center justify-between py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-white/60">Your interest rate</span>
            </div>
            <motion.span
              key={rate}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-lg font-bold text-orange-400"
            >
              {rate}%
            </motion.span>
          </div>

          {/* Available to Borrowers */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-white/60">Available to borrowers</span>
            </div>
            <motion.span
              key={`available-${amount}-${asset.symbol}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-lg font-bold text-white"
            >
              {parseFloat(amount).toLocaleString()} {asset.symbol}
            </motion.span>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex gap-3">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary-400" />
            <div className="space-y-2 text-sm">
              <p className="text-white/70">
                Borrowers can take any amount from your supply.
              </p>
              <p className="font-medium text-orange-400">
                You earn {rate}% on whatever they borrow.
              </p>
            </div>
          </div>
        </div>

        {/* No Projections Notice */}
        <p className="text-xs text-white/30 text-center mt-4">
          No earnings projections. Interest is earned on borrowed amounts only.
        </p>
      </div>
    </motion.div>
  );
}
