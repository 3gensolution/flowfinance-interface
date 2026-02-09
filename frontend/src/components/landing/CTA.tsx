'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function CTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="py-24 bg-[#080F2B] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        >
          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6">
            Start earning with your{' '}
            <span className="text-orange-400">crypto today</span>
          </h2>

          {/* Subtext */}
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Join thousands of users who are already making their digital assets work harder.
            No complicated steps, no hidden fees.
          </p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.33, 1, 0.68, 1] }}
          >
            <Button
              variant="primary"
              size="xl"
              href="/dashboard"
              icon={<ArrowRight className="w-6 h-6" />}
              iconPosition="right"
              className="shadow-lg shadow-orange-500/30"
            >
              Get Started Now
            </Button>
          </motion.div>

          {/* Trust note */}
          <motion.p
            className="mt-8 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            No sign-up required. Connect your wallet to begin.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
