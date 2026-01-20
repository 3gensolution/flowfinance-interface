'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import {
  Wallet,
  Shield,
  Clock,
  BarChart3,
  ArrowLeftRight,
  Lock,
} from 'lucide-react';

const features = [
  {
    icon: Wallet,
    title: 'Non-Custodial',
    description: 'Your crypto stays in secure smart contracts. You maintain full control of your assets at all times.',
    color: 'text-primary-400',
  },
  {
    icon: Shield,
    title: 'Over-Collateralized',
    description: 'All loans are backed by crypto collateral, protecting lenders and ensuring system stability.',
    color: 'text-green-400',
  },
  {
    icon: Clock,
    title: 'Flexible Terms',
    description: 'Choose loan durations from 1 day to 365 days. Set your own interest rates and find the perfect match.',
    color: 'text-yellow-400',
  },
  {
    icon: BarChart3,
    title: 'Dynamic LTV',
    description: 'Risk-adjusted loan-to-value ratios based on asset volatility. Blue chips get better rates.',
    color: 'text-accent-400',
  },
  {
    icon: ArrowLeftRight,
    title: 'P2P Matching',
    description: 'Borrowers meet lenders directly. Create requests or browse offers to find the best deal.',
    color: 'text-orange-400',
  },
  {
    icon: Lock,
    title: 'Liquidation Protection',
    description: 'Grace periods give you time to add collateral. Health factor monitoring keeps you informed.',
    color: 'text-red-400',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function Features() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Why <span className="gradient-text">FlowFinance</span>?
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            A trustless lending protocol designed for the modern DeFi user.
            Security, flexibility, and transparency at its core.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card hover className="h-full">
                <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 ${feature.color}`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
