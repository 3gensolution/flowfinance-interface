'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Shield, Lock, Eye, Code2 } from 'lucide-react';
import { usePlatformStats } from '@/hooks/useContracts';
import { formatCompactUSD } from '@/lib/utils';

const trustFeatures = [
  {
    icon: Shield,
    title: 'Non-custodial',
    description: 'You always control your assets. We never hold your funds.',
  },
  {
    icon: Lock,
    title: 'Secure contracts',
    description: 'Smart contracts audited and tested for maximum security.',
  },
  {
    icon: Eye,
    title: 'Transparent',
    description: 'All transactions visible on-chain. No hidden operations.',
  },
  {
    icon: Code2,
    title: 'Open source',
    description: 'Review our code anytime. Trust through transparency.',
  },
];


function TrustBadge({
  feature,
  index,
}: {
  feature: (typeof trustFeatures)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.33, 1, 0.68, 1] }}
    >
      <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
        <feature.icon className="w-5 h-5 text-primary-400" />
      </div>
      <div>
        <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
        <p className="text-sm text-gray-400">{feature.description}</p>
      </div>
    </motion.div>
  );
}

function StatCard({
  stat,
  index,
}: {
  stat: { value: string; label: string };
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      className="text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.33, 1, 0.68, 1] }}
    >
      <div className="text-3xl sm:text-4xl font-bold text-primary-400 mb-2">{stat.value}</div>
      <div className="text-sm text-gray-400">{stat.label}</div>
    </motion.div>
  );
}

export function Trust() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const { data: platformStats, isLoading } = usePlatformStats();

  const stats = [
    {
      value: isLoading ? 'Loading...' : formatCompactUSD(platformStats?.totalCollateralValue || 0),
      label: 'Total Value Locked'
    },
    {
      value: isLoading ? 'Loading...' : `${platformStats?.activeUsers || 0}+`,
      label: 'Active Users'
    },
    {
      value: isLoading ? 'Loading...' : `${platformStats?.totalLoans || 0}+`,
      label: 'Total Loans'
    },
    {
      value: isLoading ? 'Loading...' : `${platformStats?.activeLoans || 0}+`,
      label: 'Active Loans'
    },
  ];

  return (
    <section ref={sectionRef} className="py-24 bg-[#0A0A0A] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-5 md:px-10 lg:px-20 relative z-10">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Security You Can <span className="text-primary-400">Trust</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Built by experienced engineers with your security as the top priority
          </p>
        </motion.div>

        {/* Trust Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {trustFeatures.map((feature, index) => (
            <TrustBadge key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* Stats */}
        <motion.div
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.33, 1, 0.68, 1] }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <StatCard key={stat.label} stat={stat} index={index} />
            ))}
          </div>
        </motion.div>

        {/* Disclaimer */}
        <motion.p
          className="text-center text-sm text-gray-500 mt-8"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          AwinFi is a financial platform. Earnings are not guaranteed. Always do your own research.
        </motion.p>
      </div>
    </section>
  );
}
