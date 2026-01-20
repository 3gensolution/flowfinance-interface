'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Shield, Zap, TrendingUp } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-8">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full mb-8"
          >
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-300">Live on Base Network</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6"
          >
            <span className="text-white">Decentralized</span>
            <br />
            <span className="gradient-text">Crypto Lending</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10"
          >
            Borrow against your crypto assets or earn yield by providing liquidity.
            No intermediaries, no credit checks, just smart contracts.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link href="/borrow">
              <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                Start Borrowing
              </Button>
            </Link>
            <Link href="/lend">
              <Button variant="secondary" size="lg">
                Become a Lender
              </Button>
            </Link>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-full">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">Secure & Audited</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-full">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-300">Instant Liquidity</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-full">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              <span className="text-sm text-gray-300">Competitive Rates</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center pt-2"
        >
          <motion.div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
