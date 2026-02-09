'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Asset } from './AssetSelector';

interface InterestSliderProps {
  asset: Asset | null;
  rate: number;
  onRateChange: (rate: number) => void;
  minRate?: number;
  maxRate?: number;
  isLoading?: boolean;
}

export function InterestSlider({
  asset,
  rate,
  onRateChange,
  minRate = 5,
  maxRate = 15,
  isLoading = false,
}: InterestSliderProps) {
  if (!asset) return null;

  // Show loading state while fetching config
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        className="w-full max-w-xl mx-auto"
      >
        <h2 className="text-xl font-semibold text-white mb-6 text-center">
          Set your interest rate
        </h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onRateChange(Number(e.target.value));
  };

  const fillPercentage = ((rate - minRate) / (maxRate - minRate)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
      className="w-full max-w-xl mx-auto"
    >
      {/* Section Label */}
      <h2 className="text-xl font-semibold text-white mb-6 text-center">
        Set your interest rate
      </h2>

      {/* Slider Card */}
      <div className="p-6 rounded-2xl border-2 border-white/10 bg-white/5">
        {/* Rate Display */}
        <div className="flex items-center justify-center mb-8">
          <motion.div
            key={rate}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <span className="text-6xl sm:text-7xl font-bold text-orange-400">
              {rate}
            </span>
            <span className="text-4xl sm:text-5xl font-bold text-orange-400">
              %
            </span>
          </motion.div>
        </div>

        {/* Slider Container */}
        <div className="relative px-2">
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary-500 to-orange-500 rounded-full"
              style={{ width: `${fillPercentage}%` }}
              initial={false}
              animate={{ width: `${fillPercentage}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>

          <input
            type="range"
            min={minRate}
            max={maxRate}
            step={0.5}
            value={rate}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
            style={{ top: '0' }}
          />

          <motion.div
            className="
              absolute top-1/2 -translate-y-1/2 w-7 h-7
              bg-white border-4 border-orange-500 rounded-full
              shadow-lg shadow-orange-500/40
              pointer-events-none
            "
            style={{ left: `calc(${fillPercentage}% - 14px)` }}
            initial={false}
            animate={{ left: `calc(${fillPercentage}% - 14px)` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Min/Max Labels */}
        <div className="flex justify-between mt-4 px-2">
          <span className="text-sm text-white/40">Min {minRate}%</span>
          <span className="text-sm text-white/40">Max {maxRate}%</span>
        </div>

        {/* Helper Text */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-sm text-white/50 text-center">
            This rate applies to every borrower who uses your funds.
          </p>
          <p className="text-xs text-white/30 text-center mt-2">
            You earn interest only on the amount borrowed.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
