'use client';

import { motion } from 'framer-motion';
import { CreateLoanRequestForm } from '@/components/loan/CreateLoanRequestForm';
import { Card } from '@/components/ui/Card';
import { ArrowDownUp, FileText, TrendingUp, Shield } from 'lucide-react';

const benefits = [
  {
    icon: Shield,
    title: 'Keep Your Crypto',
    description: 'Use your assets as collateral without selling',
    color: 'text-green-400',
  },
  {
    icon: TrendingUp,
    title: 'No Credit Checks',
    description: 'Fully permissionless, on-chain lending',
    color: 'text-primary-400',
  },
  {
    icon: ArrowDownUp,
    title: 'Flexible Terms',
    description: 'Choose your loan duration and interest rate',
    color: 'text-accent-400',
  },
  {
    icon: FileText,
    title: 'Transparent',
    description: 'All terms are on-chain and verifiable',
    color: 'text-yellow-400',
  },
];

export default function BorrowPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Borrow <span className="gradient-text">Crypto</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Get liquidity without selling your crypto. Simply deposit collateral and we&apos;ll automatically
            calculate how much you can borrow based on real-time LTV ratios. All transactions are
            simulated first to ensure success.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <CreateLoanRequestForm />
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <h3 className="text-lg font-semibold mb-4">Why Borrow with FlowFinance?</h3>
                <div className="space-y-4">
                  {benefits.map((benefit) => (
                    <div key={benefit.title} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-white/5 ${benefit.color}`}>
                        <benefit.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-medium">{benefit.title}</h4>
                        <p className="text-sm text-gray-400">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* How It Works */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <h3 className="text-lg font-semibold mb-4">How It Works</h3>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-sm flex items-center justify-center">
                      1
                    </span>
                    <p className="text-sm text-gray-300">
                      Enter collateral amount - borrow amount auto-calculates based on LTV
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-sm flex items-center justify-center">
                      2
                    </span>
                    <p className="text-sm text-gray-300">
                      Set your preferred interest rate and loan duration
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-sm flex items-center justify-center">
                      3
                    </span>
                    <p className="text-sm text-gray-300">
                      A lender funds your request and you receive the tokens
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 text-sm flex items-center justify-center">
                      4
                    </span>
                    <p className="text-sm text-gray-300">
                      Repay the loan to get your collateral back
                    </p>
                  </li>
                </ol>
              </Card>
            </motion.div>

            {/* Risk Warning */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-yellow-500/20">
                <h3 className="text-lg font-semibold mb-2 text-yellow-400">Risk Warning</h3>
                <p className="text-sm text-gray-400">
                  If your health factor drops below the liquidation threshold, your collateral
                  may be liquidated. Monitor your position and add collateral if needed.
                </p>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
