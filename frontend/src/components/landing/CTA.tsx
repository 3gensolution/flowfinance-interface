'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ScrollReveal } from '@/components/animations/ScrollReveal';

export function CTA() {
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-[1920px] mx-auto">
        <ScrollReveal direction="up" duration={1}>
          <div className="relative glass-card p-8 sm:p-12 text-center overflow-hidden">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-primary-500/5" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full mb-6">
                <Sparkles className="w-4 h-4 text-accent-500" />
                <span className="text-sm text-gray-300">Start earning today</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto mb-8">
                Join the future of decentralized lending. No KYC, no credit checks,
                just connect your wallet and start borrowing or lending.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/marketplace">
                  <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                    Explore Marketplace
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="secondary" size="lg">
                    View Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
