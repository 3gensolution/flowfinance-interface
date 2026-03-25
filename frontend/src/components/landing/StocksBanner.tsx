'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { TrendingUp, BarChart3, ArrowRight } from 'lucide-react';

export function StocksBanner() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <section id="stocks" ref={sectionRef} className="py-16 bg-black relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 md:px-10 lg:px-20 relative z-10">
        <motion.div
          className="relative rounded-3xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        >
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

          <div className="relative z-10 p-8 sm:p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            {/* Left: Icon cluster */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-indigo-500/30 border border-indigo-500/40 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-300" />
                </div>
              </div>
            </div>

            {/* Center: Text */}
            <div className="flex-1 text-center lg:text-left">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
                Borrow against your{' '}
                <span className="text-purple-400">Stocks</span>
              </h3>
              <p className="text-gray-400 text-base sm:text-lg max-w-xl">
                Use your stock portfolio as collateral to access instant loans.
                Tesla, Apple, Google — your equities, your liquidity.
              </p>
            </div>

            {/* Right: Button with tooltip */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold text-sm sm:text-base hover:bg-purple-500/30 hover:border-purple-500/50 transition-all duration-300 group"
              >
                Learn More
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <AnimatePresence>
                {showTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium whitespace-nowrap shadow-lg shadow-purple-500/30"
                  >
                    Coming Soon
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-purple-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
