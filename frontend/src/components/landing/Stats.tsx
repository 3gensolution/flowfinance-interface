'use client';

import { motion } from 'framer-motion';
import { StatCard } from '@/components/ui/Card';
import { DollarSign, Users, Activity, PiggyBank } from 'lucide-react';
import { usePlatformStats } from '@/hooks/useContracts';
import { formatCompactUSD, formatCompactNumber } from '@/lib/utils';

export function Stats() {
  const { data: stats, isLoading } = usePlatformStats();

  const statsData = [
    {
      label: 'Total Value Locked',
      value: isLoading ? 'Loading...' : formatCompactUSD(Number(stats?.totalCollateralValue || 0)),
      subValue: 'Across all collateral',
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      label: 'Active Loans',
      value: isLoading ? 'Loading...' : `${formatCompactNumber(stats?.activeLoans || 0)}+`,
      subValue: 'Currently active',
      icon: <Activity className="w-5 h-5" />,
    },
    {
      label: 'Total Borrowed',
      value: isLoading ? 'Loading...' : formatCompactUSD(Number(stats?.totalBorrowed || 0)),
      subValue: 'Lifetime volume',
      icon: <PiggyBank className="w-5 h-5" />,
    },
    {
      label: 'Users',
      value: isLoading ? 'Loading...' : `${formatCompactNumber(stats?.activeUsers || 0)}+`,
      subValue: 'Active wallets',
      icon: <Users className="w-5 h-5" />,
    },
  ];
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Trusted by <span className="gradient-text">Thousands</span>
          </h2>
          <p className="text-gray-400">
            Join a growing community of borrowers and lenders
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
            >
              <StatCard
                label={stat.label}
                value={stat.value}
                subValue={stat.subValue}
                icon={stat.icon}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
