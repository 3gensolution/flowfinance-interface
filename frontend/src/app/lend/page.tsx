'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Users, Info } from 'lucide-react';
import Link from 'next/link';
import { useAccount, useReadContracts, useReadContract } from 'wagmi';
import { Abi } from 'viem';
import { Button } from '@/components/ui/Button';
import {
  AssetTypeSelector,
  AssetSelector,
  AmountInput,
  InterestSlider,
  SummaryPanel,
  SubmitCTA,
  type AssetType,
  type Asset,
} from '@/components/lender';
import { useIsVerifiedSupplier } from '@/hooks/useSupplyAssets';
import { useLoanConfigLimits } from '@/hooks/useContracts';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { useNetwork } from '@/contexts/NetworkContext';
import { config as wagmiConfig } from '@/config/wagmi';
import { LoanRequestStatus } from '@/types';
import { FiatLoanStatus } from '@/hooks/useFiatLoan';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

// Define wizard steps
const STEPS = [
  { id: 1, title: 'Type', description: 'Choose whether to lend crypto or cash' },
  { id: 2, title: 'Asset', description: 'Select the specific asset you want to lend' },
  { id: 3, title: 'Amount', description: 'Enter how much you want to lend' },
  { id: 4, title: 'Rate', description: 'Set your interest rate for borrowers' },
  { id: 5, title: 'Review', description: 'Confirm your lending details' },
];

