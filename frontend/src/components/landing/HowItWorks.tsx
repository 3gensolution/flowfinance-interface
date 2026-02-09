'use client';

import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Wallet, TrendingUp, Banknote } from 'lucide-react';

const steps = [
  {
    icon: Wallet,
    step: 1,
    title: 'Deposit Crypto or Cash',
    description: 'Fund your wallet with crypto or local currency in minutes.',
    hasSlider: false,
  },
  {
    icon: TrendingUp,
    step: 2,
    title: 'Earn or Lend',
    description: 'Earn interest automatically or lend funds to others using your own rate.',
    hasSlider: true,
  },
  {
    icon: Banknote,
    step: 3,
    title: 'Withdraw Anytime',
    description: 'Move your earnings straight to your bank whenever you need it.',
    hasSlider: false,
  },
];

function RateSlider() {
  const [rate] = useState(12);

  return (
    <div className="mt-6 pt-4 border-t border-white/10">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">Interest Rate</span>
        <span className="text-sm font-semibold text-orange-400">{rate}%</span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full">
        <div
          className="absolute h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
          style={{ width: `${((rate - 5) / 15) * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-orange-500"
          style={{ left: `calc(${((rate - 5) / 15) * 100}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-500">5%</span>
        <span className="text-xs text-gray-500">20%</span>
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
}: {
  step: (typeof steps)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 min-h-[280px] flex flex-col transition-all duration-300 hover:bg-white/10 hover:border-white/20"
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: [0.33, 1, 0.68, 1] }}
    >
      {/* Step number badge */}
      <div className="absolute -top-3 -left-3 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/30 z-10">
        {step.step}
      </div>

      {/* Card content wrapper */}
      <div className="flex flex-col h-full">
        {/* Icon */}
        <div className="w-14 h-14 bg-primary-500/20 rounded-xl flex items-center justify-center mb-5">
          <step.icon className="w-7 h-7 text-primary-400" />
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
        <p className="text-gray-400 leading-relaxed flex-grow">{step.description}</p>

        {/* Rate slider for step 2 */}
        {step.hasSlider && <RateSlider />}
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-24 bg-black relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            How It <span className="text-primary-400">Works</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Three simple steps to start earning
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              <StepCard step={step} index={index} />

              {/* Connector line (visible only on desktop between cards) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-[2px]">
                  <motion.div
                    className="h-full bg-gradient-to-r from-white/20 to-white/5"
                    initial={{ scaleX: 0 }}
                    animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3 + index * 0.15,
                      ease: [0.33, 1, 0.68, 1],
                    }}
                    style={{ transformOrigin: 'left' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile connector arrows */}
        <div className="lg:hidden mt-8 flex justify-center">
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-sm">Deposit</span>
            <span className="text-orange-400">→</span>
            <span className="text-sm">Earn</span>
            <span className="text-orange-400">→</span>
            <span className="text-sm">Withdraw</span>
          </div>
        </div>
      </div>
    </section>
  );
}
