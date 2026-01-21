'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Address, parseUnits, formatUnits } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { TOKEN_LIST, CONTRACT_ADDRESSES } from '@/config/contracts';
import {
  useApproveToken,
  useCreateLoanRequest,
  useTokenBalance,
  useTokenAllowance,
  useLTV,
  useTokenPrice,
  useMaxInterestRate,
  useLiquidationThreshold,
  useRefreshMockPrice
} from '@/hooks/useContracts';
import { formatTokenAmount, daysToSeconds, getTokenDecimals } from '@/lib/utils';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';
import { ArrowRight, AlertCircle, CheckCircle, Info, TrendingUp, Shield, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

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

export function CreateLoanRequestForm() {
  const { address, isConnected } = useAccount();

  const [collateralToken, setCollateralToken] = useState<Address>(TOKEN_LIST[0].address);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowToken, setBorrowToken] = useState<Address>(TOKEN_LIST[1].address);
  const [borrowAmount, setBorrowAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [duration, setDuration] = useState('30');
  const [step, setStep] = useState<'form' | 'approve' | 'confirm'>('form');
  const [simulationError, setSimulationError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);

  const collateralDecimals = getTokenDecimals(collateralToken);
  const borrowDecimals = getTokenDecimals(borrowToken);

  // Fetch token balances and prices
  const { data: collateralBalance } = useTokenBalance(collateralToken, address);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
    collateralToken,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  // Fetch token prices (with staleness info)
  const collateralPriceHook = useTokenPrice(collateralToken);
  const borrowPriceHook = useTokenPrice(borrowToken);

  const collateralPrice = collateralPriceHook.price;
  const borrowPrice = borrowPriceHook.price;

  // Check if any price data is stale
  const isPriceStale = collateralPriceHook.isStale || borrowPriceHook.isStale;
  const minSecondsUntilStale = Math.min(
    collateralPriceHook.secondsUntilStale || Infinity,
    borrowPriceHook.secondsUntilStale || Infinity
  );

  // Fetch LTV and configuration
  const durationDays = parseInt(duration);
  const { data: ltvBps, isLoading: isLoadingLTV, error: ltvError } = useLTV(collateralToken, durationDays);
  const { data: liquidationThresholdBps } = useLiquidationThreshold(collateralToken, durationDays);
  const { data: maxInterestRateBps } = useMaxInterestRate();

  const { approve, isPending: isApproving, isSuccess: approveSuccess } = useApproveToken();
  const { createRequest, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateLoanRequest();
  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  const parsedCollateralAmount = collateralAmount
    ? parseUnits(collateralAmount, collateralDecimals)
    : BigInt(0);

  const needsApproval = allowance !== undefined && parsedCollateralAmount > (allowance as bigint);

  // Track if we're calculating (waiting for prices and LTV)
  const isDataLoading = collateralPriceHook.isLoading || borrowPriceHook.isLoading || isLoadingLTV;

  // Calculate maximum borrow amount based on LTV
  useEffect(() => {
    // Reset borrow amount if no collateral amount
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) {
      setBorrowAmount('');
      setIsCalculating(false);
      setSimulationError('');
      return;
    }

    // Show loading if we're waiting for data
    if (isDataLoading) {
      setIsCalculating(true);
      return;
    }

    // Calculate if we have all required data
    if (collateralAmount && collateralPrice && borrowPrice && ltvBps) {
      setIsCalculating(true);
      setSimulationError('');

      try {
        const collateralAmountBigInt = parseUnits(collateralAmount, collateralDecimals);

        // Calculate collateral value in USD
        // collateralAmount (18 decimals) * price (8 decimals) / 10^18 = value in USD with 8 decimals
        const collateralValueUSD = (collateralAmountBigInt * (collateralPrice as bigint)) / BigInt(10 ** collateralDecimals);

        // Apply LTV (ltvBps is in basis points, 10000 = 100%)
        const maxLoanUSD = (collateralValueUSD * (ltvBps as bigint)) / BigInt(10000);

        // Convert to borrow token amount
        // maxLoanUSD (8 decimals) * 10^borrowDecimals / price (8 decimals) = borrow amount
        const maxBorrowAmount = (maxLoanUSD * BigInt(10 ** borrowDecimals)) / (borrowPrice as bigint);

        // Set the borrow amount (read-only)
        const maxBorrowFormatted = formatUnits(maxBorrowAmount, borrowDecimals);
        const finalAmount = parseFloat(maxBorrowFormatted).toFixed(6);

        setBorrowAmount(finalAmount);
      } catch (error) {
        console.error('Error calculating borrow amount:', error);
        setBorrowAmount('0');
        setSimulationError('Error calculating borrow amount');
      } finally {
        setIsCalculating(false);
      }
    } else {
      // Check if there's an LTV error (asset not enabled)
      if (ltvError && collateralAmount) {
        const errorMsg = (ltvError as Error & { shortMessage?: string })?.shortMessage || 'Asset not enabled in LTV configuration';
        setSimulationError(errorMsg);
        setBorrowAmount('');
      }

      setIsCalculating(false);
    }
  }, [collateralAmount, collateralPrice, borrowPrice, ltvBps, collateralDecimals, borrowDecimals, isDataLoading, ltvError, duration]);

  // Set default interest rate based on max interest rate from contract
  useEffect(() => {
    if (maxInterestRateBps && !interestRate) {
      // Default to 50% of max interest rate
      const defaultRate = Number(maxInterestRateBps) / 100 / 2;
      setInterestRate(defaultRate.toString());
    }
  }, [maxInterestRateBps, interestRate]);

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Token approved successfully!');
      refetchAllowance();
      setStep('confirm');
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (createSuccess) {
      toast.success('Loan request created successfully!');
      setCollateralAmount('');
      setBorrowAmount('');
      setStep('form');
    }
  }, [createSuccess]);

  useEffect(() => {
    if (createError) {
      toast.error('Failed to create loan request');
    }
  }, [createError]);

  // Handle refreshing stale price data on testnet
  const handleRefreshPrices = async () => {
    try {
      const refreshPromises: Promise<void>[] = [];

      // Refresh collateral token price if stale
      if (collateralPriceHook.isStale && collateralPriceHook.priceFeedAddress && collateralPrice) {
        const collateralPriceFeed = collateralPriceHook.priceFeedAddress as Address;
        refreshPromises.push(
          refreshPrice(collateralPriceFeed, collateralPrice)
            .then(() => {
              toast.success(`${TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} price refreshed!`);
              collateralPriceHook.refetch();
            })
        );
      }

      // Refresh borrow token price if stale
      if (borrowPriceHook.isStale && borrowPriceHook.priceFeedAddress && borrowPrice) {
        const borrowPriceFeed = borrowPriceHook.priceFeedAddress as Address;
        refreshPromises.push(
          refreshPrice(borrowPriceFeed, borrowPrice)
            .then(() => {
              toast.success(`${TOKEN_LIST.find((t) => t.address === borrowToken)?.symbol} price refreshed!`);
              borrowPriceHook.refetch();
            })
        );
      }

      if (refreshPromises.length === 0) {
        toast.error('No stale prices to refresh');
        return;
      }

      await Promise.all(refreshPromises);
    } catch (error) {
      console.error('Error refreshing prices:', error);
      toast.error('Failed to refresh prices. You may not have permission to update the oracle.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!collateralAmount || !borrowAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!interestRate || parseFloat(interestRate) <= 0) {
      toast.error('Please enter a valid interest rate');
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

      // Simulate approval first
      const simulation = await simulateContractWrite({
        address: collateralToken,
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
        args: [CONTRACT_ADDRESSES.loanMarketPlace, parsedCollateralAmount],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Simulation failed');
        toast.error(simulation.errorMessage || 'Transaction will fail. Please check your inputs.');
        return;
      }

      // Proceed with actual approval
      approve(collateralToken, CONTRACT_ADDRESSES.loanMarketPlace, parsedCollateralAmount);
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCreateRequest = async () => {
    try {
      setSimulationError('');

      const parsedBorrowAmount = parseUnits(borrowAmount, borrowDecimals);
      const interestRateBps = BigInt(Math.floor(parseFloat(interestRate) * 100));
      const durationSeconds = daysToSeconds(parseInt(duration));

      // Simulate the transaction first
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'createLoanRequest',
        args: [collateralToken, parsedCollateralAmount, borrowToken, parsedBorrowAmount, interestRateBps, durationSeconds],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Simulation failed');
        toast.error(simulation.errorMessage || 'Transaction will fail. Please check your inputs.');
        return;
      }

      // Proceed with actual transaction
      await createRequest(
        collateralToken,
        parsedCollateralAmount,
        borrowToken,
        parsedBorrowAmount,
        interestRateBps,
        durationSeconds
      );
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
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
  const maxInterestRatePercentage = maxInterestRateBps ? (Number(maxInterestRateBps) / 100).toFixed(2) : '100';

  // Calculate USD values
  const collateralUSD = collateralAmount && collateralPrice
    ? (parseFloat(collateralAmount) * Number(collateralPrice)) / 1e8 // Chainlink prices have 8 decimals
    : 0;

  const borrowUSD = borrowAmount && borrowPrice
    ? (parseFloat(borrowAmount) * Number(borrowPrice)) / 1e8
    : 0;

  // Calculate health factor: (collateralUSD * liquidationThreshold) / loanUSD
  // Health factor > 1 means healthy, < 1 means liquidatable
  const healthFactor = borrowUSD > 0 && liquidationThresholdBps
    ? (collateralUSD * Number(liquidationThresholdBps)) / (borrowUSD * 10000)
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

    // If user enters more than their balance, cap it at max balance
    if (numValue > maxCollateralBalanceNumber && maxCollateralBalanceNumber > 0) {
      setCollateralAmount(maxCollateralBalance);
      toast('Amount capped to your maximum balance', { icon: 'ℹ️' });
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
    borrowAmount &&
    parseFloat(borrowAmount) > 0 &&
    interestRate &&
    parseFloat(interestRate) > 0 &&
    !isCalculating &&
    !isPriceStale &&
    !hasZeroBalance &&
    !hasInsufficientBalance;

  if (!isConnected) {
    return (
      <Card className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-gray-400">Please connect your wallet to create a loan request</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-6">Create Loan Request</h2>

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
                    The selected collateral token is not enabled in the LTV configuration contract.
                    Please select a different token or contact the admin to enable this asset.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary-400">Collateral</h3>
              <Select
                label="Collateral Token"
                options={tokenOptions}
                value={collateralToken}
                onChange={(e) => setCollateralToken(e.target.value as Address)}
              />
              <div className="relative">
                <Input
                  label="Collateral Amount"
                  type="number"
                  step="any"
                  placeholder="0.0"
                  value={collateralAmount}
                  onChange={(e) => handleCollateralAmountChange(e.target.value)}
                  suffix={TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}
                />
                {maxCollateralBalanceNumber > 0 && (
                  <button
                    type="button"
                    onClick={handleSetMaxBalance}
                    className="absolute right-16 top-9 text-xs text-primary-400 hover:text-primary-300 font-medium"
                  >
                    MAX
                  </button>
                )}
              </div>
              <div className="flex justify-between text-sm">
                {collateralBalance !== undefined && collateralBalance !== null && (
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

              {/* Zero Balance Warning */}
              {hasZeroBalance && (
                <div className="glass-card p-3 border border-yellow-500/20 bg-yellow-500/5">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-400 font-medium">No {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} Balance</p>
                      <p className="text-gray-400 mt-1">
                        You need {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} tokens to use as collateral.{' '}
                        <a
                          href="/faucet"
                          className="text-primary-400 hover:text-primary-300 hover:underline font-medium"
                        >
                          Get test tokens from the faucet
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Insufficient Balance Warning */}
              {hasInsufficientBalance && !hasZeroBalance && (
                <div className="glass-card p-3 border border-red-500/20 bg-red-500/5">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-red-400 font-medium">Insufficient Balance</p>
                      <p className="text-gray-400 mt-1">
                        You only have {formatTokenAmount(collateralBalance as bigint, collateralDecimals)} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}.{' '}
                        <a
                          href="/faucet"
                          className="text-primary-400 hover:text-primary-300 hover:underline font-medium"
                        >
                          Get more tokens from the faucet
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-accent-400">Borrow</h3>
              <Select
                label="Borrow Token"
                options={tokenOptions}
                value={borrowToken}
                onChange={(e) => setBorrowToken(e.target.value as Address)}
              />
              <div>
                <div className="relative">
                  <Input
                    label="Borrow Amount (Auto-calculated)"
                    type="text"
                    value={isCalculating ? 'Calculating...' : borrowAmount}
                    readOnly
                    disabled
                    suffix={TOKEN_LIST.find((t) => t.address === borrowToken)?.symbol}
                    className="bg-gray-800/50 cursor-not-allowed"
                  />
                  <div className="absolute right-3 top-9">
                    {isCalculating ? (
                      <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                    ) : (
                      <Info className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
                {borrowUSD > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    ≈ ${borrowUSD.toFixed(2)} USD
                  </p>
                )}
              </div>
              <div className="glass-card p-3 space-y-1">
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Max LTV for {duration} days: <span className="text-primary-400 font-medium">{ltvPercentage}%</span>
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
              <Input
                label={`Interest Rate (APY %) - Max: ${maxInterestRatePercentage}%`}
                type="number"
                step="0.1"
                min="0"
                max={maxInterestRatePercentage}
                placeholder="10"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                suffix="%"
              />
              <p className="text-xs text-gray-400 mt-1">
                Lower rates are more attractive to lenders
              </p>
            </div>
            <Select
              label="Loan Duration"
              options={durationOptions}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          {/* Price Staleness Warning */}
          {isPriceStale && (
            <div className="glass-card p-4 border border-red-500/20 bg-red-500/5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm flex-1">
                  <p className="text-red-400 font-medium">Price Data is Stale</p>
                  <p className="text-gray-400">
                    The price feed data is outdated. Transactions will fail until prices are refreshed.
                    This is common on testnets where price feeds update less frequently.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleRefreshPrices}
                    loading={isRefreshingPrice}
                    icon={<RefreshCw className="w-4 h-4" />}
                    className="mt-2"
                  >
                    {isRefreshingPrice ? 'Refreshing...' : 'Refresh Price Feeds (Testnet)'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Price Freshness Indicator */}
          {!isPriceStale && minSecondsUntilStale < 300 && minSecondsUntilStale > 0 && (
            <div className="glass-card p-4 border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="text-yellow-400 font-medium">Price Data Expiring Soon</p>
                  <p className="text-gray-400">
                    Price data will become stale in {Math.floor(minSecondsUntilStale / 60)}:{(minSecondsUntilStale % 60).toString().padStart(2, '0')} minutes.
                    Complete your transaction soon.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="glass-card p-4 border border-blue-500/20">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <strong>How it works:</strong> Your collateral amount determines how much you can borrow based on the Loan-to-Value (LTV) ratio.
                </p>
                <p className="text-gray-400">
                  The borrow amount is automatically calculated to maximize your borrowing power while staying safe from liquidation.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 space-y-2">
            <h4 className="font-semibold text-gray-300">Loan Summary</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Collateral</span>
              <div className="text-right">
                <div>
                  {collateralAmount || '0'} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}
                </div>
                {collateralUSD > 0 && (
                  <div className="text-xs text-gray-500">
                    ≈ ${collateralUSD.toFixed(2)} USD
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You will receive</span>
              <div className="text-right">
                <div className="text-accent-400 font-medium">
                  {borrowAmount || '0'} {TOKEN_LIST.find((t) => t.address === borrowToken)?.symbol}
                </div>
                {borrowUSD > 0 && (
                  <div className="text-xs text-gray-500">
                    ≈ ${borrowUSD.toFixed(2)} USD
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interest Rate (APY)</span>
              <span>{interestRate || '0'}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Duration</span>
              <span>{duration} days</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-700 pt-2 mt-2">
              <span className="text-gray-400">Health Factor</span>
              <span className={`font-medium ${healthFactor >= 1.5 ? 'text-green-400' : healthFactor >= 1.2 ? 'text-yellow-400' : 'text-red-400'}`}>
                {healthFactor > 0 ? healthFactor.toFixed(2) : '--'}
              </span>
            </div>
            {healthFactor > 0 && healthFactor < 1.5 && (
              <div className="text-xs text-yellow-400 mt-2">
                ⚠️ Low health factor. Consider reducing borrow amount or adding more collateral.
              </div>
            )}
          </div>

          {simulationError && (
            <div className="glass-card p-4 border border-red-500/20 bg-red-500/5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Transaction Error</p>
                  <p className="text-sm text-gray-400 mt-1">{simulationError}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
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
              You need to approve the contract to use your{' '}
              {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} as collateral
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This is a one-time approval. We will simulate the transaction first to ensure it will succeed.
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
            <Button onClick={handleApprove} loading={isApproving} className="flex-1">
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
            <h3 className="text-xl font-semibold mb-2">Confirm Loan Request</h3>
            <p className="text-gray-400">
              Create your loan request for {borrowAmount}{' '}
              {TOKEN_LIST.find((t) => t.address === borrowToken)?.symbol}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              We will simulate the transaction first to ensure it will succeed.
            </p>
          </div>
          <div className="glass-card p-4 space-y-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Collateral</span>
              <div className="text-right">
                <div>{collateralAmount} {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol}</div>
                {collateralUSD > 0 && <div className="text-xs text-gray-500">≈ ${collateralUSD.toFixed(2)}</div>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Borrow</span>
              <div className="text-right">
                <div className="text-accent-400 font-medium">{borrowAmount} {TOKEN_LIST.find((t) => t.address === borrowToken)?.symbol}</div>
                {borrowUSD > 0 && <div className="text-xs text-gray-500">≈ ${borrowUSD.toFixed(2)}</div>}
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
            <div className="flex justify-between text-sm border-t border-gray-700 pt-2 mt-2">
              <span className="text-gray-400">Health Factor</span>
              <span className={`font-medium ${healthFactor >= 1.5 ? 'text-green-400' : healthFactor >= 1.2 ? 'text-yellow-400' : 'text-red-400'}`}>
                {healthFactor > 0 ? healthFactor.toFixed(2) : '--'}
              </span>
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
            <Button onClick={handleCreateRequest} loading={isCreating} className="flex-1">
              {isCreating ? 'Creating...' : 'Create Request'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
