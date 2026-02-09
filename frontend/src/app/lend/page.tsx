'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
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

// Define wizard steps
const STEPS = [
  { id: 1, title: 'Type', description: 'Choose whether to lend crypto or cash' },
  { id: 2, title: 'Asset', description: 'Select the specific asset you want to lend' },
  { id: 3, title: 'Amount', description: 'Enter how much you want to lend' },
  { id: 4, title: 'Rate', description: 'Set your interest rate for borrowers' },
  { id: 5, title: 'Review', description: 'Confirm your lending details' },
];

export default function LendPage() {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [assetType, setAssetType] = useState<AssetType>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState(10);

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
          <AssetTypeSelector
            selected={assetType}
            onSelect={handleAssetTypeChange}
          />
        );
      case 2:
        return (
          <AssetSelector
            assetType={assetType}
            selected={selectedAsset}
            onSelect={setSelectedAsset}
          />
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
          <SummaryPanel
            assetType={assetType}
            asset={selectedAsset}
            amount={amount}
            rate={interestRate}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 pt-20 pb-8 px-4 sm:px-6 lg:px-8">
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
            <span className="text-blue-400">cash</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base text-white/60 max-w-2xl mx-auto">
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
          className="flex items-center justify-between max-w-xl mx-auto mt-4"
        >
          {/* Back Button */}
          <div className="w-28">
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

          {/* Continue / Submit Button */}
          <div className="flex-1 max-w-xs">
            {isCashFlowUnverified ? (
              <div className="h-12" />
            ) : currentStep < STEPS.length ? (
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
            ) : (
              <SubmitCTA
                asset={selectedAsset}
                amount={amount}
                rate={interestRate}
                isValid={isStepComplete()}
                assetType={assetType}
                onSubmit={handleSubmit}
              />
            )}
          </div>

          {/* Spacer for alignment */}
          <div className="w-28" />
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
