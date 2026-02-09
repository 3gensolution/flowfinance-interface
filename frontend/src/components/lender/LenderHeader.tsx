'use client';

import { motion } from 'framer-motion';

interface LenderHeaderProps {
  currentStep: number;
  totalSteps: number;
}

export function LenderHeader({ currentStep, totalSteps }: LenderHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      {/* Step Counter */}
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
        <span className="text-orange-400 font-semibold">Step {currentStep}</span>
        <span className="text-white/40">of {totalSteps}</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
        Earn by lending{' '}
        <span className="text-orange-400">crypto</span> or{' '}
        <span className="text-primary-400">cash</span>
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-white/60 max-w-2xl mx-auto">
        Supply funds and set your own interest rate.
      </p>
    </motion.div>
  );
}
