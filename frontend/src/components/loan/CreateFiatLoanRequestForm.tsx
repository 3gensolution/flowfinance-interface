'use client';

import { useState, useEffect } from 'react';
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
} from '@/hooks/useContracts';
import { useCreateFiatLoanRequest } from '@/hooks/useFiatLoan';
import { PriceFeedDisplay } from '@/components/loan/PriceFeedDisplay';
import { formatTokenAmount, daysToSeconds, getTokenDecimals } from '@/lib/utils';
import { ArrowRight, AlertCircle, CheckCircle, Info, TrendingUp, Shield, Loader2, DollarSign, Banknote } from 'lucide-react';
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

const currencyOptions = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'GHS', label: 'GHS - Ghanaian Cedi' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
];

export function CreateFiatLoanRequestForm() {
  const { address, isConnected } = useAccount();

  const [collateralToken, setCollateralToken] = useState<Address>(TOKEN_LIST[0].address);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const interestRate = '12'; // Fixed at 12% APY
  const [duration, setDuration] = useState('30');
  const [step, setStep] = useState<'form' | 'approve' | 'confirm'>('form');
  const [simulationError, setSimulationError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);

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

  // Fetch LTV and configuration
  const durationDays = parseInt(duration);
  const { data: ltvBps, isLoading: isLoadingLTV, error: ltvError } = useLTV(collateralToken, durationDays);
  const { data: liquidationThresholdBps } = useLiquidationThreshold(collateralToken, durationDays);

  const { approve, isPending: isApproving, isSuccess: approveSuccess } = useApproveToken();
  const { createFiatLoanRequest, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateFiatLoanRequest();

  const parsedCollateralAmount = collateralAmount
    ? parseUnits(collateralAmount, collateralDecimals)
    : BigInt(0);

  const needsApproval = allowance !== undefined && parsedCollateralAmount > (allowance as bigint);

  // Track if we're calculating (waiting for prices and LTV)
  const isDataLoading = collateralPriceHook.isLoading || isLoadingLTV;

  // Calculate maximum fiat borrow amount based on LTV
  useEffect(() => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      setFiatAmount('');
      setIsCalculating(false);
      setSimulationError('');
      return;
    }

    if (isDataLoading) {
      setIsCalculating(true);
      return;
    }

    if (collateralAmount && collateralPrice && ltvBps) {
      setIsCalculating(true);
      setSimulationError('');

      try {
        const collateralAmountBigInt = parseUnits(collateralAmount, collateralDecimals);

        // Calculate collateral value in USD (8 decimals from Chainlink)
        const collateralValueUSD = (collateralAmountBigInt * (collateralPrice as bigint)) / BigInt(10 ** collateralDecimals);

        // Apply LTV (ltvBps is in basis points, 10000 = 100%)
        const maxLoanUSD = (collateralValueUSD * (ltvBps as bigint)) / BigInt(10000);

        // Convert to cents (multiply by 100, divide by 1e8 for Chainlink decimals)
        const maxFiatCents = (maxLoanUSD * BigInt(100)) / BigInt(1e8);
        const maxFiatDollars = Number(maxFiatCents) / 100;

        setFiatAmount(maxFiatDollars.toFixed(2));
      } catch (error) {
        console.error('Error calculating fiat amount:', error);
        setFiatAmount('0');
        setSimulationError('Error calculating fiat amount');
      } finally {
        setIsCalculating(false);
      }
    } else {
      if (ltvError && collateralAmount) {
        const errorMsg = (ltvError as Error & { shortMessage?: string })?.shortMessage || 'Asset not enabled in LTV configuration';
        setSimulationError(errorMsg);
        setFiatAmount('');
      }
      setIsCalculating(false);
    }
  }, [collateralAmount, collateralPrice, ltvBps, collateralDecimals, isDataLoading, ltvError, duration]);

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Token approved successfully!');
      refetchAllowance();
      setStep('confirm');
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (createSuccess) {
      toast.success('Fiat loan request created successfully!');
      setCollateralAmount('');
      setFiatAmount('');
      setStep('form');
    }
  }, [createSuccess]);

  useEffect(() => {
    if (createError) {
      toast.error('Failed to create fiat loan request');
    }
  }, [createError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    if (needsApproval) {
      setStep('approve');
      return;
    }

    setStep('confirm');
  };

  const handleApprove = async () => {
    try {
      setSimulationError('');
      approve(collateralToken, CONTRACT_ADDRESSES.fiatLoanBridge, parsedCollateralAmount);
    } catch (error: unknown) {
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

  const tokenOptions = TOKEN_LIST.map((token) => ({
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
                onChange={(e) => setCollateralToken(e.target.value as Address)}
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
                options={currencyOptions}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Fiat Amount (Auto-calculated)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                    <input
                      type="text"
                      value={isCalculating ? 'Calculating...' : fiatAmount}
                      readOnly
                      disabled
                      className="input-field w-full pl-9 bg-gray-800/50 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center gap-2 min-w-[60px]">
                    {isCalculating && <Loader2 className="w-4 h-4 text-green-400 animate-spin" />}
                    <span className="text-sm text-gray-400">{currency}</span>
                  </div>
                </div>
              </div>
              <div className="glass-card p-3 space-y-1 border-green-500/20">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Max LTV for {duration} days: <span className="text-green-400 font-medium">{ltvPercentage}%</span>
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Interest Rate (APY)</label>
              <div className="flex items-center h-[42px] px-4 bg-gray-800/50 border border-green-500/30 rounded-lg">
                <span className="text-lg font-semibold text-green-400">12%</span>
                <span className="ml-2 text-sm text-gray-400">Fixed APY</span>
              </div>
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
          <div className="glass-card p-4 space-y-2 border-green-500/20">
            <h4 className="font-semibold text-gray-300">Loan Summary</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Collateral</span>
              <div className="text-right">
                <div>{collateralAmount || '0'} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}</div>
                {collateralUSD > 0 && <div className="text-xs text-gray-500">≈ ${collateralUSD.toFixed(2)}</div>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You will receive</span>
              <span className="text-green-400 font-medium">${fiatAmount || '0'} {currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interest Rate (APY)</span>
              <span>{interestRate}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span>{duration} days</span>
            </div>
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
            disabled={!isFormValid}
          >
            {isCalculating ? 'Calculating...' : 'Continue'}
          </Button>
        </form>
      )}

      {step === 'approve' && (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 mx-auto glass-card rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Approve Token</h3>
            <p className="text-gray-400">
              You need to approve the FiatLoanBridge contract to use your{' '}
              {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} as collateral
            </p>
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
            <Button onClick={handleApprove} loading={isApproving} className="flex-1 bg-green-600 hover:bg-green-700">
              {isApproving ? 'Approving...' : 'Approve'}
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
              Create your fiat loan request for ${fiatAmount} {currency}
            </p>
          </div>
          <div className="glass-card p-4 space-y-2 text-left border-green-500/20">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Collateral</span>
              <div className="text-right">
                <div>{collateralAmount} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}</div>
                {collateralUSD > 0 && <div className="text-xs text-gray-500">≈ ${collateralUSD.toFixed(2)}</div>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fiat Amount</span>
              <span className="text-green-400 font-medium">${fiatAmount} {currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interest Rate</span>
              <span>{interestRate}% APY</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span>{duration} days</span>
            </div>
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
