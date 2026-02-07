'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, Address } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RequestStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  useLoanRequest,
  useFundLoanRequest,
  useTokenPrice,
  useLTV,
  useRefreshMockPrice,
} from '@/hooks/useContracts';
import { LoanRequestStatus } from '@/types';
import {
  formatTokenAmount,
  formatPercentage,
  formatDuration,
  formatAddress,
  formatTimeUntil,
  getTokenSymbol,
  getTokenDecimals,
} from '@/lib/utils';
import {
  ArrowLeft,
  Shield,
  TrendingUp,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  DollarSign,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DEFAULT_CHAIN } from '@/config/contracts';
import { useApproveToken, useTokenBalance, useTokenAllowance } from '@/hooks/useContracts';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id ? BigInt(params.id as string) : undefined;
  const { address, isConnected } = useAccount();

  const [showFundModal, setShowFundModal] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingStep, setFundingStep] = useState<'approve' | 'fund'>('approve');
  const [simulationError, setSimulationError] = useState<string>('');

  // Fetch loan request data
  const { data: requestData, isLoading: requestLoading, refetch } = useLoanRequest(requestId);

  // Parse request data from contract (it returns a tuple)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestTuple = requestData as readonly unknown[];
  const request = requestData ? {
    requestId: requestTuple[0] as bigint,
    borrower: requestTuple[1] as `0x${string}`,
    collateralAmount: requestTuple[2] as bigint,
    collateralToken: requestTuple[3] as `0x${string}`,
    borrowAsset: requestTuple[4] as `0x${string}`,
    borrowAmount: requestTuple[5] as bigint,
    duration: requestTuple[6] as bigint,
    maxInterestRate: requestTuple[7] as bigint,
    interestRate: requestTuple[8] as bigint,
    createdAt: requestTuple[9] as bigint,
    expireAt: requestTuple[10] as bigint,
    status: requestTuple[11] as LoanRequestStatus,
  } : null;

  // Token info
  const collateralSymbol = request ? getTokenSymbol(request.collateralToken) : '';
  const borrowSymbol = request ? getTokenSymbol(request.borrowAsset) : '';
  const collateralDecimals = request ? Number(getTokenDecimals(request.collateralToken)) : 18;
  const borrowDecimals = request ? Number(getTokenDecimals(request.borrowAsset)) : 18;

  // Check if user is the borrower (owner of the request)
  const isBorrower = request && address?.toLowerCase() === request.borrower.toLowerCase();

  // Get lender's balance and allowance for funding
  const { data: lenderBalance } = useTokenBalance(request?.borrowAsset, address);
  const { data: lenderAllowance, refetch: refetchAllowance } = useTokenAllowance(
    request?.borrowAsset,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  // Price data for USD values
  const collateralPriceHook = useTokenPrice(request?.collateralToken);
  const borrowPriceHook = useTokenPrice(request?.borrowAsset);
  const collateralPrice = collateralPriceHook.price;
  const borrowPrice = borrowPriceHook.price;

  // Check price staleness
  const isPriceStale = collateralPriceHook.isStale || borrowPriceHook.isStale;

  // Price refresh hook
  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  // Handle price refresh
  const handleRefreshPrices = async () => {
    try {
      if (collateralPriceHook.isStale && collateralPriceHook.priceFeedAddress && collateralPrice) {
        await refreshPrice(collateralPriceHook.priceFeedAddress as Address, BigInt(collateralPrice), request?.collateralToken);
      }
      if (borrowPriceHook.isStale && borrowPriceHook.priceFeedAddress && borrowPrice) {
        await refreshPrice(borrowPriceHook.priceFeedAddress as Address, BigInt(borrowPrice), request?.borrowAsset);
      }
      toast.success('Price feeds refreshed!');
      collateralPriceHook.refetch();
      borrowPriceHook.refetch();
    } catch (error) {
      console.error('Failed to refresh prices:', error);
      toast.error('Failed to refresh price feeds');
    }
  };

  // Calculate USD values
  const collateralUSD = request && collateralPrice
    ? (Number(request.collateralAmount) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;
  const borrowUSD = request && borrowPrice
    ? (Number(request.borrowAmount) / Math.pow(10, Number(borrowDecimals))) * Number(borrowPrice) / 1e8
    : 0;

  // Get LTV from contract (duration is in seconds, convert to days)
  const durationDays = request ? Math.ceil(Number(request.duration) / (24 * 60 * 60)) : 0;
  const { data: ltvBps } = useLTV(request?.collateralToken, durationDays);

  // LTV from contract is in basis points (10000 = 100%)
  const currentLTV = ltvBps ? Number(ltvBps) / 100 : 0;

  // Balance calculations
  const maxLenderBalance = lenderBalance
    ? formatUnits(lenderBalance as bigint, borrowDecimals)
    : '0';
  const maxLenderBalanceNumber = parseFloat(maxLenderBalance);

  // Check balance status
  const hasZeroBalance = maxLenderBalanceNumber === 0;
  const hasInsufficientBalance = request && lenderBalance
    ? (lenderBalance as bigint) < request.borrowAmount
    : false;

  // Check if already approved (must have valid borrow amount > 0)
  const hasApproval = lenderAllowance && request && request.borrowAmount > BigInt(0)
    ? (lenderAllowance as bigint) >= request.borrowAmount
    : false;

  // Write hooks
  const { approveAsync, isPending: approveIsPending, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { fundRequestAsync, isPending: fundIsPending, isSuccess: fundSuccess, error: fundError } = useFundLoanRequest();

  // Handle approval success
  useEffect(() => {
    if (approveSuccess) {
      toast.success('Approval successful!');
      refetchAllowance();
      setFundingStep('fund');
    }
  }, [approveSuccess, refetchAllowance]);

  // Handle funding success
  useEffect(() => {
    if (fundSuccess) {
      toast.success('Loan funded successfully! The loan is now active.');
      setShowFundModal(false);
      setIsFunding(false);
      refetch();
      router.push('/dashboard');
    }
  }, [fundSuccess, router, refetch]);

  // Handle funding error
  useEffect(() => {
    if (fundError) {
      console.error('Fund error:', fundError);
      const errorMessage = fundError.message || 'Failed to fund loan request';
      setSimulationError(errorMessage);
      toast.error(errorMessage);
      setIsFunding(false);
    }
  }, [fundError]);

  // Handler to open fund modal with validation
  const openFundModal = () => {
    if (!request) {
      toast.error('Loan request data not available. Please refresh the page.');
      return;
    }
    if (requestId === undefined) {
      toast.error('Invalid loan request ID.');
      return;
    }
    console.log('Opening fund modal with data:', {
      requestId: requestId.toString(),
      borrower: request.borrower,
      borrowAmount: request.borrowAmount.toString(),
      borrowAsset: request.borrowAsset,
    });
    setShowFundModal(true);
  };

  // Reset step when opening modal
  useEffect(() => {
    if (showFundModal) {
      console.log('Fund modal opened - checking approval status:', {
        hasApproval,
        lenderAllowance: lenderAllowance ? lenderAllowance.toString() : 'undefined',
        borrowAmount: request?.borrowAmount ? request.borrowAmount.toString() : 'undefined',
        lenderBalance: lenderBalance ? lenderBalance.toString() : 'undefined',
        hasZeroBalance,
        hasInsufficientBalance,
        isPriceStale,
        fundingStep: hasApproval ? 'fund' : 'approve',
      });
      setFundingStep(hasApproval ? 'fund' : 'approve');
      setSimulationError('');
    }
  }, [showFundModal, hasApproval, lenderAllowance, request?.borrowAmount, lenderBalance, hasZeroBalance, hasInsufficientBalance, isPriceStale]);

  const handleApprove = async () => {
    console.log('handleApprove called', { request, address });

    if (!request) {
      console.error('handleApprove: Missing request');
      toast.error('Unable to approve: Missing loan request data');
      return;
    }

    if (!address) {
      console.error('handleApprove: No wallet connected');
      toast.error('Please connect your wallet first');
      return;
    }

    setSimulationError('');

    try {
      console.log('Simulating approve...', {
        token: request.borrowAsset,
        spender: CONTRACT_ADDRESSES.loanMarketPlace,
        amount: request.borrowAmount.toString()
      });

      // Simulate approval first with explicit account
      const simulation = await simulateContractWrite({
        address: request.borrowAsset,
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
        args: [CONTRACT_ADDRESSES.loanMarketPlace, request.borrowAmount],
        account: address,
      });

      console.log('Approval simulation result:', simulation);

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Simulation failed';
        console.error('Approval simulation failed:', errorMsg);
        setSimulationError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      console.log('Calling approveAsync...');
      await approveAsync(request.borrowAsset, CONTRACT_ADDRESSES.loanMarketPlace, request.borrowAmount);
      console.log('approveAsync completed, waiting for confirmation...');
      // Transaction submitted - useEffect will handle success
    } catch (error: unknown) {
      console.error('handleApprove error:', error);
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleFund = async () => {
    console.log('handleFund called', { request, requestId: requestId?.toString(), address });

    if (!request || requestId === undefined) {
      console.error('handleFund: Missing request or requestId', { request, requestId: requestId?.toString() });
      toast.error('Unable to fund: Missing loan request data');
      return;
    }

    if (!address) {
      console.error('handleFund: No wallet connected');
      toast.error('Please connect your wallet first');
      return;
    }

    setIsFunding(true);
    setSimulationError('');

    try {
      console.log('Simulating fundLoanRequest...', { requestId: requestId.toString() });

      // Simulate first with explicit account
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'fundLoanRequest',
        args: [requestId],
        account: address,
      });

      console.log('Simulation result:', simulation);

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Transaction would fail';
        console.error('Simulation failed:', errorMsg);
        setSimulationError(errorMsg);
        toast.error(errorMsg);
        setIsFunding(false);
        return;
      }

      console.log('Calling fundRequestAsync...');
      // Use async version and await it
      await fundRequestAsync(requestId);
      console.log('fundRequestAsync completed, waiting for confirmation...');
      // Success will be handled by the useEffect watching fundSuccess
    } catch (error: unknown) {
      console.error('handleFund error:', error);
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
      setIsFunding(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied!');
  };

  // Check if the main "Fund This Request" button (that opens modal) should be disabled
  const isOpenModalDisabled =
    !request ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    isFunding ||
    fundIsPending ||
    approveIsPending ||
    isApprovalConfirming;

  // Check if approve button in modal should be disabled
  const isApproveDisabled =
    !request ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    approveIsPending ||
    isApprovalConfirming;

  // Check if fund button in modal should be disabled (separate from approve)
  const isFundDisabled =
    !request ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    isFunding ||
    fundIsPending;

  if (requestLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Status 0 from an unfilled/invalid slot will have empty borrower or zero borrow amount
  if (!request || !request.borrower || request.borrower === '0x0000000000000000000000000000000000000000' || request.borrowAmount === BigInt(0)) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Request Not Found</h2>
          <p className="text-gray-400 mb-6">
            This loan request doesn&apos;t exist or has been removed.
          </p>
          <Link href="/marketplace">
            <Button>Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isExpired = Number(request.expireAt) * 1000 < Date.now();
  const canFund = request.status === LoanRequestStatus.PENDING && !isBorrower && !isExpired && isConnected;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Back Button */}
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Loan Request #{request.requestId.toString()}</h1>
              <RequestStatusBadge status={request.status} />
            </div>
            <p className="text-gray-400">
              {isBorrower ? 'Your loan request for' : 'Borrower requesting'}{' '}
              <span className="text-white font-medium">
                {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol}
              </span>
            </p>
          </div>

          {canFund && (
            <Button
              onClick={openFundModal}
              icon={<DollarSign className="w-4 h-4" />}
              size="lg"
              disabled={isOpenModalDisabled}
            >
              Fund This Request
            </Button>
          )}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Request Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <h2 className="text-xl font-bold mb-6">Request Details</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Borrow Amount</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol}
                      </p>
                      {borrowUSD > 0 && (
                        <p className="text-sm text-gray-500">~${borrowUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Interest Rate</p>
                      <p className="text-lg font-semibold text-green-400">
                        {formatPercentage(request.interestRate)} APY
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Duration</p>
                      <p className="text-lg font-semibold">
                        {formatDuration(request.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Collateral Offered</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(request.collateralAmount, collateralDecimals)} {collateralSymbol}
                      </p>
                      {collateralUSD > 0 && (
                        <p className="text-sm text-gray-500">~${collateralUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Current LTV</p>
                      <p className={`text-lg font-semibold ${currentLTV > 80 ? 'text-red-400' : currentLTV > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {currentLTV.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Max Interest Rate</p>
                      <p className="text-lg font-semibold text-gray-300">
                        {formatPercentage(request.maxInterestRate)} APY
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Borrower Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <h2 className="text-xl font-bold mb-6">Borrower</h2>
                <div className="flex items-center justify-between p-4 glass-card rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Wallet Address</p>
                      <p className="font-mono">{formatAddress(request.borrower, 6)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isBorrower && <Badge variant="info" size="sm">You</Badge>}
                    <button onClick={() => copyAddress(request.borrower)} className="p-2 hover:bg-white/10 rounded-lg">
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={`${DEFAULT_CHAIN.blockExplorer}/address/${request.borrower}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-white/10 rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Investment Opportunity (for lenders) */}
            {!isBorrower && request.status === LoanRequestStatus.PENDING && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border border-primary-500/30 bg-primary-500/5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-primary-400" />
                    <h3 className="font-semibold">Investment Opportunity</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">You Provide</span>
                      <span className="font-medium">
                        {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Interest Rate</span>
                      <span className="font-medium text-green-400">
                        {formatPercentage(request.interestRate)} APY
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Collateral Securing Loan</span>
                      <span className="font-medium">
                        {formatTokenAmount(request.collateralAmount, collateralDecimals)} {collateralSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">Loan Duration</span>
                      <span className="font-medium">
                        {formatDuration(request.duration)}
                      </span>
                    </div>
                  </div>

                  {/* Balance Status */}
                  {isConnected && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Your {borrowSymbol} Balance</span>
                        <span className={hasInsufficientBalance ? 'text-red-400' : 'text-green-400'}>
                          {lenderBalance ? formatTokenAmount(lenderBalance as bigint, borrowDecimals) : '0'} {borrowSymbol}
                        </span>
                      </div>

                      {/* Zero Balance Warning */}
                      {hasZeroBalance && (
                        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex gap-2 items-start">
                            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-yellow-400 font-medium">No {borrowSymbol} Balance</p>
                              <p className="text-gray-400 mt-1">
                                You need {borrowSymbol} tokens to fund this request.{' '}
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
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <div className="flex gap-2 items-start">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-red-400 font-medium">Insufficient Balance</p>
                              <p className="text-gray-400 mt-1">
                                You need {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol} but only have {formatTokenAmount(lenderBalance as bigint, borrowDecimals)}.{' '}
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
                </Card>
              </motion.div>
            )}

            {/* Price Staleness Warning */}
            {isPriceStale && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2 text-sm">
                      <p className="text-red-400 font-medium">Price Data is Stale</p>
                      <p className="text-gray-400">
                        The price feed data is outdated. Transactions will fail until prices are refreshed.
                      </p>
                      <Button
                        onClick={handleRefreshPrices}
                        loading={isRefreshingPrice}
                        size="sm"
                        variant="secondary"
                        icon={<RefreshCw className="w-4 h-4" />}
                      >
                        Refresh Price Feeds
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-semibold">Timeline</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Created</span>
                    <span>{new Date(Number(request.createdAt) * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expires</span>
                    <span className={isExpired ? 'text-red-400' : ''}>
                      {isExpired ? 'Expired' : formatTimeUntil(request.expireAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Loan Duration</span>
                    <span>{formatDuration(request.duration)}</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <h3 className="font-semibold mb-4">Actions</h3>
                <div className="space-y-3">
                  {request.status === LoanRequestStatus.PENDING && !isBorrower && !isExpired && (
                    <>
                      {isConnected ? (
                        <Button
                          onClick={openFundModal}
                          className="w-full"
                          icon={<DollarSign className="w-4 h-4" />}
                          disabled={isOpenModalDisabled}
                        >
                          Fund This Request
                        </Button>
                      ) : (
                        <p className="text-center text-gray-400 text-sm">
                          Connect wallet to fund this request
                        </p>
                      )}
                    </>
                  )}

                  {request.status === LoanRequestStatus.PENDING && isBorrower && (
                    <div className="text-center py-4">
                      <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                      <p className="text-yellow-400 font-semibold">Awaiting Funding</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Your request is visible to lenders
                      </p>
                    </div>
                  )}

                  {request.status === LoanRequestStatus.FUNDED && (
                    <div className="text-center py-4">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                      <p className="text-green-400 font-semibold">Request Funded</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This loan is now active
                      </p>
                    </div>
                  )}

                  {request.status === LoanRequestStatus.CANCELLED && (
                    <div className="text-center py-4">
                      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 font-semibold">Request Cancelled</p>
                    </div>
                  )}

                  {request.status === LoanRequestStatus.EXPIRED && (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-2" />
                      <p className="text-orange-400 font-semibold">Request Expired</p>
                    </div>
                  )}

                  {isExpired && request.status === LoanRequestStatus.PENDING && (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-2" />
                      <p className="text-orange-400 font-semibold">Request Expired</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This request can no longer be funded
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Security Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-accent-400" />
                  <h3 className="font-semibold">Security</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>
                    Collateral is held in escrow and can be liquidated if the loan becomes undercollateralized.
                  </p>
                  <p className="text-accent-400 font-medium">
                    LTV: {currentLTV.toFixed(1)}%
                  </p>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Fund Modal */}
      <Modal
        isOpen={showFundModal}
        onClose={() => {
          setShowFundModal(false);
          setSimulationError('');
        }}
        title="Fund Loan Request"
        size="md"
      >
        <div className="space-y-6">
          {/* Summary */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Amount to Provide</span>
              <span className="font-semibold">
                {request && formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Interest Rate</span>
              <span className="font-semibold text-green-400">
                {request && formatPercentage(request.interestRate)} APY
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration</span>
              <span className="font-semibold">
                {request && formatDuration(request.duration)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Collateral Securing Loan</span>
              <span className="font-semibold">
                {request && formatTokenAmount(request.collateralAmount, collateralDecimals)} {collateralSymbol}
              </span>
            </div>
          </div>

          {/* Balance Display */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Your Balance</span>
            <span className={hasInsufficientBalance ? 'text-red-400' : 'text-green-400'}>
              {lenderBalance ? formatTokenAmount(lenderBalance as bigint, borrowDecimals) : '0'} {borrowSymbol}
            </span>
          </div>

          {/* Zero Balance Warning */}
          {hasZeroBalance && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">No {borrowSymbol} Balance</p>
                  <p className="text-gray-400 mt-1">
                    You need {borrowSymbol} tokens to fund this request.
                  </p>
                  <Link
                    href="/faucet"
                    className="text-primary-400 hover:text-primary-300 hover:underline font-medium mt-2 inline-block"
                  >
                    Get test tokens from the faucet →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Insufficient Balance Warning */}
          {hasInsufficientBalance && !hasZeroBalance && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Insufficient Balance</p>
                  <p className="text-gray-400 mt-1">
                    You need {request && formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol} but only have {formatTokenAmount(lenderBalance as bigint, borrowDecimals)}.
                  </p>
                  <Link
                    href="/faucet"
                    className="text-primary-400 hover:text-primary-300 hover:underline font-medium mt-2 inline-block"
                  >
                    Get more tokens from the faucet →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Price Staleness Warning in Modal */}
          {isPriceStale && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm space-y-2">
                  <p className="text-red-400 font-medium">Price Data is Stale</p>
                  <p className="text-gray-400">
                    Transaction will fail until price feeds are refreshed.
                  </p>
                  <Button
                    onClick={handleRefreshPrices}
                    loading={isRefreshingPrice}
                    size="sm"
                    variant="secondary"
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    Refresh Price Feeds
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Simulation Error */}
          {simulationError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Transaction Error</p>
                  <p className="text-gray-400 mt-1">{simulationError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Steps - Only show when balance is sufficient */}
          {!hasZeroBalance && !hasInsufficientBalance && !isPriceStale && (
            <div className="space-y-4">
              {/* Step Indicator */}
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${fundingStep === 'approve' || hasApproval ? 'text-primary-400' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasApproval ? 'bg-green-500' : fundingStep === 'approve' ? 'bg-primary-500' : 'bg-gray-700'}`}>
                    {hasApproval ? <CheckCircle className="w-5 h-5" /> : '1'}
                  </div>
                  <span>Approve</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-700" />
                <div className={`flex items-center gap-2 ${fundingStep === 'fund' ? 'text-primary-400' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${fundingStep === 'fund' ? 'bg-primary-500' : 'bg-gray-700'}`}>
                    2
                  </div>
                  <span>Fund</span>
                </div>
              </div>

              {/* Action Button */}
              {!hasApproval ? (
                <Button
                  onClick={handleApprove}
                  loading={approveIsPending || isApprovalConfirming}
                  className="w-full"
                  disabled={isApproveDisabled}
                >
                  {approveIsPending ? 'Approving...' : isApprovalConfirming ? 'Confirming...' : `Approve ${borrowSymbol}`}
                </Button>
              ) : (
                <Button
                  onClick={handleFund}
                  loading={isFunding || fundIsPending}
                  className="w-full"
                  disabled={isFundDisabled}
                >
                  Confirm Funding
                </Button>
              )}
            </div>
          )}

          <Button
            variant="secondary"
            onClick={() => setShowFundModal(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
