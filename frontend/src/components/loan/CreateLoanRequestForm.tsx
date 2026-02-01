'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Address, parseUnits, formatUnits, decodeErrorResult } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { TOKEN_LIST, CONTRACT_ADDRESSES } from '@/config/contracts';
import {
  useApproveToken,
  useCreateLoanRequest,
  useTokenBalance,
  useTokenAllowance,
  useLTV,
  useTokenPrice,
  useLiquidationThreshold,
  useHealthFactor,
  useMaxInterestRate,
  useSupportedAssets,
  usePlatformFeeRate,
} from '@/hooks/useContracts';
import { PriceFeedDisplay } from '@/components/loan/PriceFeedDisplay';
import { formatTokenAmount, daysToSeconds, getTokenDecimals } from '@/lib/utils';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';
import { ArrowRight, AlertCircle, CheckCircle, Info, TrendingUp, Shield, Loader2 } from 'lucide-react';
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
  const publicClient = usePublicClient();

  const [collateralToken, setCollateralToken] = useState<Address>(TOKEN_LIST[0].address);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowToken, setBorrowToken] = useState<Address>(TOKEN_LIST[1].address);
  const [borrowAmount, setBorrowAmount] = useState('');
  const [interestRate, setInterestRate] = useState('12');
  const [duration, setDuration] = useState('30');
  const [step, setStep] = useState<'form' | 'approve' | 'confirm'>('form');
  const [simulationError, setSimulationError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);

  // Get max interest rate from configuration
  const { data: maxInterestRateData } = useMaxInterestRate();
  const maxInterestRate = maxInterestRateData ? Number(maxInterestRateData) / 100 : 50; // Default 50% if not loaded

  // Get platform fee rate
  const { feeRatePercent: platformFeePercent } = usePlatformFeeRate();

  // Get supported assets from Configuration contract
  const { supportedTokens, isLoading: isLoadingSupportedTokens } = useSupportedAssets();

  // Use supported tokens or fallback to TOKEN_LIST
  const availableTokens = supportedTokens.length > 0 ? supportedTokens : TOKEN_LIST;

  // Update token selection when supported tokens are loaded
  useEffect(() => {
    if (supportedTokens.length > 0) {
      // Check if current collateral token is supported
      const isCollateralSupported = supportedTokens.some(t => t.address.toLowerCase() === collateralToken.toLowerCase());
      const isBorrowSupported = supportedTokens.some(t => t.address.toLowerCase() === borrowToken.toLowerCase());

      if (!isCollateralSupported && supportedTokens[0]) {
        setCollateralToken(supportedTokens[0].address);
      }
      if (!isBorrowSupported && supportedTokens.length > 1 && supportedTokens[1]) {
        setBorrowToken(supportedTokens[1].address);
      } else if (!isBorrowSupported && supportedTokens[0]) {
        setBorrowToken(supportedTokens[0].address);
      }
    }
  }, [supportedTokens, collateralToken, borrowToken]);

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

  // Fetch LTV and configuration
  const durationDays = parseInt(duration);
  const { data: ltvBps, isLoading: isLoadingLTV, error: ltvError } = useLTV(collateralToken, durationDays);
  const { data: liquidationThresholdBps } = useLiquidationThreshold(collateralToken, durationDays);

  const { approveAsync, isPending: isApproving, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { createRequest, isPending: isCreating, isSuccess: createSuccess, error: createError } = useCreateLoanRequest();

  const parsedCollateralAmount = collateralAmount
    ? parseUnits(collateralAmount, collateralDecimals)
    : BigInt(0);

  const needsApproval = allowance !== undefined && parsedCollateralAmount > (allowance as bigint);

  // Track if we're calculating (waiting for prices and LTV)
  const isDataLoading = collateralPriceHook.isLoading || borrowPriceHook.isLoading || isLoadingLTV;

  // Compute loanAmountUSD for on-chain health factor query
  const parsedBorrowForHealth = borrowAmount ? (() => {
    try {
      const borrowAmountBigInt = parseUnits(borrowAmount, borrowDecimals);
      return borrowPrice ? (borrowAmountBigInt * (borrowPrice as bigint)) / BigInt(10 ** borrowDecimals) : undefined;
    } catch { return undefined; }
  })() : undefined;

  // On-chain health factor from LTVConfig contract
  const { data: onChainHealthFactor } = useHealthFactor(
    collateralToken,
    parsedCollateralAmount > BigInt(0) ? parsedCollateralAmount : undefined,
    collateralPrice as bigint | undefined,
    parsedBorrowForHealth,
    durationDays
  );

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


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!collateralAmount || !borrowAmount) {
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

      // Proceed with actual approval - await to catch wallet rejection
      await approveAsync(collateralToken, CONTRACT_ADDRESSES.loanMarketPlace, parsedCollateralAmount);
      // Transaction submitted - useEffect will handle success
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

      // Log simulation parameters for debugging
      console.log('=== Loan Request Simulation ===');
      console.log('Collateral Token:', collateralToken);
      console.log('Collateral Amount:', parsedCollateralAmount.toString());
      console.log('Borrow Token:', borrowToken);
      console.log('Borrow Amount:', parsedBorrowAmount.toString());
      console.log('Interest Rate (bps):', interestRateBps.toString());
      console.log('Duration (seconds):', durationSeconds.toString());
      console.log('Sender:', address);

      // Use publicClient.simulateContract for more detailed error messages
      if (publicClient) {
        try {
          await publicClient.simulateContract({
            address: CONTRACT_ADDRESSES.loanMarketPlace,
            abi: LoanMarketPlaceABI,
            functionName: 'createLoanRequest',
            args: [collateralToken, parsedCollateralAmount, borrowToken, parsedBorrowAmount, interestRateBps, durationSeconds],
            account: address,
          });
          console.log('Simulation successful!');
        } catch (simError: unknown) {
          console.error('=== Simulation Error Details ===');
          console.error('Full error:', simError);

          // Extract detailed error information
          const err = simError as {
            cause?: {
              data?: `0x${string}`;
              reason?: string;
              message?: string;
            };
            shortMessage?: string;
            message?: string;
            metaMessages?: string[];
          };

          console.error('Short message:', err.shortMessage);
          console.error('Message:', err.message);
          console.error('Cause:', err.cause);
          console.error('Meta messages:', err.metaMessages);

          // Try to decode the error data if available
          if (err.cause?.data) {
            console.error('Raw error data:', err.cause.data);
            try {
              const decoded = decodeErrorResult({
                abi: LoanMarketPlaceABI,
                data: err.cause.data,
              });
              console.error('Decoded error:', decoded);
              const errorMsg = `Contract Error: ${decoded.errorName}${decoded.args ? ` - Args: ${JSON.stringify(decoded.args)}` : ''}`;
              setSimulationError(errorMsg);
              toast.error(errorMsg);
              return;
            } catch {
              console.error('Could not decode error with LoanMarketPlace ABI');
            }
          }

          // Format the error message
          let errorMsg = err.shortMessage || err.message || 'Transaction simulation failed';

          // Check for common error patterns
          if (errorMsg.includes('reverted')) {
            // Try to extract the revert reason
            const reasonMatch = errorMsg.match(/reverted with reason string ['"](.+?)['"]/);
            if (reasonMatch) {
              errorMsg = reasonMatch[1];
            } else if (err.cause?.reason) {
              errorMsg = err.cause.reason;
            }
          }

          // Check metaMessages for more context
          if (err.metaMessages && err.metaMessages.length > 0) {
            const relevantMeta = err.metaMessages.find(m =>
              m.includes('revert') || m.includes('Error') || m.includes('require')
            );
            if (relevantMeta) {
              errorMsg = relevantMeta;
            }
          }

          setSimulationError(errorMsg);
          toast.error(errorMsg);
          return;
        }
      }

      // If simulation passed (or publicClient not available), proceed with transaction
      await createRequest(
        collateralToken,
        parsedCollateralAmount,
        borrowToken,
        parsedBorrowAmount,
        interestRateBps,
        durationSeconds
      );
    } catch (error: unknown) {
      console.error('=== Create Request Error ===');
      console.error('Full error:', error);
      const errorMsg = formatSimulationError(error);
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
  console.log('ltvPercentage', ltvPercentage, 'ltvBps', ltvBps);
  console.log('liquidationPercentage', liquidationPercentage)

  // Calculate USD values
  const collateralUSD = collateralAmount && collateralPrice
    ? (parseFloat(collateralAmount) * Number(collateralPrice)) / 1e8 // Chainlink prices have 8 decimals
    : 0;

  const borrowUSD = borrowAmount && borrowPrice
    ? (parseFloat(borrowAmount) * Number(borrowPrice)) / 1e8
    : 0;

  // Health factor from blockchain (1e18 = 100% / 1.0)
  // Convert from 1e18 scale to decimal: healthFactor / 1e18
  const healthFactor = onChainHealthFactor
    ? Number(onChainHealthFactor as bigint) / 1e18
    : borrowUSD > 0 && liquidationThresholdBps
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
          {/* Loading Supported Tokens */}
          {isLoadingSupportedTokens && (
            <div className="glass-card p-4 border border-blue-500/20 bg-blue-500/5">
              <div className="flex gap-3 items-center">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <p className="text-sm text-blue-400">Loading supported tokens from contract...</p>
              </div>
            </div>
          )}

          {/* No Supported Tokens Warning */}
          {!isLoadingSupportedTokens && supportedTokens.length === 0 && (
            <div className="glass-card p-4 border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">No Supported Tokens Found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    No tokens are currently supported by the contract. Showing all available tokens as fallback.
                    Contact the admin to enable asset support.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Supported Tokens Info */}
          {!isLoadingSupportedTokens && supportedTokens.length > 0 && (
            <div className="glass-card p-3 border border-green-500/20 bg-green-500/5">
              <div className="flex gap-2 items-center">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-xs text-green-400">
                  {supportedTokens.length} supported token{supportedTokens.length > 1 ? 's' : ''}: {supportedTokens.map(t => t.symbol).join(', ')}
                </p>
              </div>
            </div>
          )}

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
                      className="px-3 py-2 text-xs font-semibold text-primary-400 hover:text-primary-300 bg-primary-400/10 hover:bg-primary-400/20 rounded-lg transition-colors"
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Borrow Amount (Auto-calculated)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={isCalculating ? 'Calculating...' : borrowAmount}
                      readOnly
                      disabled
                      className="input-field w-full bg-gray-800/50 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center gap-2 min-w-[60px]">
                    {isCalculating ? (
                      <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                    ) : null}
                    <span className="text-sm text-gray-400">
                      {TOKEN_LIST.find((t) => t.address === borrowToken)?.symbol}
                    </span>
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

          {/* Price Feeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PriceFeedDisplay tokenAddress={collateralToken} variant="compact" />
            <PriceFeedDisplay tokenAddress={borrowToken} variant="compact" />
          </div>

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
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-gray-300">{platformFeePercent}%</span>
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
            <h3 className="text-xl font-semibold mb-2">Token Approval Required</h3>
            <p className="text-gray-400">
              Before you can create this loan request, you need to approve the contract to transfer your{' '}
              {TOKEN_LIST.find((t) => t.address === collateralToken)?.symbol} tokens.
            </p>
          </div>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-left">
            <p className="text-sm text-gray-300 mb-2">
              <span className="text-yellow-400 font-medium">Why is this needed?</span>
            </p>
            <p className="text-xs text-gray-400">
              ERC-20 tokens require a two-step process: first you approve the contract to access your tokens, then you can create the loan request. This is a standard security feature that protects your assets by ensuring you explicitly authorize each contract interaction.
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
            <Button onClick={handleApprove} loading={isApproving || isApprovalConfirming} className="flex-1">
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