export default function LendPage() {
  const { address, isConnected } = useAccount();
  const { selectedNetwork } = useNetwork();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [assetType, setAssetType] = useState<AssetType>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState(10);

  // Fetch available borrow requests count for informational banner
  const { data: nextCryptoRequestId } = useReadContract({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    functionName: 'nextLoanRequestId',
    chainId: selectedNetwork.id,
    config: wagmiConfig,
  });

  const cryptoRequestCount = nextCryptoRequestId ? Number(nextCryptoRequestId) : 0;

  // Fetch crypto requests to filter out user's own requests
  const { data: cryptoRequestsData } = useReadContracts({
    contracts: Array.from({ length: cryptoRequestCount }, (_, i) => ({
      address: CONTRACT_ADDRESSES.loanMarketPlace,
      abi: LoanMarketPlaceABI,
      functionName: 'loanRequests',
      args: [BigInt(i)],
      chainId: selectedNetwork.id,
    })),
    config: wagmiConfig,
    query: {
      enabled: cryptoRequestCount > 0 && isConnected,
    },
  });

  const { data: pendingFiatLoanIds } = useReadContract({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    functionName: 'getPendingFiatLoans',
    chainId: selectedNetwork.id,
    config: wagmiConfig,
  });

  const fiatLoanIds = useMemo(() => (pendingFiatLoanIds as bigint[]) || [], [pendingFiatLoanIds]);

  // Fetch fiat requests to filter out user's own requests
  const { data: fiatRequestsData } = useReadContracts({
    contracts: fiatLoanIds.map((id) => ({
      address: CONTRACT_ADDRESSES.fiatLoanBridge,
      abi: FiatLoanBridgeABI,
      functionName: 'getFiatLoan',
      args: [id],
      chainId: selectedNetwork.id,
    })),
    config: wagmiConfig,
    query: {
      enabled: fiatLoanIds.length > 0 && isConnected,
    },
  });

  // Calculate total available borrow requests (excluding user's own requests)
  const totalAvailableRequests = useMemo(() => {
    if (!isConnected || !address) {
      // If not connected, show total count
      return cryptoRequestCount + fiatLoanIds.length;
    }

    // Filter out user's own crypto requests
    let cryptoCount = 0;
    if (cryptoRequestsData) {
      cryptoCount = cryptoRequestsData.filter((result) => {
        if (result.status !== 'success' || !result.result) return false;

        const data = result.result;
        const isArray = Array.isArray(data);

        let requestData;
        if (isArray) {
          const arr = data as readonly unknown[];
          requestData = {
            borrower: arr[1],
            status: arr[11],
          };
        } else {
          requestData = data as Record<string, unknown>;
        }

        // Filter out user's own requests, empty requests, and non-pending requests
        if (!requestData.borrower || requestData.borrower === '0x0000000000000000000000000000000000000000') {
          return false;
        }
        if ((requestData.borrower as string).toLowerCase() === address.toLowerCase()) {
          return false;
        }
        if (Number(requestData.status) !== LoanRequestStatus.PENDING) {
          return false;
        }

        return true;
      }).length;
    }

    // Filter out user's own fiat requests
    let fiatCount = 0;
    if (fiatRequestsData) {
      fiatCount = fiatRequestsData.filter((result) => {
        if (result.status !== 'success' || !result.result) return false;

        const data = result.result;
        const isArray = Array.isArray(data);

        let loanData;
        if (isArray) {
          const arr = data as readonly unknown[];
          loanData = {
            borrower: arr[1],
            status: arr[9],
          };
        } else {
          loanData = data as Record<string, unknown>;
        }

        // Filter out user's own requests and empty requests
        if (!loanData.borrower || loanData.borrower === '0x0000000000000000000000000000000000000000') {
          return false;
        }
        if ((loanData.borrower as string).toLowerCase() === address.toLowerCase()) {
          return false;
        }
        // For fiat loans, status 0 = PENDING_SUPPLIER
        if (Number(loanData.status) !== FiatLoanStatus.PENDING_SUPPLIER) {
          return false;
        }

        return true;
      }).length;
    }

    return cryptoCount + fiatCount;
  }, [isConnected, address, cryptoRequestsData, fiatRequestsData, cryptoRequestCount, fiatLoanIds.length]);

  // Check if user is verified supplier (for cash/fiat)
  const { isVerified, isLoading: isVerificationLoading } = useIsVerifiedSupplier();

  // Get interest rate limits from contract configuration
  const { minInterestPercent, maxInterestPercent, isLoading: isConfigLoading } = useLoanConfigLimits();

  // Use contract values or fallback defaults
  const minRate = Math.max(minInterestPercent || 0.01, 1);
  const maxRate = Math.min(maxInterestPercent || 100, 50);

  // Calculate minimum amount based on token decimals
  const getMinAmount = () => {
    if (!selectedAsset) return '0.0001';
    const decimals = selectedAsset.decimals || 18;
    const minDecimals = Math.min(4, decimals);
    return (1 / Math.pow(10, minDecimals)).toString();
  };

  const minAmount = getMinAmount();

  // Determine if continue button should be hidden (cash flow and not verified)
  const isCashFlowUnverified = assetType === 'cash' && !isVerified && !isVerificationLoading;

  // Handle asset type change - reset dependent selections
  const handleAssetTypeChange = (type: AssetType) => {
    setAssetType(type);
    setSelectedAsset(null);
    setAmount('');
  };

  // Check if current step is complete
  const isStepComplete = () => {
    switch (currentStep) {
      case 1:
        return assetType !== null;
      case 2:
        return selectedAsset !== null;
      case 3:
        return amount !== '' && parseFloat(amount) >= parseFloat(minAmount);
      case 4:
        return interestRate >= minRate && interestRate <= maxRate;
      case 5:
        return true;
      default:
        return false;
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentStep < STEPS.length && isStepComplete()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Reset form after successful submission
    setCurrentStep(1);
    setAssetType(null);
    setSelectedAsset(null);
    setAmount('');
    setInterestRate(10);
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Available Requests Banner */}
            {totalAvailableRequests > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <Link href="/marketplace?tab=borrow_requests">
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-primary-500/10 border border-orange-500/30 hover:border-orange-500/50 transition-all duration-300 group cursor-pointer">
                    <Users className="w-5 h-5 flex-shrink-0 mt-0.5 text-orange-400 group-hover:scale-110 transition-transform" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-400 mb-1">
                        {totalAvailableRequests} borrower{totalAvailableRequests !== 1 ? 's' : ''} waiting for funding
                      </p>
                      <p className="text-xs text-white/60">
                        Browse the marketplace to find borrowers looking for loans right now
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </div>
                </Link>
              </motion.div>
            )}

            <AssetTypeSelector
              selected={assetType}
              onSelect={handleAssetTypeChange}
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            {/* Available Requests Banner */}
            {totalAvailableRequests > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <Link href="/marketplace?tab=borrow_requests">
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-primary-500/10 border border-orange-500/30 hover:border-orange-500/50 transition-all duration-300 group cursor-pointer">
                    <Users className="w-5 h-5 flex-shrink-0 mt-0.5 text-orange-400 group-hover:scale-110 transition-transform" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-400 mb-1">
                        {totalAvailableRequests} borrower{totalAvailableRequests !== 1 ? 's' : ''} waiting for funding
                      </p>
                      <p className="text-xs text-white/60">
                        Start earning interest immediately by funding existing borrow requests
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </div>
                </Link>
              </motion.div>
            )}

            <AssetSelector
              assetType={assetType}
              selected={selectedAsset}
              onSelect={setSelectedAsset}
            />

            {/* Faucet Info - only show for crypto assets */}
            {assetType === 'crypto' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400 max-w-2xl mx-auto"
              >
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>
                  Need testnet tokens?{' '}
                  <Link href="/faucet" className="font-semibold underline underline-offset-2 hover:text-blue-300 transition-colors">
                    Visit our Faucet page
                  </Link>
                  {' '}to get free testnet tokens to start lending.
                </p>
              </motion.div>
            )}
          </div>
        );
      case 3:
        return (
          <AmountInput
            assetType={assetType}
            asset={selectedAsset}
            amount={amount}
            onAmountChange={setAmount}
            minAmount={minAmount}
          />
        );
      case 4:
        return (
          <InterestSlider
            asset={selectedAsset}
            rate={interestRate}
            onRateChange={setInterestRate}
            minRate={minRate}
            maxRate={maxRate}
            isLoading={isConfigLoading}
          />
        );
      case 5:
        return (
          <div className="space-y-6">
            <SummaryPanel
              assetType={assetType}
              asset={selectedAsset}
              amount={amount}
              rate={interestRate}
            />
            <SubmitCTA
              asset={selectedAsset}
              amount={amount}
              rate={interestRate}
              isValid={isStepComplete()}
              assetType={assetType}
              onSubmit={handleSubmit}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 pt-20 pb-8 px-4 sm:px-5 md:px-10 lg:px-20 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header with Step Counter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          {/* Step Counter Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-4">
            <span className="text-orange-400 font-semibold">Step {currentStep}</span>
            <span className="text-white/40">of {STEPS.length}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            Earn by lending{' '}
            <span className="text-orange-400">crypto</span> or{' '}
            <span className="text-primary-400">cash</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-white/60 max-w-2xl mx-auto">
            Supply funds and set your own interest rate.
          </p>
        </motion.div>

        {/* Step Content */}
        <div className="min-h-[320px] flex items-center justify-center py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between gap-3 max-w-xl mx-auto mt-4"
        >
          {/* Back Button */}
          <div className="w-20 sm:w-28 flex-shrink-0">
            {currentStep > 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleBack}
                  icon={<ArrowLeft className="w-4 h-4" />}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  Back
                </Button>
              </motion.div>
            )}
          </div>

          {/* Continue Button (not shown on review step) */}
          <div className="flex-1 min-w-0 max-w-xs">
            {!isCashFlowUnverified && currentStep < STEPS.length && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!isStepComplete()}
                onClick={handleNext}
                icon={<ArrowRight className="w-5 h-5" />}
                iconPosition="right"
              >
                Continue
              </Button>
            )}
          </div>

          {/* Spacer for alignment */}
          <div className="w-20 sm:w-28 flex-shrink-0" />
        </motion.div>

        {/* Microcopy */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-white/30 text-xs mt-4"
        >
          Borrowers can take any amount from your supply. You earn interest on what they use.
        </motion.p>
      </div>
    </div>
  );
}
