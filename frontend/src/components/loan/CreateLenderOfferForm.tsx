'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Address, parseUnits, formatUnits } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { TOKEN_LIST, CONTRACT_ADDRESSES } from '@/config/contracts';
import { useApproveToken, useCreateLenderOffer, useTokenBalance, useTokenAllowance, useTokenPrice, useLTV, useMaxInterestRate, useSupportedAssets, usePlatformFeeRate } from '@/hooks/useContracts';
import { PriceFeedDisplay } from '@/components/loan/PriceFeedDisplay';
import { formatTokenAmount, daysToSeconds, getTokenDecimals } from '@/lib/utils';
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

const durationOptions = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
];

export function CreateLenderOfferForm() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [lendToken, setLendToken] = useState<Address>(TOKEN_LIST[1].address);
  const [lendAmount, setLendAmount] = useState('');
  const [collateralToken, setCollateralToken] = useState<Address>(TOKEN_LIST[0].address);
  const [interestRate, setInterestRate] = useState('12');
  const [duration, setDuration] = useState('30');
  const [step, setStep] = useState<'form' | 'approve' | 'confirm'>('form');
  const [simulationError, setSimulationError] = useState<string>('');

  // Get max interest rate from configuration
  const { data: maxInterestRateData } = useMaxInterestRate();
  const maxInterestRate = maxInterestRateData ? Number(maxInterestRateData) / 100 : 50; // Default 50% if not loaded

  // Get platform fee rate
  const { feeRatePercent: platformFeePercent } = usePlatformFeeRate();

  // Get supported assets from Configuration contract
  const { supportedTokens } = useSupportedAssets();
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  const lendDecimals = getTokenDecimals(lendToken);
  const collateralDecimals = getTokenDecimals(collateralToken);

  // Get LTV from contract based on collateral token and duration
  const durationDays = parseInt(duration) || 30;
  const { data: ltvBpsRaw, isLoading: isLtvLoading } = useLTV(collateralToken, durationDays);
  const ltvBps = ltvBpsRaw as bigint | undefined;

  // LTV is in basis points (e.g., 7500 = 75%)
  // To get required collateral: collateral = loan_value / (LTV / 10000)
  // Example: If LTV is 75%, borrower can borrow 75% of collateral value
  // So for $100 loan, need $100 / 0.75 = $133.33 collateral
  const ltvPercentage = ltvBps ? Number(ltvBps) / 100 : 0; // Convert bps to percentage
  const ltvDecimal = ltvBps ? Number(ltvBps) / 10000 : 0; // Convert bps to decimal

  const { data: lendBalance } = useTokenBalance(lendToken, address);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
    lendToken,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  const { approve, isPending: isApproving, isSuccess: approveSuccess } = useApproveToken();
  const { createOffer, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateLenderOffer();

  const parsedLendAmount = lendAmount
    ? parseUnits(lendAmount, lendDecimals)
    : BigInt(0);

  const needsApproval = allowance !== undefined && parsedLendAmount > (allowance as bigint);

  // Balance calculations
  const maxLendBalance = lendBalance
    ? formatUnits(lendBalance as bigint, lendDecimals)
    : '0';
  const maxLendBalanceNumber = parseFloat(maxLendBalance);

  // Check balance status
  const hasZeroBalance = maxLendBalanceNumber === 0;
  const hasEnoughBalance = lendBalance !== undefined && lendBalance !== null && parsedLendAmount > 0
    ? BigInt(lendBalance as bigint) >= parsedLendAmount
    : true;
  const hasInsufficientBalance = parsedLendAmount > 0 && !hasEnoughBalance;

  // Check if form is valid (will be recalculated after price hooks)
  // const isFormValid = lendAmount && minCollateralAmount && hasEnoughBalance && !hasZeroBalance;

  // Check if buttons should be disabled (will be updated after price calculation)
  // Moved after price calculations

  // Get USD prices for both tokens
  const { price: lendPrice, isStale: isLendPriceStale } = useTokenPrice(lendToken);
  const { price: collateralPrice, isStale: isCollateralPriceStale } = useTokenPrice(collateralToken);
  const isPriceStale = isLendPriceStale || isCollateralPriceStale;

  // Calculate USD value of lend amount
  const lendUSD = lendAmount && lendPrice
    ? parseFloat(lendAmount) * Number(lendPrice) / 1e8
    : 0;

  // Calculate total repayment with flat interest
  // Formula: principal + (principal × interest_rate / 100)
  // Note: Interest rate is flat, not annualized. Same rate regardless of duration.
  const interestDecimal = (parseFloat(interestRate) || 0) / 100;
  const interestAmount = lendUSD * interestDecimal;
  const totalRepaymentUSD = lendUSD + interestAmount;

  // Calculate required collateral in collateral token using LTV from contract
  // If LTV is 75%, borrower can borrow up to 75% of collateral value
  // So required collateral = total_repayment / LTV_decimal
  // Example: $100 loan with 75% LTV needs $100 / 0.75 = $133.33 collateral
  const collateralPricePerToken = collateralPrice ? Number(collateralPrice) / 1e8 : 0;
  const calculatedCollateralAmount = collateralPricePerToken > 0 && totalRepaymentUSD > 0 && ltvDecimal > 0
    ? (totalRepaymentUSD / ltvDecimal) / collateralPricePerToken
    : 0;

  // Format for display and contract usage
  const minCollateralAmount = calculatedCollateralAmount > 0
    ? calculatedCollateralAmount.toFixed(6)
    : '';

  // Calculate USD value of collateral
  const collateralUSD = calculatedCollateralAmount * collateralPricePerToken;

  // Check if submit button should be disabled
  const isSubmitDisabled =
    !lendAmount ||
    !minCollateralAmount ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    isLtvLoading ||
    !ltvBps ||
    calculatedCollateralAmount <= 0;

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Token approved successfully!');
      refetchAllowance();
      setStep('confirm');
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (createSuccess) {
      toast.success('Lender offer created successfully! It is now visible in the marketplace.');
      router.push('/marketplace?tab=offers');
    }
  }, [createSuccess, router]);

  useEffect(() => {
    if (createError) {
      toast.error('Failed to create lender offer');
    }
  }, [createError]);

  // Limit input to max balance
  const handleLendAmountChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > maxLendBalanceNumber && maxLendBalanceNumber > 0) {
      setLendAmount(maxLendBalance);
    } else {
      setLendAmount(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!lendAmount) {
      toast.error('Please enter a lend amount');
      return;
    }

    if (!minCollateralAmount || calculatedCollateralAmount <= 0) {
      toast.error('Unable to calculate collateral. Please check prices are available.');
      return;
    }

    if (isPriceStale) {
      toast.error('Price data is stale. Please wait for updated prices.');
      return;
    }

    if (hasZeroBalance) {
      toast.error('You have no tokens to lend');
      return;
    }

    if (!hasEnoughBalance) {
      toast.error('Insufficient balance');
      return;
    }

    setSimulationError('');

    if (needsApproval) {
      setStep('approve');
      return;
    }

    setStep('confirm');
  };

  const handleApprove = async () => {
    setSimulationError('');

    try {
      // Simulate approval first
      const simulation = await simulateContractWrite({
        address: lendToken,
        abi: [
          {
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          }
        ],
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.loanMarketPlace, parsedLendAmount],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Simulation failed');
        toast.error(simulation.errorMessage || 'Transaction will fail');
        return;
      }

      approve(lendToken, CONTRACT_ADDRESSES.loanMarketPlace, parsedLendAmount);
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCreateOffer = async () => {
    setSimulationError('');

    const parsedCollateralAmount = parseUnits(minCollateralAmount, collateralDecimals);
    const interestRateBps = BigInt(Math.floor(parseFloat(interestRate) * 100));
    const durationSeconds = daysToSeconds(parseInt(duration));

    try {
      // Simulate first
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'createLenderOffer',
        args: [
          lendToken,
          parsedLendAmount,
          collateralToken,
          parsedCollateralAmount,
          interestRateBps,
          durationSeconds
        ],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Transaction would fail');
        toast.error(simulation.errorMessage || 'Transaction would fail');
        return;
      }

      createOffer(
        lendToken,
        parsedLendAmount,
        collateralToken,
        parsedCollateralAmount,
        interestRateBps,
        durationSeconds
      );
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const tokenOptions = availableTokens.map((token) => ({
    value: token.address,
    label: token.symbol,
  }));

  if (!isConnected) {
    return (
      <Card className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-gray-400">Please connect your wallet to create a lender offer</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-6">Create Lender Offer</h2>

      {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-accent-400">You Lend</h3>
              <Select
                label="Lend Token"
                options={tokenOptions}
                value={lendToken}
                onChange={(e) => setLendToken(e.target.value as Address)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Lend Amount</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.0"
                      value={lendAmount}
                      onChange={(e) => handleLendAmountChange(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                  {maxLendBalanceNumber > 0 && (
                    <button
                      type="button"
                      onClick={() => setLendAmount(maxLendBalance)}
                      className="px-3 py-2 text-xs font-semibold text-primary-400 hover:text-primary-300 bg-primary-400/10 hover:bg-primary-400/20 rounded-lg transition-colors"
                    >
                      MAX
                    </button>
                  )}
                  <span className="text-sm text-gray-400 min-w-[40px]">
                    {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
                  </span>
                </div>
                {lendUSD > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    ≈ ${lendUSD.toFixed(2)} USD
                  </p>
                )}
              </div>
              {lendBalance !== undefined && lendBalance !== null && (
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Balance: {formatTokenAmount(lendBalance as bigint, lendDecimals)}{' '}
                      {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
                    </span>
                  </div>

                  {/* Zero Balance Warning */}
                  {hasZeroBalance && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-yellow-400 font-medium">No {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol} Balance</p>
                          <p className="text-gray-400 mt-1">
                            You need tokens to create an offer.{' '}
                            <Link
                              href="/faucet"
                              className="text-primary-400 hover:text-primary-300 hover:underline font-medium"
                            >
                              Get test tokens from the faucet
                            </Link>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Insufficient Balance Warning */}
                  {hasInsufficientBalance && !hasZeroBalance && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-400 font-medium">Insufficient Balance</p>
                          <p className="text-gray-400 mt-1">
                            Maximum available: {formatTokenAmount(lendBalance as bigint, lendDecimals)}.{' '}
                            <Link
                              href="/faucet"
                              className="text-primary-400 hover:text-primary-300 hover:underline font-medium"
                            >
                              Get more tokens from the faucet
                            </Link>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary-400">Required Collateral</h3>
              <Select
                label="Collateral Token"
                options={tokenOptions}
                value={collateralToken}
                onChange={(e) => setCollateralToken(e.target.value as Address)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Min Collateral (Auto-calculated)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Enter lend amount first"
                      value={minCollateralAmount}
                      readOnly
                      disabled
                      className="input-field w-full bg-white/5 cursor-not-allowed"
                    />
                  </div>
                  <span className="text-sm text-gray-400 min-w-[40px]">
                    {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}
                  </span>
                </div>
                {collateralUSD > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    ≈ ${collateralUSD.toFixed(2)} USD
                  </p>
                )}
              </div>

              {/* LTV Loading State */}
              {isLtvLoading && (
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-sm">Loading LTV configuration...</p>
                </div>
              )}

              {/* LTV Not Available Warning */}
              {!isLtvLoading && !ltvBps && lendAmount && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-medium text-sm">LTV Not Configured</p>
                      <p className="text-gray-400 text-xs mt-1">
                        LTV is not configured for this collateral token and duration combination.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Calculation Breakdown */}
              {lendAmount && lendUSD > 0 && ltvBps && (
                <div className="p-3 bg-white/5 rounded-lg space-y-2 text-sm">
                  <p className="text-gray-400 font-medium">Collateral Calculation:</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Principal</span>
                      <span className="text-gray-300">${lendUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">+ Interest ({interestRate}% APY × {durationDays} days)</span>
                      <span className="text-gray-300">${interestAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1">
                      <span className="text-gray-500">Total Repayment</span>
                      <span className="text-gray-300">${totalRepaymentUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">÷ LTV ({ltvPercentage.toFixed(1)}%)</span>
                      <span className="text-gray-300">${(totalRepaymentUSD / ltvDecimal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1 font-medium">
                      <span className="text-primary-400">Required Collateral</span>
                      <span className="text-primary-400">
                        {calculatedCollateralAmount.toFixed(4)} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Feeds */}
              <PriceFeedDisplay tokenAddress={collateralToken} variant="compact" />

              {/* LTV Display */}
              {ltvPercentage > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                  <span className="text-xs text-gray-400">LTV Ratio</span>
                  <span className={`text-sm font-medium ${ltvPercentage > 80 ? 'text-red-400' : ltvPercentage > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {ltvPercentage.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Price Feeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PriceFeedDisplay tokenAddress={lendToken} variant="compact" />
            <PriceFeedDisplay tokenAddress={collateralToken} variant="compact" />
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
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">0%</span>
                  <span className="text-lg font-semibold text-primary-400">{interestRate}%</span>
                  <span className="text-xs text-gray-400">{maxInterestRate}% max</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                This is the total interest borrower will pay, not annual. The same rate applies regardless of duration.
              </p>
            </div>
            <Select
              label="Loan Duration"
              options={durationOptions}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div className="glass-card p-4 space-y-2">
            <h4 className="font-semibold text-gray-300">Summary</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You Lend</span>
              <div className="text-right">
                <span>
                  {lendAmount || '0'} {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
                </span>
                {lendUSD > 0 && <div className="text-xs text-gray-500">≈ ${lendUSD.toFixed(2)}</div>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interest Rate</span>
              <span>{interestRate}% APY</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span>{duration} days</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-gray-300">{platformFeePercent}%</span>
            </div>
            {interestAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Interest Earned</span>
                <span className="text-green-400">+${interestAmount.toFixed(2)}</span>
              </div>
            )}
            {totalRepaymentUSD > 0 && (
              <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                <span className="text-gray-400">Total Repayment</span>
                <span className="font-medium">${totalRepaymentUSD.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-white/10 pt-2">
              <span className="text-gray-400">Min Collateral Required</span>
              <div className="text-right">
                <span>
                  {minCollateralAmount || '0'} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}
                </span>
                {collateralUSD > 0 && <div className="text-xs text-gray-500">≈ ${collateralUSD.toFixed(2)}</div>}
              </div>
            </div>
            {ltvPercentage > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">LTV Ratio</span>
                <span className={`font-medium ${ltvPercentage > 80 ? 'text-red-400' : ltvPercentage > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {ltvPercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            icon={<ArrowRight className="w-5 h-5" />}
            disabled={isSubmitDisabled}
          >
            Continue
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
              You need to approve the contract to spend your{' '}
              {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
            </p>
          </div>

          {/* Simulation Error */}
          {simulationError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Transaction Error</p>
                  <p className="text-gray-400 mt-1">{simulationError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setStep('form')} className="flex-1">
              Back
            </Button>
            <Button onClick={handleApprove} loading={isApproving} className="flex-1">
              Approve
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
            <h3 className="text-xl font-semibold mb-2">Confirm Transaction</h3>
            <p className="text-gray-400">
              Create your lender offer for {lendAmount}{' '}
              {TOKEN_LIST.find((t) => t.address === lendToken)?.symbol}
            </p>
          </div>

          {/* Simulation Error */}
          {simulationError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Transaction Error</p>
                  <p className="text-gray-400 mt-1">{simulationError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => setStep('form')} className="flex-1">
              Back
            </Button>
            <Button onClick={handleCreateOffer} loading={isCreating} className="flex-1">
              Create Offer
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
