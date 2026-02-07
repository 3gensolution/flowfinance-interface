'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { Address, parseUnits, formatUnits } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { TOKEN_LIST, CONTRACT_ADDRESSES } from '@/config/contracts';
import {
  useApproveToken,
  useTokenBalance,
  useTokenAllowance,
  useLTV,
  useTokenPrice,
  useLiquidationThreshold,
  useMaxInterestRate,
  useSupportedAssets,
  useRefreshMockPrice,
} from '@/hooks/useContracts';
import { useCreateFiatLoanRequest } from '@/hooks/useFiatLoan';
import {
  useGetExchangeRate,
  useGetSupportedCurrencies,
  useIsExchangeRateStale,
  useConvertFromUSDCents,
  getCurrencySymbol
} from '@/hooks/useFiatOracle';
import { PriceFeedDisplay } from '@/components/loan/PriceFeedDisplay';
import { formatTokenAmount, daysToSeconds, getTokenDecimals } from '@/lib/utils';
import { ArrowRight, AlertCircle, CheckCircle, Info, TrendingUp, Shield, Loader2, Banknote, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const durationOptions = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
];

// Currency labels mapping
const currencyLabels: Record<string, string> = {
  'USD': 'USD - US Dollar',
  'NGN': 'NGN - Nigerian Naira',
  'EUR': 'EUR - Euro',
  'GBP': 'GBP - British Pound',
  'KES': 'KES - Kenyan Shilling',
  'GHS': 'GHS - Ghanaian Cedi',
  'ZAR': 'ZAR - South African Rand',
};

