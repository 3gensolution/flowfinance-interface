'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { useAccount, useReadContracts } from 'wagmi';
import Link from 'next/link';
import { Address, formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/ui/Button';
import { PriceStaleWarning } from '@/components/ui/PriceStaleWarning';
import {
  CollateralSelector,
  CollateralAsset,
  CollateralAmountInput,
  StablecoinSelector,
  StablecoinAsset,
  BorrowAsset,
  BorrowType,
  LoanTerms,
  QuotationPanel,
  BorrowSubmitCTA,
} from '@/components/borrower';
import {
  useSupportedAssets,
  useTokenPrice,
  useLTV,
  useLiquidationThreshold,
} from '@/hooks/useContracts';
import { getCurrencySymbol, useExchangeRate, convertFromUSDCents } from '@/hooks/useFiatOracle';
import { TOKEN_LIST } from '@/config/contracts';
import ERC20ABIJson from '@/contracts/ERC20ABI.json';
import { Abi } from 'viem';

const ERC20ABI = ERC20ABIJson as Abi;

// Define wizard steps - Start with borrow asset, then collateral
const STEPS = [
  { id: 1, title: 'Borrow', description: 'Choose the stablecoin you want to borrow' },
  { id: 2, title: 'Collateral', description: 'Select the crypto asset to lock as security' },
  { id: 3, title: 'Amount', description: 'Enter collateral amount and set your LTV' },
  { id: 4, title: 'Terms', description: 'Set your interest rate and duration' },
  { id: 5, title: 'Review', description: 'Review and submit your loan request' },
];

export default function BorrowPage() {
  const { address, isConnected } = useAccount();

  // Wizard state (1-indexed to match Step ids)
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [selectedStablecoin, setSelectedStablecoin] = useState<StablecoinAsset | null>(null);
  const [selectedCollateral, setSelectedCollateral] = useState<CollateralAsset | null>(null);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowType] = useState<BorrowType>('crypto'); // Default to crypto for now
  const [selectedBorrowAsset, setSelectedBorrowAsset] = useState<BorrowAsset | null>(null);
  const [selectedLTV, setSelectedLTV] = useState(0); // User-selected LTV percentage
  const [interestRate, setInterestRate] = useState(10);
  const [duration, setDuration] = useState(30);
  const [customDate, setCustomDate] = useState<Date | null>(null);

  // Get supported assets from Configuration contract
  const { supportedTokens, isLoading: isLoadingSupportedTokens } = useSupportedAssets();

  // Use supported tokens or fallback to TOKEN_LIST
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  // Fetch balances for all supported tokens
  const balanceContracts = availableTokens.map((token) => ({
    address: token.address,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  }));

  const { data: balancesData, isLoading: isLoadingBalances } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: !!address && availableTokens.length > 0,
    },
  });

  // Build collateral assets with real balances
  const collateralAssets: CollateralAsset[] = useMemo(() => {
    return availableTokens.map((token, index) => {
      const balanceResult = balancesData?.[index];
      const rawBalance = balanceResult?.status === 'success' ? (balanceResult.result as bigint) : BigInt(0);
      const formattedBalance = formatUnits(rawBalance, token.decimals);
      const hasBalance = rawBalance > BigInt(0);

      return {
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        decimals: token.decimals,
        balance: parseFloat(formattedBalance).toFixed(4),
        rawBalance,
        hasBalance,
        icon: token.icon,
      };
    });
  }, [availableTokens, balancesData]);

  // Filter stablecoins for borrowing (USDC, USDT, DAI, etc.)
  const stablecoinSymbols = ['USDC', 'USDT', 'DAI'];
  const stablecoins: StablecoinAsset[] = useMemo(() => {
    return availableTokens
      .filter(token => stablecoinSymbols.includes(token.symbol))
      .map(token => ({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        decimals: token.decimals,
        icon: token.icon,
      }));
  }, [availableTokens]);

  // Sync selectedBorrowAsset with selectedStablecoin
  useEffect(() => {
    if (selectedStablecoin) {
      setSelectedBorrowAsset({
        symbol: selectedStablecoin.symbol,
        name: selectedStablecoin.name,
        address: selectedStablecoin.address,
        decimals: selectedStablecoin.decimals,
        icon: selectedStablecoin.icon,
        type: 'crypto',
      });
    } else {
      setSelectedBorrowAsset(null);
    }
  }, [selectedStablecoin]);

  // Get collateral price
  const collateralPriceHook = useTokenPrice(selectedCollateral?.address as Address | undefined);
  const collateralPrice = collateralPriceHook.price;

  // Get borrow asset price
  const borrowAssetAddress = selectedBorrowAsset?.address as Address | undefined;
  const borrowPriceHook = useTokenPrice(borrowAssetAddress);
  const borrowPrice = borrowPriceHook.price;

  // Get LTV from contract
  const { data: ltvBps, isLoading: isLoadingLTV } = useLTV(
    selectedCollateral?.address as Address | undefined,
    duration
  );

  // Get liquidation threshold from contract
  const { data: liquidationThresholdBps } = useLiquidationThreshold(
    selectedCollateral?.address as Address | undefined,
    duration
  );

  // Get exchange rate for selected fiat currency (for cash loans)
  const { data: fiatExchangeRate } = useExchangeRate(
    borrowType === 'cash' && selectedBorrowAsset ? selectedBorrowAsset.symbol : ''
  );

  // Calculate collateral value in USD
  const collateralValue = useMemo(() => {
    if (!selectedCollateral || !collateralAmount || !collateralPrice) return 0;
    const amount = parseFloat(collateralAmount);
    if (isNaN(amount) || amount <= 0) return 0;
    // Price has 8 decimals from Chainlink
    return (amount * Number(collateralPrice)) / 1e8;
  }, [selectedCollateral, collateralAmount, collateralPrice]);

  // Calculate max LTV percentage from contract
  const maxLTVPercent = ltvBps ? Number(ltvBps) / 100 : 0;

  // Liquidation threshold percentage (available for future use)
  const _liquidationThreshold = liquidationThresholdBps ? Number(liquidationThresholdBps) / 100 : 85;
  void _liquidationThreshold; // Suppress unused variable warning

  // Minimum LTV - use 1% if contract doesn't return a minimum
  const minLTVPercent = 1;

  // Calculate fiat borrow amount with exchange rate conversion
  const fiatBorrowAmount = useMemo(() => {
    if (borrowType !== 'cash' || !selectedBorrowAsset || !collateralValue || collateralValue <= 0 || selectedLTV <= 0) {
      return { amount: 0, formatted: '' };
    }

    // Calculate USD value based on LTV
    const borrowUSDValue = (collateralValue * selectedLTV) / 100;

    // For USD, no conversion needed
    if (selectedBorrowAsset.symbol === 'USD') {
      return {
        amount: borrowUSDValue,
        formatted: `${getCurrencySymbol('USD')}${borrowUSDValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      };
    }

    // Convert USD to target currency using exchange rate
    if (!fiatExchangeRate || fiatExchangeRate === BigInt(0)) {
      return { amount: 0, formatted: '' };
    }

    // Exchange rate is units per 1 USD (scaled by 1e8)
    // So: fiatAmount = borrowUSDValue * exchangeRate / 1e8
    const borrowUSDCents = BigInt(Math.floor(borrowUSDValue * 100));
    const fiatAmountCents = convertFromUSDCents(borrowUSDCents, fiatExchangeRate as bigint);
    const fiatAmount = Number(fiatAmountCents) / 100;

    return {
      amount: fiatAmount,
      formatted: `${getCurrencySymbol(selectedBorrowAsset.symbol)}${fiatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
  }, [borrowType, selectedBorrowAsset, collateralValue, selectedLTV, fiatExchangeRate]);

  // Initialize/reset selectedLTV when maxLTV changes
  useEffect(() => {
    if (maxLTVPercent > 0) {
      setSelectedLTV(maxLTVPercent);
    }
  }, [maxLTVPercent]);

  // Calculate borrow amount based on selected LTV using BigInt (like working page)
  const { borrowAmount, borrowAmountUSD, isCalculatingLoan: _isCalculatingLoan } = useMemo(() => {
    const isCalculating = collateralPriceHook.isLoading || borrowPriceHook.isLoading || isLoadingLTV;

    if (!collateralAmount || parseFloat(collateralAmount) <= 0 || !collateralPrice || !borrowPrice || !selectedBorrowAsset || selectedLTV <= 0) {
      return { borrowAmount: 0, borrowAmountUSD: 0, isCalculatingLoan: isCalculating };
    }

    try {
      const collateralDecimals = selectedCollateral?.decimals || 18;
      const borrowDecimals = selectedBorrowAsset?.decimals || 6;

      const collateralAmountBigInt = parseUnits(collateralAmount, collateralDecimals);

      // Calculate collateral value in USD (8 decimals from Chainlink)
      const collateralValueUSD = (collateralAmountBigInt * (collateralPrice as bigint)) / BigInt(10 ** collateralDecimals);

      // Apply selected LTV (convert percentage to basis points)
      const selectedLTVBps = BigInt(Math.floor(selectedLTV * 100));
      const loanUSD = (collateralValueUSD * selectedLTVBps) / BigInt(10000);

      // Convert to borrow token amount
      const borrowAmountCalc = (loanUSD * BigInt(10 ** borrowDecimals)) / (borrowPrice as bigint);

      // Format for display
      const borrowFormatted = formatUnits(borrowAmountCalc, borrowDecimals);
      const borrowNum = parseFloat(borrowFormatted);

      // Calculate USD value
      const borrowUSD = (borrowNum * Number(borrowPrice)) / 1e8;

      return {
        borrowAmount: borrowNum,
        borrowAmountUSD: borrowUSD,
        isCalculatingLoan: false,
      };
    } catch (error) {
      console.error('Error calculating borrow amount:', error);
      return { borrowAmount: 0, borrowAmountUSD: 0, isCalculatingLoan: false };
    }
  }, [collateralAmount, collateralPrice, borrowPrice, selectedBorrowAsset, selectedLTV, selectedCollateral, collateralPriceHook.isLoading, borrowPriceHook.isLoading, isLoadingLTV]);
  void _isCalculatingLoan; // Suppress unused variable warning

  // Step validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: // Stablecoin selection (what to borrow)
        return selectedStablecoin !== null;
      case 2: // Collateral selection
        return selectedCollateral !== null;
      case 3: // Amount input + LTV
        if (!collateralAmount || !selectedCollateral) return false;
        const numAmount = parseFloat(collateralAmount);
        const maxBalance = parseFloat(selectedCollateral.balance.replace(/,/g, ''));
        return numAmount > 0 && numAmount <= maxBalance && selectedLTV > 0 && selectedLTV <= maxLTVPercent;
      case 4: // Interest rate and duration
        return duration > 0 && interestRate >= 5 && interestRate <= 15;
      case 5: // Review
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedStablecoin, selectedCollateral, collateralAmount, selectedLTV, maxLTVPercent, duration, interestRate]);

  // Navigation
  const goNext = () => {
    if (currentStep < STEPS.length && canProceed) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle collateral selection
  const handleCollateralSelect = (asset: CollateralAsset) => {
    setSelectedCollateral(asset);
  };

  // Is form valid for submission
  const isFormValid = useMemo(() => {
    return (
      selectedStablecoin !== null &&
      selectedCollateral !== null &&
      collateralAmount !== '' &&
      parseFloat(collateralAmount) > 0 &&
      selectedBorrowAsset !== null &&
      selectedLTV > 0 &&
      selectedLTV <= maxLTVPercent &&
      duration > 0 &&
      borrowAmount > 0
    );
  }, [selectedStablecoin, selectedCollateral, collateralAmount, selectedBorrowAsset, selectedLTV, maxLTVPercent, borrowAmount, duration]);

  // Get current step info
  const currentStepInfo = STEPS.find(s => s.id === currentStep);

  // Loading states
  const isLoadingAssets = isLoadingSupportedTokens || isLoadingBalances;

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        // Step 1: Select stablecoin to borrow
        return (
          <StablecoinSelector
            selected={selectedStablecoin}
            onSelect={setSelectedStablecoin}
            assets={stablecoins}
            isLoading={isLoadingSupportedTokens}
          />
        );
      case 2:
        // Step 2: Select collateral asset
        return (
          <div className="space-y-6">
            <CollateralSelector
              selected={selectedCollateral}
              onSelect={handleCollateralSelect}
              assets={collateralAssets.filter(a => a.symbol !== selectedStablecoin?.symbol)}
              isLoading={isLoadingAssets}
            />

            {/* Faucet Info */}
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
                {' '}to get free testnet tokens for collateral.
              </p>
            </motion.div>
          </div>
        );
      case 3:
        // Step 3: Enter collateral amount + LTV
        return (
          <div className="space-y-6">
            <CollateralAmountInput
              asset={selectedCollateral}
              amount={collateralAmount}
              onAmountChange={setCollateralAmount}
              usdValue={collateralValue}
            />
            {/* LTV Slider */}
            {collateralAmount && parseFloat(collateralAmount) > 0 && (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 max-w-xl mx-auto">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-white/70 text-sm">Loan-to-Value (LTV)</span>
                  <span className="text-lg font-semibold text-primary-400">{selectedLTV.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={minLTVPercent}
                  max={maxLTVPercent}
                  step={1}
                  value={selectedLTV}
                  onChange={(e) => setSelectedLTV(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:shadow-primary-500/30"
                />
                <div className="flex justify-between text-xs text-white/40 mt-2">
                  <span>{minLTVPercent}%</span>
                  <span>Max: {maxLTVPercent.toFixed(0)}%</span>
                </div>
                {/* Borrow amount preview */}
                {borrowAmount > 0 && (
                  <div className="mt-4 p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                    <p className="text-sm text-white/70">You will receive:</p>
                    <p className="text-xl font-bold text-primary-400">
                      {borrowAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedStablecoin?.symbol}
                    </p>
                    <p className="text-xs text-white/50">~${borrowAmountUSD.toFixed(2)} USD</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <LoanTerms
            borrowAsset={selectedBorrowAsset}
            interestRate={interestRate}
            duration={duration}
            customDate={customDate}
            onInterestRateChange={setInterestRate}
            onDurationChange={setDuration}
            onCustomDateChange={setCustomDate}
          />
        );
      case 5:
        // Build price feeds info for stale warning
        // For fiat loans, only include collateral price feed (fiat currencies don't have on-chain price feeds)
        const priceFeeds = borrowType === 'cash'
          ? [
              {
                isStale: collateralPriceHook.isStale,
                priceFeedAddress: collateralPriceHook.priceFeedAddress,
                price: collateralPrice,
                tokenAddress: selectedCollateral?.address as Address | undefined,
                refetch: collateralPriceHook.refetch,
              },
            ]
          : [
              {
                isStale: collateralPriceHook.isStale,
                priceFeedAddress: collateralPriceHook.priceFeedAddress,
                price: collateralPrice,
                tokenAddress: selectedCollateral?.address as Address | undefined,
                refetch: collateralPriceHook.refetch,
              },
              {
                isStale: borrowPriceHook.isStale,
                priceFeedAddress: borrowPriceHook.priceFeedAddress,
                price: borrowPrice,
                tokenAddress: selectedBorrowAsset?.address as Address | undefined,
                refetch: borrowPriceHook.refetch,
              },
            ];

        return (
          <div className="space-y-6">
            <QuotationPanel
              collateral={selectedCollateral}
              collateralAmount={collateralAmount}
              borrowAsset={selectedBorrowAsset}
              loanAmount={borrowAmount}
              interestRate={interestRate}
              duration={duration}
              collateralValueUSD={collateralValue}
              ltvPercent={maxLTVPercent}
              selectedLTV={selectedLTV}
              borrowType={borrowType}
              fiatAmountFormatted={borrowType === 'cash' ? fiatBorrowAmount.formatted : undefined}
              fiatAmount={borrowType === 'cash' ? fiatBorrowAmount.amount : undefined}
            />
            <PriceStaleWarning priceFeeds={priceFeeds} />
            <BorrowSubmitCTA
              collateral={selectedCollateral}
              collateralAmount={collateralAmount}
              borrowAsset={selectedBorrowAsset}
              loanAmount={borrowAmount}
              interestRate={interestRate}
              duration={duration}
              isValid={isFormValid}
              borrowType={borrowType}
              fiatAmountCents={borrowType === 'cash' ? BigInt(Math.floor(fiatBorrowAmount.amount * 100)) : undefined}
              fiatCurrency={borrowType === 'cash' ? selectedBorrowAsset?.symbol : undefined}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // Show connect wallet message if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-navy-900 pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-white/60">
            Please connect your wallet to start borrowing against your crypto.
          </p>
        </div>
      </div>
    );
  }

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
            <span className="text-primary-400 font-semibold">Step {currentStep}</span>
            <span className="text-white/40">of {STEPS.length}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            Borrow against your{' '}
            <span className="text-primary-400">crypto</span>
          </h1>

          {/* Subtitle - current step description */}
          <p className="text-base text-white/60 max-w-2xl mx-auto">
            {currentStepInfo?.description}
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
                  onClick={goBack}
                  icon={<ArrowLeft className="w-4 h-4" />}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  Back
                </Button>
              </motion.div>
            )}
          </div>

          {/* Continue Button (not shown on review step) */}
          <div className="flex-1 max-w-xs">
            {currentStep < STEPS.length && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!canProceed}
                onClick={goNext}
                icon={<ArrowRight className="w-5 h-5" />}
                iconPosition="right"
              >
                Continue
              </Button>
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
          Lock your crypto as collateral and receive funds. Your crypto is returned after full repayment.
        </motion.p>
      </div>
    </div>
  );
}
