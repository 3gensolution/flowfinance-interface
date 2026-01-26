'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreateLoanRequestForm } from '@/components/loan/CreateLoanRequestForm';
import { CreateFiatLoanRequestForm } from '@/components/loan/CreateFiatLoanRequestForm';
import { FiatLenderOfferCard } from '@/components/loan/LoanCard';
import { AcceptFiatLenderOfferModal } from '@/components/loan/AcceptFiatLenderOfferModal';
import { Card } from '@/components/ui/Card';
import { useActiveFiatLenderOffersWithDetails, FiatLenderOffer } from '@/hooks/useFiatLoan';
import { ArrowDownUp, FileText, TrendingUp, Shield, Coins, Banknote, DollarSign, Building2, Loader2 } from 'lucide-react';
import Link from 'next/link';

type LoanType = 'crypto' | 'fiat';

const cryptoBenefits = [
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

const fiatBenefits = [
  {
    icon: DollarSign,
    title: 'Get Real Money',
    description: 'Receive fiat directly to your bank or mobile money',
    color: 'text-green-400',
  },
  {
    icon: Shield,
    title: 'Crypto-Backed',
    description: 'Your crypto stays locked as collateral',
    color: 'text-primary-400',
  },
  {
    icon: Building2,
    title: 'Verified Suppliers',
    description: 'Funds come from KYC-verified fiat providers',
    color: 'text-accent-400',
  },
  {
    icon: ArrowDownUp,
    title: 'Multiple Currencies',
    description: 'USD, NGN, EUR, GBP, and more',
    color: 'text-yellow-400',
  },
];

const cryptoSteps = [
  'Enter collateral amount - borrow amount auto-calculates based on LTV',
  'Set your preferred interest rate and loan duration',
  'A lender funds your request and you receive the tokens',
  'Repay the loan to get your collateral back',
];

const fiatSteps = [
  'Enter collateral amount - fiat borrow amount auto-calculates',
  'Choose your currency (USD, NGN, EUR, etc.) and duration',
  'A verified fiat supplier funds your request',
  'Receive fiat via bank transfer or mobile money',
  'Repay in fiat to get your crypto collateral back',
];

export default function BorrowPage() {
  const [loanType, setLoanType] = useState<LoanType>('crypto');
  const [selectedFiatOffer, setSelectedFiatOffer] = useState<FiatLenderOffer | null>(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);

  // Fetch fiat lender offers
  const { data: fiatLenderOffers, isLoading: isLoadingOffers, refetch: refetchOffers } = useActiveFiatLenderOffersWithDetails();

  const benefits = loanType === 'crypto' ? cryptoBenefits : fiatBenefits;
  const steps = loanType === 'crypto' ? cryptoSteps : fiatSteps;

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
            Borrow <span className={loanType === 'crypto' ? 'gradient-text' : 'text-green-400'}>{loanType === 'crypto' ? 'Crypto' : 'Fiat'}</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {loanType === 'crypto'
              ? "Get liquidity without selling your crypto. Simply deposit collateral and we'll automatically calculate how much you can borrow based on real-time LTV ratios."
              : "Get real fiat money (USD, NGN, EUR, etc.) backed by your crypto collateral. Receive funds via bank transfer or mobile money from verified suppliers."
            }
          </p>
        </motion.div>

        {/* Loan Type Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex justify-center gap-2 mb-8"
        >
          <button
            onClick={() => setLoanType('crypto')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              loanType === 'crypto'
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            <Coins className="w-5 h-5" />
            Crypto Loan
          </button>
          <button
            onClick={() => setLoanType('fiat')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              loanType === 'fiat'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            <Banknote className="w-5 h-5" />
            Fiat Loan
          </button>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <motion.div
              key={loanType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {loanType === 'crypto' ? (
                <CreateLoanRequestForm />
              ) : (
                <CreateFiatLoanRequestForm />
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Benefits */}
            <motion.div
              key={`benefits-${loanType}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className={loanType === 'fiat' ? 'border-green-500/20' : ''}>
                <h3 className="text-lg font-semibold mb-4">
                  Why {loanType === 'crypto' ? 'Crypto' : 'Fiat'} Loans?
                </h3>
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
              key={`steps-${loanType}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className={loanType === 'fiat' ? 'border-green-500/20' : ''}>
                <h3 className="text-lg font-semibold mb-4">How It Works</h3>
                <ol className="space-y-3">
                  {steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full text-sm flex items-center justify-center ${
                        loanType === 'crypto'
                          ? 'bg-primary-500/20 text-primary-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {index + 1}
                      </span>
                      <p className="text-sm text-gray-300">{step}</p>
                    </li>
                  ))}
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
                  {loanType === 'crypto'
                    ? 'If your health factor drops below the liquidation threshold, your collateral may be liquidated. Monitor your position and add collateral if needed.'
                    : 'Your crypto collateral may be liquidated if the value drops significantly. The fiat supplier will receive your collateral if you fail to repay. Always repay on time.'
                  }
                </p>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Available Fiat Lender Offers */}
        {loanType === 'fiat' && fiatLenderOffers && fiatLenderOffers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Available <span className="text-green-400">Fiat Offers</span>
                </h2>
                <p className="text-gray-400">
                  Accept an offer instantly instead of waiting for your request to be funded
                </p>
              </div>
              <Link href="/marketplace?tab=offers" className="text-sm text-green-400 hover:text-green-300">
                View All Offers →
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoadingOffers ? (
                <div className="col-span-full flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-400" />
                </div>
              ) : (
                fiatLenderOffers.slice(0, 6).map((offer) => (
                  <FiatLenderOfferCard
                    key={offer.offerId.toString()}
                    offer={offer}
                    isOwner={false}
                    onAccept={() => {
                      setSelectedFiatOffer(offer);
                      setIsAcceptModalOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Accept Fiat Lender Offer Modal */}
        <AcceptFiatLenderOfferModal
          offer={selectedFiatOffer}
          isOpen={isAcceptModalOpen}
          onClose={() => {
            setIsAcceptModalOpen(false);
            setSelectedFiatOffer(null);
          }}
          onSuccess={() => {
            refetchOffers();
          }}
        />
      </div>
    </div>
  );
}
