'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#080F2B]">
      {/* Canvas decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large gradient orbs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-orange-500/15 to-orange-600/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-gradient-to-r from-teal-500/10 to-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Floating geometric shapes */}
        <motion.div
          className="absolute top-32 left-[15%] w-4 h-4 bg-blue-400/30 rounded-full"
          animate={{ y: [0, -20, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-48 right-[20%] w-3 h-3 bg-orange-400/40 rounded-full"
          animate={{ y: [0, 15, 0], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute bottom-40 left-[25%] w-2 h-2 bg-teal-400/35 rounded-full"
          animate={{ y: [0, -10, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
        <motion.div
          className="absolute top-1/3 right-[10%] w-6 h-6 border border-blue-400/30 rounded-lg rotate-45"
          animate={{ rotate: [45, 55, 45], scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/3 left-[10%] w-8 h-8 border border-orange-400/20 rounded-full"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        {/* Decorative lines */}
        <div className="absolute top-1/4 left-0 w-32 h-[1px] bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
        <div className="absolute bottom-1/4 right-0 w-40 h-[1px] bg-gradient-to-r from-transparent via-orange-400/30 to-transparent" />
      </div>

      <div className="section-inner w-full relative z-10 pt-28 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left side - Content */}
          <div className="space-y-8">
            {/* Headline */}
            <motion.h1
              className="text-hero text-white leading-tight"
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
            >
              Turn crypto or cash into{' '}
              <span className="text-orange-400">earning power</span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              className="text-hero-sub text-gray-400 max-w-lg"
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.33, 1, 0.68, 1] }}
            >
              Deposit crypto or cash, earn interest, or lend to others at your own rate.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.33, 1, 0.68, 1] }}
            >
              <Button
                variant="primary"
                size="lg"
                href="/dashboard"
                icon={<ArrowRight className="w-5 h-5" />}
                iconPosition="right"
              >
                Get Started
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
              >
                <ChevronDown className="w-5 h-5" />
                How it Works
              </a>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              className="flex flex-wrap items-center gap-6 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                <span className="text-sm text-gray-400">Non-custodial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                <span className="text-sm text-gray-400">Set your own rates</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                <span className="text-sm text-gray-400">Withdraw anytime</span>
              </div>
            </motion.div>
          </div>

          {/* Right side - Dashboard Preview with floating animation */}
          <motion.div
            className="relative lg:pl-8"
            initial={{ opacity: 0, x: 50, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.33, 1, 0.68, 1] }}
          >
            {/* Dashboard mockup container with floating animation */}
            <motion.div
              className="relative"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Soft glow behind dashboard */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-orange-500/20 rounded-3xl blur-2xl" />

              {/* Dashboard image */}
              <div className="relative bg-white/5 backdrop-blur-sm p-2 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <Image
                  src="/dashboard-preview.png"
                  alt="AwinFi Dashboard Preview"
                  width={800}
                  height={500}
                  className="rounded-xl w-full h-auto"
                  priority
                />
              </div>

              {/* Floating stats cards */}
              <motion.div
                className="absolute -left-6 top-1/4 bg-white/10 backdrop-blur-md p-4 rounded-xl shadow-xl border border-white/20 hidden sm:block"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-teal-400 text-lg font-bold">+</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Earnings</p>
                    <p className="text-lg font-bold text-teal-400">+$124.50</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-6 bottom-1/4 bg-white/10 backdrop-blur-md p-4 rounded-xl shadow-xl border border-white/20 hidden sm:block"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-orange-400 text-lg font-bold">$</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Your Rate</p>
                    <p className="text-lg font-bold text-white">12%</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <motion.div
          className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="w-1 h-2 bg-white/50 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
