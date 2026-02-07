'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreateLenderOfferForm } from '@/components/loan/CreateLenderOfferForm';
import { CreateFiatLenderOfferForm } from '@/components/loan/CreateFiatLenderOfferForm';
import { Card } from '@/components/ui/Card';
import { Wallet, TrendingUp, Shield, CheckCircle, Coins, Banknote } from 'lucide-react';

const cryptoBenefits = [
  {
    icon: TrendingUp,
    title: 'Earn Interest',
    description: 'Set your own rates and earn yield on your crypto',
    color: 'text-green-400',
  },
  {
    icon: Shield,
    title: 'Collateral Protected',
    description: 'All loans are over-collateralized for your safety',
    color: 'text-primary-400',
  },
  {
    icon: Wallet,
    title: 'Non-Custodial',
    description: 'Your funds are secured by smart contracts',
    color: 'text-accent-400',
  },
  {
    icon: CheckCircle,
    title: 'Liquidation Safety',
    description: 'If borrower defaults, you receive their collateral',
    color: 'text-yellow-400',
  },
];

const fiatBenefits = [
  {
    icon: TrendingUp,
    title: 'Earn Interest',
    description: 'Fixed 12% APY on fiat loans backed by crypto',
    color: 'text-green-400',
  },
  {
    icon: Shield,
    title: 'Crypto Collateral',
    description: 'All fiat loans secured by over-collateralized crypto',
    color: 'text-green-400',
  },
  {
    icon: Wallet,
    title: 'Supplier Verified',
    description: 'Only verified suppliers can create fiat offers',
    color: 'text-green-400',
  },
  {
    icon: CheckCircle,
    title: 'Multiple Currencies',
    description: 'Support for USD, NGN, EUR, GBP, KES, GHS, ZAR',
    color: 'text-green-400',
  },
];

export default function LendPage() {
  const [offerType, setOfferType] = useState<'crypto' | 'fiat'>('crypto');

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Lend <span className="gradient-text">{offerType === 'crypto' ? 'Crypto' : 'Fiat'}</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {offerType === 'crypto'
              ? 'Earn yield by providing liquidity to borrowers. Create an offer with your terms or fund existing loan requests in the marketplace.'
              : 'Provide fiat liquidity to borrowers backed by crypto collateral. Create offers for verified supplier lending.'}
          </p>
        </motion.div>

        {/* Offer Type Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex justify-center gap-2 mb-8"
        >
          <button
            onClick={() => setOfferType('crypto')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              offerType === 'crypto'
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            <Coins className="w-4 h-4" />
            Crypto Lending
          </button>
          <button
            onClick={() => setOfferType('fiat')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              offerType === 'fiat'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            <Banknote className="w-4 h-4" />
            Fiat Lending
          </button>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {offerType === 'crypto' ? (
                <CreateLenderOfferForm />
              ) : (
                <CreateFiatLenderOfferForm />
              )}
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
              <Card className={offerType === 'fiat' ? 'border-green-500/20' : ''}>
                <h3 className="text-lg font-semibold mb-4">Why Lend in AwinFi?</h3>
                <div className="space-y-4">
                  {(offerType === 'crypto' ? cryptoBenefits : fiatBenefits).map((benefit) => (
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
              <Card className={offerType === 'fiat' ? 'border-green-500/20' : ''}>
                <h3 className="text-lg font-semibold mb-4">How It Works</h3>
                {offerType === 'crypto' ? (
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-500/20 text-accent-400 text-sm flex items-center justify-center">
                        1
                      </span>
                      <p className="text-sm text-gray-300">
                        Create an offer specifying amount, collateral requirements, and terms
                      </p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-500/20 text-accent-400 text-sm flex items-center justify-center">
                        2
                      </span>
                      <p className="text-sm text-gray-300">
                        A borrower accepts your offer with the required collateral
                      </p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-500/20 text-accent-400 text-sm flex items-center justify-center">
                        3
                      </span>
                      <p className="text-sm text-gray-300">
                        Earn interest as the borrower repays the loan
                      </p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-500/20 text-accent-400 text-sm flex items-center justify-center">
                        4
                      </span>
                      <p className="text-sm text-gray-300">
                        If default occurs, you can claim the borrower&apos;s collateral
                      </p>
                    </li>
                  </ol>
                ) : (
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm flex items-center justify-center">
                        1
                      </span>
                      <p className="text-sm text-gray-300">
                        Create a fiat offer specifying currency, amount, and minimum collateral
                      </p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm flex items-center justify-center">
                        2
                      </span>
                      <p className="text-sm text-gray-300">
                        Borrower accepts with crypto collateral locked on-chain
                      </p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm flex items-center justify-center">
                        3
                      </span>
                      <p className="text-sm text-gray-300">
                        Disburse fiat to borrower off-chain via traditional banking
                      </p>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-sm flex items-center justify-center">
                        4
                      </span>
                      <p className="text-sm text-gray-300">
                        Receive fiat repayment with interest or claim collateral if default
                      </p>
                    </li>
                  </ol>
                )}
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
                  While loans are over-collateralized, rapid market movements could affect
                  collateral value. DeFi lending involves smart contract risks.
                </p>
              </Card>
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}
