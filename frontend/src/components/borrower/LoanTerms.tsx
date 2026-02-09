'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { BorrowAsset } from './BorrowAssetSelector';

interface LoanTermsProps {
  borrowAsset: BorrowAsset | null;
  interestRate: number;
  duration: number;
  customDate: Date | null;
  onInterestRateChange: (rate: number) => void;
  onDurationChange: (days: number) => void;
  onCustomDateChange: (date: Date | null) => void;
}

const DURATION_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

export function LoanTerms({
  borrowAsset,
  interestRate,
  duration,
  customDate,
  onInterestRateChange,
  onDurationChange,
  onCustomDateChange,
}: LoanTermsProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isCustomDuration = !DURATION_OPTIONS.some(opt => opt.days === duration);

  const interestPercentage = ((interestRate - 5) / (15 - 5)) * 100;

  // Handle custom date selection
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    onCustomDateChange(date);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    onDurationChange(diffDays);
    setShowDatePicker(false);
  };

  // Get min and max dates for picker
  const getMinDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().split('T')[0];
  };

  if (!borrowAsset) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl mx-auto"
    >
      <div className="space-y-8 p-6 rounded-2xl bg-white/5 border border-white/10">
        {/* Interest Rate Slider */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-white/70">Interest Rate</label>
            <span className="text-lg font-bold text-white">{interestRate}%</span>
          </div>

          <div className="relative pt-2 pb-4">
            <input
              type="range"
              min={5}
              max={15}
              step={0.5}
              value={interestRate}
              onChange={(e) => onInterestRateChange(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-orange-500
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow-lg
                [&::-webkit-slider-thumb]:shadow-orange-500/30
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-orange-500
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${interestPercentage}%, rgba(255,255,255,0.1) ${interestPercentage}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-white/40">5%</span>
              <span className="text-xs text-white/40">15%</span>
            </div>
          </div>

          <p className="text-xs text-white/40 text-center">
            Higher interest helps lenders match faster
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Duration Selector */}
        <div>
          <label className="text-sm font-medium text-white/70 block mb-3">Loan Duration</label>

          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map((option) => (
              <motion.button
                key={option.days}
                onClick={() => {
                  onDurationChange(option.days);
                  onCustomDateChange(null);
                }}
                className={`
                  py-3 px-2 rounded-xl text-sm font-medium transition-all duration-200
                  ${duration === option.days && !isCustomDuration
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }
                `}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
              >
                {option.label}
              </motion.button>
            ))}

            {/* Custom Button */}
            <motion.button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`
                py-3 px-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1
                ${isCustomDuration
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }
              `}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Calendar className="w-3.5 h-3.5" />
              {isCustomDuration && customDate
                ? customDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Custom'
              }
            </motion.button>
          </div>

          {/* Date Picker */}
          <AnimatePresence>
            {showDatePicker && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-purple-500/10 border border-white/10"
              >
                <label className="text-sm text-white/60 block mb-2">Select repayment date</label>
                <input
                  type="date"
                  min={getMinDate()}
                  max={getMaxDate()}
                  onChange={handleDateSelect}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/20 text-white
                    focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20
                    hover:border-white/30 transition-all cursor-pointer
                    [&::-webkit-calendar-picker-indicator]:filter
                    [&::-webkit-calendar-picker-indicator]:invert
                    [&::-webkit-calendar-picker-indicator]:opacity-60
                    [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <p className="text-xs text-white/40 mt-2">
                  Choose a date between 7 and 90 days from today
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
