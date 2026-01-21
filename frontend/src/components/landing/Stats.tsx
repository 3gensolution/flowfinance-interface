'use client';

import { StatCard } from '@/components/ui/Card';
import { DollarSign, Users, Activity, PiggyBank } from 'lucide-react';
import { usePlatformStats } from '@/hooks/useContracts';
import { formatCompactUSD } from '@/lib/utils';
import { ScrollReveal, StaggerReveal } from '@/components/animations/ScrollReveal';

export function Stats() {
  const { data: stats, isLoading } = usePlatformStats();

  const statsData = [
    {
      label: 'Total Value Locked',
      value: isLoading ? 'Loading...' : formatCompactUSD(stats?.totalCollateralValue || 0),
      subValue: 'Across all collateral',
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      label: 'Active Loans',
      value: isLoading ? 'Loading...' : `${stats?.activeLoans || 0}+`,
      subValue: 'Currently active',
      icon: <Activity className="w-5 h-5" />,
    },
    {
      label: 'Total Borrowed',
      value: isLoading ? 'Loading...' : formatCompactUSD(stats?.totalBorrowed || 0),
      subValue: 'Lifetime volume',
      icon: <PiggyBank className="w-5 h-5" />,
    },
    {
      label: 'Users',
      value: isLoading ? 'Loading...' : `${stats?.activeUsers || 0}+`,
      subValue: 'Active wallets',
      icon: <Users className="w-5 h-5" />,
    },
  ];
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-[1920px] mx-auto">
        <ScrollReveal direction="up" className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Trusted by <span className="gradient-text">Thousands</span>
          </h2>
          <p className="text-gray-400">
            Join a growing community of borrowers and lenders
          </p>
        </ScrollReveal>

        <StaggerReveal
          staggerDelay={0.15}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {statsData.map((stat) => (
            <div key={stat.label}>
              <StatCard
                label={stat.label}
                value={stat.value}
                subValue={stat.subValue}
                icon={stat.icon}
              />
            </div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}
