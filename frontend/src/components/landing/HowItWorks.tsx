'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { ArrowDown, Wallet, FileText, HandCoins, CheckCircle2 } from 'lucide-react';

const borrowSteps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Connect your Web3 wallet to get started',
  },
  {
    icon: FileText,
    title: 'Create Request',
    description: 'Specify collateral, borrow amount, and terms',
  },
  {
    icon: HandCoins,
    title: 'Get Funded',
    description: 'A lender funds your request',
  },
  {
    icon: CheckCircle2,
    title: 'Repay & Unlock',
    description: 'Repay the loan to get your collateral back',
  },
];

const lendSteps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Connect your Web3 wallet to get started',
  },
  {
    icon: FileText,
    title: 'Browse or Create',
    description: 'Find loan requests or create your own offer',
  },
  {
    icon: HandCoins,
    title: 'Fund Loans',
    description: 'Provide liquidity and start earning',
  },
  {
    icon: CheckCircle2,
    title: 'Earn Interest',
    description: 'Receive principal + interest on repayment',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Simple, transparent, and permissionless lending in just a few steps
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Borrower Flow */}
          <div>
            <h3 className="text-2xl font-bold mb-8 text-center">
              <span className="text-primary-400">For Borrowers</span>
            </h3>
            <div className="space-y-4">
              {borrowSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Step {index + 1}</span>
                      </div>
                      <h4 className="font-semibold">{step.title}</h4>
                      <p className="text-sm text-gray-400">{step.description}</p>
                    </div>
                  </Card>
                  {index < borrowSteps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Lender Flow */}
          <div>
            <h3 className="text-2xl font-bold mb-8 text-center">
              <span className="text-accent-400">For Lenders</span>
            </h3>
            <div className="space-y-4">
              {lendSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-accent-500/20 rounded-xl flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-accent-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Step {index + 1}</span>
                      </div>
                      <h4 className="font-semibold">{step.title}</h4>
                      <p className="text-sm text-gray-400">{step.description}</p>
                    </div>
                  </Card>
                  {index < lendSteps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