// Helper to format number with commas
const formatWithCommas = (value: string): string => {
  if (!value) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function CreateFiatLoanRequestForm() {
  const { address, isConnected } = useAccount();

  const [collateralToken, setCollateralToken] = useState<Address>(TOKEN_LIST[0].address);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [interestRate, setInterestRate] = useState('12');
  const [duration, setDuration] = useState('30');
  const [selectedLTV, setSelectedLTV] = useState<number>(0); // User-selected LTV percentage
  const [step, setStep] = useState<'form' | 'approve' | 'confirm'>('form');
  const [simulationError, setSimulationError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Minimum LTV percentage (10%)
  const MIN_LTV_PERCENT = 10;

  // Ref to track if we've already handled approval success (prevents multiple toasts)
  const approvalHandledRef = useRef(false);

  // Get max interest rate from configuration
  const { data: maxInterestRateData } = useMaxInterestRate();
  const maxInterestRate = maxInterestRateData ? Number(maxInterestRateData) / 100 : 50; // Default 50% if not loaded

  // Get supported assets from Configuration contract
  const { supportedTokens } = useSupportedAssets();
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  const collateralDecimals = getTokenDecimals(collateralToken);

  // Fetch token balances and prices
  const { data: collateralBalance } = useTokenBalance(collateralToken, address);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
    collateralToken,
    address,
    CONTRACT_ADDRESSES.fiatLoanBridge
  );

  // Fetch token prices
  const collateralPriceHook = useTokenPrice(collateralToken);
  const collateralPrice = collateralPriceHook.price;
  const isPriceStale = collateralPriceHook.isStale;

  // Price refresh hook
  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  // Handle price refresh
  const handleRefreshPrice = async () => {
    try {
      if (collateralPriceHook.priceFeedAddress && collateralPrice) {
        await refreshPrice(collateralPriceHook.priceFeedAddress as Address, BigInt(collateralPrice), collateralToken);
        toast.success('Price feed refreshed!');
        collateralPriceHook.refetch();
      }
    } catch (error) {
      console.error('Failed to refresh price:', error);
      toast.error('Failed to refresh price feed');
    }
  };

  // Fetch LTV and configuration
  const durationDays = parseInt(duration);
  const { data: ltvBps, isLoading: isLoadingLTV, error: ltvError } = useLTV(collateralToken, durationDays);
  const { data: liquidationThresholdBps } = useLiquidationThreshold(collateralToken, durationDays);

  // Fetch exchange rate for selected currency using contract's getExchangeRate function
  const { data: exchangeRateData, isLoading: isLoadingExchangeRate } = useGetExchangeRate(currency);
  // getExchangeRate returns [rate, lastUpdated]
  const currencyRate = exchangeRateData ? (exchangeRateData as [bigint, bigint])[0] : undefined;
  // const rateUpdateTime = exchangeRateData ? (exchangeRateData as [bigint, bigint])[1] : undefined;

  // Check if exchange rate is stale using contract function (1 hour = 3600 seconds)
  const { data: rateStaleFromContract } = useIsExchangeRateStale(currency, 3600);
  const rateStale = currency === 'USD' ? false : (rateStaleFromContract as boolean ?? true);

  // Get supported currencies from contract
  const { data: supportedCurrenciesData } = useGetSupportedCurrencies();
  const contractSupportedCurrencies = supportedCurrenciesData as string[] | undefined;

  // Handler for currency change - refetch exchange rate
  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    // Reset fiat amount while we fetch new rate
    if (newCurrency !== 'USD') {
      setFiatAmount('');
      setIsCalculating(true);
    }
  };

  // Handler for collateral token change - triggers recalculation
  const handleCollateralTokenChange = (newToken: Address) => {
    setCollateralToken(newToken);
    setCollateralAmount('');
    setFiatAmount('');
    setMaxLoanUSDCents(BigInt(0));
  };

  // Calculate USD cents for the collateral value (for conversion)
  const [maxLoanUSDCents, setMaxLoanUSDCents] = useState<bigint>(BigInt(0));

  // Use contract's convertFromUSDCents to get the fiat equivalent
  const { data: convertedFiatAmount, isLoading: isLoadingConversion } = useConvertFromUSDCents(
    maxLoanUSDCents > BigInt(0) ? maxLoanUSDCents : undefined,
    currency
  );

  const { approveAsync, simulateApprove, isPending: isApproving, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { createFiatLoanRequest, simulateCreateFiatLoanRequest, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateFiatLoanRequest();

  const parsedCollateralAmount = collateralAmount
    ? parseUnits(collateralAmount, collateralDecimals)
    : BigInt(0);

  const needsApproval = allowance !== undefined && parsedCollateralAmount > (allowance as bigint);

  // Track if we're calculating (waiting for prices, LTV, and exchange rate)
  // const isDataLoading = collateralPriceHook.isLoading || isLoadingLTV || isLoadingExchangeRate;

  // Max LTV percentage from contract
  const maxLTVPercent = ltvBps ? Number(ltvBps) / 100 : 0;

  // Initialize selectedLTV to max when max LTV loads
  useEffect(() => {
    if (maxLTVPercent > 0 && selectedLTV === 0) {
      setSelectedLTV(maxLTVPercent);
    }
  }, [maxLTVPercent, selectedLTV]);

  // Reset selectedLTV when collateral token or duration changes
  useEffect(() => {
    if (maxLTVPercent > 0) {
      setSelectedLTV(maxLTVPercent);
    }
  }, [collateralToken, duration, maxLTVPercent]);

  // Calculate loan in USD cents based on collateral value and selected LTV
  useEffect(() => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      setMaxLoanUSDCents(BigInt(0));
      setFiatAmount('');
      setIsCalculating(false);
      setSimulationError('');
      return;
    }

    if (collateralPriceHook.isLoading || isLoadingLTV) {
      setIsCalculating(true);
      return;
    }

    if (collateralAmount && collateralPrice && ltvBps && selectedLTV > 0) {
      setIsCalculating(true);
      setSimulationError('');

      try {
        const collateralAmountBigInt = parseUnits(collateralAmount, collateralDecimals);

        // Calculate collateral value in USD (8 decimals from Chainlink)
        const collateralValueUSD = (collateralAmountBigInt * (collateralPrice as bigint)) / BigInt(10 ** collateralDecimals);

        // Apply selected LTV (convert percentage to basis points)
        const selectedLTVBps = BigInt(Math.floor(selectedLTV * 100));
        const loanUSD = (collateralValueUSD * selectedLTVBps) / BigInt(10000);

        // Convert to cents (multiply by 100, divide by 1e8 for Chainlink decimals)
        const usdCents = (loanUSD * BigInt(100)) / BigInt(1e8);

        // Set the USD cents value - this will trigger the contract conversion hook
        setMaxLoanUSDCents(usdCents);
      } catch (error) {
        console.error('Error calculating USD cents:', error);
        setMaxLoanUSDCents(BigInt(0));
        setFiatAmount('0');
        setSimulationError('Error calculating loan amount');
        setIsCalculating(false);
      }
    } else {
      if (ltvError && collateralAmount) {
        const errorMsg = (ltvError as Error & { shortMessage?: string })?.shortMessage || 'Asset not enabled in LTV configuration';
        setSimulationError(errorMsg);
        setFiatAmount('');
      }
      setMaxLoanUSDCents(BigInt(0));
      setIsCalculating(false);
    }
  }, [collateralAmount, collateralPrice, ltvBps, selectedLTV, collateralDecimals, collateralPriceHook.isLoading, isLoadingLTV, ltvError, duration]);

  // Update fiat amount when contract conversion completes
  useEffect(() => {
    if (maxLoanUSDCents === BigInt(0)) {
      return;
    }

    if (isLoadingConversion || isLoadingExchangeRate) {
      setIsCalculating(true);
      return;
    }

    // For USD, use the USD cents directly (no conversion needed)
    if (currency === 'USD') {
      const usdAmount = Number(maxLoanUSDCents) / 100;
      setFiatAmount(usdAmount.toFixed(2));
      setIsCalculating(false);
      return;
    }

    // For other currencies, use the contract's converted value
    if (convertedFiatAmount !== undefined) {
      const fiatCents = convertedFiatAmount as bigint;
      const fiatValue = Number(fiatCents) / 100;
      setFiatAmount(fiatValue.toFixed(2));
      setIsCalculating(false);
    } else if (!isLoadingConversion && maxLoanUSDCents > BigInt(0)) {
      // Conversion not available - currency might not be supported
      setSimulationError('Currency conversion not available. Please check if currency is supported.');
      setIsCalculating(false);
    }
  }, [maxLoanUSDCents, convertedFiatAmount, isLoadingConversion, isLoadingExchangeRate, currency]);

  useEffect(() => {
    // Only handle approval success once using ref
    if (approveSuccess && !approvalHandledRef.current) {
      approvalHandledRef.current = true;
      toast.success('Token approved successfully!');
      refetchAllowance();
      // Go directly to confirm step - createFiatLoanRequest has built-in simulation
      setStep('confirm');
    }
    // Reset ref when approval is no longer successful (new approval cycle)
    if (!approveSuccess) {
      approvalHandledRef.current = false;
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (createSuccess) {
      toast.success('Fiat loan request created successfully!');
      setSimulationError(''); // Clear any previous errors
      setCollateralAmount('');
      setFiatAmount('');
      setStep('form');
      // Reset approval ref for next transaction
      approvalHandledRef.current = false;
    }
  }, [createSuccess]);

  useEffect(() => {
    if (createError) {
      toast.error('Failed to create fiat loan request');
    }
  }, [createError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulationError('');

    if (!collateralAmount || !fiatAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    if (hasZeroBalance) {
      toast.error(`You have no ${TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} balance. Visit the faucet to get test tokens.`);
      return;
    }

    if (hasInsufficientBalance) {
      toast.error('Insufficient balance. Please reduce the collateral amount or get more tokens from the faucet.');
      return;
    }

    if (isPriceStale) {
      toast.error('Price data is stale. Please wait for price feeds to be refreshed.');
      return;
    }

    // Check if approval is needed FIRST - skip simulation until after approval
    if (needsApproval) {
      setStep('approve');
      return;
    }

    // Only simulate after approval is complete to prevent false-positive allowance errors
    setIsSimulating(true);
    try {
      const fiatAmountCents = BigInt(Math.floor(parseFloat(fiatAmount) * 100));
      const interestRateBps = BigInt(Math.floor(parseFloat(interestRate) * 100));
      const durationSeconds = daysToSeconds(parseInt(duration));

      const simulation = await simulateCreateFiatLoanRequest(
        collateralToken,
        parsedCollateralAmount,
        fiatAmountCents,
        currency,
        interestRateBps,
        durationSeconds
      );

      if (!simulation.success) {
        setSimulationError(simulation.error || 'Transaction would fail');
        toast.error(simulation.error || 'Transaction would fail. Please check your inputs.');
        setIsSimulating(false);
        return;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Simulation failed';
      setSimulationError(errorMsg);
      toast.error(errorMsg);
      setIsSimulating(false);
      return;
    }
    setIsSimulating(false);

    setStep('confirm');
  };

  const handleApprove = async () => {
    try {
      setSimulationError('');

      // Simulate approval first to catch errors before spending gas
      if (address) {
        setIsSimulating(true);
        const simulation = await simulateApprove(
          collateralToken,
          CONTRACT_ADDRESSES.fiatLoanBridge,
          parsedCollateralAmount,
          address
        );
        setIsSimulating(false);

        if (!simulation.success) {
          setSimulationError(simulation.error || 'Approval would fail');
          toast.error(simulation.error || 'Approval would fail. Please check your wallet.');
          return;
        }
      }

      await approveAsync(collateralToken, CONTRACT_ADDRESSES.fiatLoanBridge, parsedCollateralAmount);
      // Transaction submitted - useEffect will handle success
    } catch (error: unknown) {
      setIsSimulating(false);
      const errorMsg = error instanceof Error ? error.message : 'Approval failed';
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCreateRequest = async () => {
    try {
      setSimulationError('');

      // Convert fiat amount to cents
      const fiatAmountCents = BigInt(Math.floor(parseFloat(fiatAmount) * 100));
      const interestRateBps = BigInt(Math.floor(parseFloat(interestRate) * 100));
      const durationSeconds = daysToSeconds(parseInt(duration));

      await createFiatLoanRequest(
        collateralToken,
        parsedCollateralAmount,
        fiatAmountCents,
        currency,
        interestRateBps,
        durationSeconds
      );
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const tokenOptions = availableTokens.map((token) => ({
    value: token.address,
    label: token.symbol,
  }));

  // Calculate LTV percentage and liquidation threshold for display
  const ltvPercentage = ltvBps ? (Number(ltvBps) / 100).toFixed(2) : '0';
  const liquidationPercentage = liquidationThresholdBps ? (Number(liquidationThresholdBps) / 100).toFixed(2) : '0';

  // Calculate USD values
  const collateralUSD = collateralAmount && collateralPrice
    ? (parseFloat(collateralAmount) * Number(collateralPrice)) / 1e8
    : 0;

  // Calculate max balance in human-readable format
  const maxCollateralBalance = collateralBalance
    ? formatUnits(collateralBalance as bigint, collateralDecimals)
    : '0';
  const maxCollateralBalanceNumber = parseFloat(maxCollateralBalance);

  // Check balance status
  const hasZeroBalance = maxCollateralBalanceNumber === 0;
  const hasInsufficientBalance = collateralAmount && parseFloat(collateralAmount) > maxCollateralBalanceNumber;

  // Handle collateral amount change with max balance check
  const handleCollateralAmountChange = (value: string) => {
    if (!value) {
      setCollateralAmount('');
      return;
    }

    const numValue = parseFloat(value);
    if (numValue > maxCollateralBalanceNumber && maxCollateralBalanceNumber > 0) {
      setCollateralAmount(maxCollateralBalance);
      toast('Amount capped to your maximum balance', { icon: 'i' });
    } else {
      setCollateralAmount(value);
    }
  };

  // Set max balance
  const handleSetMaxBalance = () => {
    if (maxCollateralBalanceNumber > 0) {
      setCollateralAmount(maxCollateralBalance);
    }
  };

  // Check if form is valid for submission
  const isFormValid =
    collateralAmount &&
    parseFloat(collateralAmount) > 0 &&
    fiatAmount &&
    parseFloat(fiatAmount) > 0 &&
    !isCalculating &&
    !isPriceStale &&
    !hasZeroBalance &&
    !hasInsufficientBalance;

  if (!isConnected) {
    return (
      <Card className="text-center py-12 border-green-500/20">
        <AlertCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-gray-400">Please connect your wallet to create a fiat loan request</p>
      </Card>
    );
  }

  return (
    <Card className="border-green-500/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-500/20 rounded-lg">
          <Banknote className="w-6 h-6 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold">Create Fiat Loan Request</h2>
      </div>

      {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Asset Not Enabled Error */}
          {ltvError && (
            <div className="glass-card p-4 border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">Asset Not Enabled</p>
                  <p className="text-sm text-gray-400 mt-1">
                    The selected collateral token is not enabled. Please select a different token.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Collateral Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-400">Collateral (Crypto)</h3>
              <Select
                label="Collateral Token"
                options={tokenOptions}
                value={collateralToken}
                onChange={(e) => handleCollateralTokenChange(e.target.value as Address)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Collateral Amount</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.0"
                      value={collateralAmount}
                      onChange={(e) => handleCollateralAmountChange(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                  {maxCollateralBalanceNumber > 0 && (
                    <button
                      type="button"
                      onClick={handleSetMaxBalance}
                      className="px-3 py-2 text-xs font-semibold text-green-400 hover:text-green-300 bg-green-400/10 hover:bg-green-400/20 rounded-lg transition-colors"
                    >
                      MAX
                    </button>
                  )}
                  <span className="text-sm text-gray-400 min-w-[40px]">
                    {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                {collateralBalance !== undefined && (
                  <p className="text-gray-400">
                    Balance: {formatTokenAmount(collateralBalance as bigint, collateralDecimals)}{' '}
                    {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}
                  </p>
                )}
                {collateralUSD > 0 && (
                  <p className="text-gray-500">
                    ≈ ${collateralUSD.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Balance Warnings */}
              {hasZeroBalance && (
                <div className="glass-card p-3 border border-yellow-500/20 bg-yellow-500/5">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-400 font-medium">No {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} Balance</p>
                      <p className="text-gray-400 mt-1">
                        <a href="/faucet" className="text-green-400 hover:underline">Get test tokens from the faucet</a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {hasInsufficientBalance && !hasZeroBalance && (
                <div className="glass-card p-3 border border-red-500/20 bg-red-500/5">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-red-400 font-medium">Insufficient Balance</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fiat Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-400">Borrow (Fiat)</h3>
              <Select
                label="Currency"
                options={
                  contractSupportedCurrencies && contractSupportedCurrencies.length > 0
                    ? contractSupportedCurrencies.map(code => ({
                        value: code,
                        label: currencyLabels[code] || code
                      }))
                    : [{ value: 'USD', label: 'USD - US Dollar' }]
                }
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
              />

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Fiat Amount (Auto-calculated)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-medium">
                      {getCurrencySymbol(currency)}
                    </span>
                    <input
                      type="text"
                      value={isCalculating ? 'Calculating...' : formatWithCommas(fiatAmount)}
                      readOnly
                      disabled
                      className="input-field w-full pl-9 bg-gray-800/50 cursor-not-allowed text-lg font-semibold"
                    />
                  </div>
                  <div className="flex items-center gap-2 min-w-[60px]">
                    {isCalculating && <Loader2 className="w-4 h-4 text-green-400 animate-spin" />}
                    <span className="text-sm text-gray-400">{currency}</span>
                  </div>
                </div>

                {/* Exchange Rate Display - under input */}
                {currency !== 'USD' && currencyRate && currencyRate > BigInt(0) && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    1 USD = {getCurrencySymbol(currency)}{(Number(currencyRate) / 1e8).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {rateStale && <span className="text-yellow-400 ml-1">⚠</span>}
                  </p>
                )}
              </div>

              {/* LTV Slider */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Loan-to-Value (LTV) Ratio
                </label>
                <input
                  type="range"
                  min={MIN_LTV_PERCENT}
                  max={maxLTVPercent || 80}
                  step="1"
                  value={selectedLTV}
                  onChange={(e) => setSelectedLTV(Number(e.target.value))}
                  disabled={!maxLTVPercent || maxLTVPercent === 0}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">{MIN_LTV_PERCENT}%</span>
                  <span className="text-lg font-semibold text-green-400">{selectedLTV.toFixed(0)}%</span>
                  <span className="text-gray-400">{maxLTVPercent.toFixed(0)}% max</span>
                </div>
                <p className="text-xs text-gray-400">
                  Lower LTV = safer position, less borrowing power. Higher LTV = more borrowing, higher liquidation risk.
                </p>
              </div>

              <div className="glass-card p-3 space-y-1 border-green-500/20">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Selected LTV: <span className="text-green-400 font-medium">{selectedLTV.toFixed(0)}%</span>
                  <span className="text-gray-500">(Max: {ltvPercentage}%)</span>
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Liquidation Threshold: <span className="text-yellow-400 font-medium">{liquidationPercentage}%</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Interest Rate (Total Interest)
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={maxInterestRate}
                  step="0.5"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">0%</span>
                  <span className="text-lg font-semibold text-green-400">{interestRate}%</span>
                  <span className="text-xs text-gray-400">{maxInterestRate}% max</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                This is the total interest you&apos;ll pay, not annual. The same rate applies regardless of duration.
              </p>
            </div>
            <Select
              label="Loan Duration"
              options={durationOptions}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          {/* Price Feed */}
          <PriceFeedDisplay tokenAddress={collateralToken} variant="compact" />

          {/* Price Stale Warning */}
          {isPriceStale && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2 text-sm">
                  <p className="text-red-400 font-medium">Price Data is Stale</p>
                  <p className="text-gray-400">
                    The price feed data is outdated. Transactions will fail until prices are refreshed.
                  </p>
                  <Button
                    onClick={handleRefreshPrice}
                    loading={isRefreshingPrice}
                    size="sm"
                    variant="secondary"
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    Refresh Price Feed
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="glass-card p-4 border border-green-500/20">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <strong>How Fiat Loans Work:</strong>
                </p>
                <ol className="list-decimal list-inside text-gray-400 space-y-1">
                  <li>You lock crypto collateral in the smart contract</li>
                  <li>A verified fiat supplier sees your request and provides the fiat funds</li>
                  <li>You receive fiat via bank transfer or mobile money</li>
                  <li>Repay in fiat to get your collateral back</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Loan Summary */}
          <div className="glass-card p-4 space-y-3 border-green-500/20">
            <h4 className="font-semibold text-gray-300">Loan Summary</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Collateral</span>
              <div className="text-right">
                <div>{collateralAmount || '0'} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}</div>
                {collateralUSD > 0 && <div className="text-xs text-gray-500">≈ ${collateralUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You will receive</span>
              <div className="text-right">
                <div className="text-green-400 font-medium">{getCurrencySymbol(currency)}{formatWithCommas(fiatAmount) || '0'} {currency}</div>
                {currency !== 'USD' && maxLoanUSDCents > BigInt(0) && (
                  <div className="text-xs text-gray-500">
                    ≈ ${(Number(maxLoanUSDCents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interest Rate</span>
              <span>{interestRate}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span>{duration} days</span>
            </div>

            {/* Interest Calculation */}
            {fiatAmount && parseFloat(fiatAmount) > 0 && (
              <>
                <div className="border-t border-gray-700 my-2"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Interest Amount</span>
                  <div className="text-right">
                    <div className="text-yellow-400">
                      {getCurrencySymbol(currency)}{(parseFloat(fiatAmount) * parseFloat(interestRate) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-300">Total Repayment</span>
                  <div className="text-right">
                    <div className="text-white">
                      {getCurrencySymbol(currency)}{(parseFloat(fiatAmount) * (1 + parseFloat(interestRate) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </div>
                    {currency !== 'USD' && maxLoanUSDCents > BigInt(0) && (
                      <div className="text-xs text-gray-500 font-normal">
                        ≈ ${((Number(maxLoanUSDCents) / 100) * (1 + parseFloat(interestRate) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {simulationError && (
            <div className="glass-card p-4 border border-red-500/20 bg-red-500/5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{simulationError}</p>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700"
            icon={<ArrowRight className="w-5 h-5" />}
            disabled={!isFormValid || isSimulating}
            loading={isSimulating}
          >
            {isCalculating ? 'Calculating...' : isSimulating ? 'Validating...' : 'Continue'}
          </Button>
        </form>
      )}

      {step === 'approve' && (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 mx-auto glass-card rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Token Approval Required</h3>
            <p className="text-gray-400">
              Before you can create this fiat loan request, you need to approve the contract to transfer your{' '}
              {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} tokens.
            </p>
          </div>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-left">
            <p className="text-sm text-gray-300 mb-2">
              <span className="text-yellow-400 font-medium">Why is this needed?</span>
            </p>
            <p className="text-xs text-gray-400">
              ERC-20 tokens require a two-step process: first you approve the contract to access your tokens, then you can create the loan request. Your collateral will be locked in the smart contract until the loan is repaid.
            </p>
          </div>
          {simulationError && (
            <div className="glass-card p-4 border border-red-500/20 bg-red-500/5">
              <p className="text-sm text-red-400">{simulationError}</p>
            </div>
          )}
          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setStep('form')} className="flex-1" disabled={isApproving || isApprovalConfirming}>
              Back
            </Button>
            <Button onClick={handleApprove} loading={isApproving || isApprovalConfirming} className="flex-1 bg-green-600 hover:bg-green-700">
              {isApproving ? 'Approving...' : isApprovalConfirming ? 'Confirming...' : 'Approve'}
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 mx-auto glass-card rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Confirm Fiat Loan Request</h3>
            <p className="text-gray-400">
              Create your fiat loan request for {getCurrencySymbol(currency)}{formatWithCommas(fiatAmount)} {currency}
            </p>
          </div>
          <div className="glass-card p-4 space-y-3 text-left border-green-500/20">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Collateral</span>
              <div className="text-right">
                <div>{collateralAmount} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}</div>
                {collateralUSD > 0 && <div className="text-xs text-gray-500">≈ ${collateralUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You will receive</span>
              <div className="text-right">
                <div className="text-green-400 font-medium">{getCurrencySymbol(currency)}{formatWithCommas(fiatAmount)} {currency}</div>
                {currency !== 'USD' && maxLoanUSDCents > BigInt(0) && (
                  <div className="text-xs text-gray-500">
                    ≈ ${(Number(maxLoanUSDCents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interest Rate</span>
              <span>{interestRate}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span>{duration} days</span>
            </div>

            {/* Interest Calculation */}
            {fiatAmount && parseFloat(fiatAmount) > 0 && (
              <>
                <div className="border-t border-gray-700 my-2"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Interest Amount</span>
                  <div className="text-yellow-400">
                    {getCurrencySymbol(currency)}{(parseFloat(fiatAmount) * parseFloat(interestRate) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold bg-gray-800/50 p-2 rounded-lg -mx-2">
                  <span className="text-gray-300">Total Repayment</span>
                  <div className="text-right">
                    <div className="text-white">
                      {getCurrencySymbol(currency)}{(parseFloat(fiatAmount) * (1 + parseFloat(interestRate) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </div>
                    {currency !== 'USD' && maxLoanUSDCents > BigInt(0) && (
                      <div className="text-xs text-gray-500 font-normal">
                        ≈ ${((Number(maxLoanUSDCents) / 100) * (1 + parseFloat(interestRate) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {simulationError && (
            <div className="glass-card p-4 border border-red-500/20 bg-red-500/5">
              <p className="text-sm text-red-400">{simulationError}</p>
            </div>
          )}
          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setStep('form')} className="flex-1">
              Back
            </Button>
            <Button onClick={handleCreateRequest} loading={isCreating} className="flex-1 bg-green-600 hover:bg-green-700">
              {isCreating ? 'Creating...' : 'Create Request'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
