'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSwitchChain } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, Address } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RequestStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  useTokenPrice,
  useLTV,
  useRefreshMockPrice,
  useFundCrossChainLoanRequest,
  useApproveToken,
  useTokenBalance,
  useTokenAllowance,
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
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getActiveChainId,
  getChainById,
  getTokenBySymbolForChain,
  findTokenChainId,
  getContractAddresses,
} from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import CrossChainLoanManagerABIJson from '@/contracts/CrossChainLoanManagerABI.json';
import { Abi } from 'viem';
import { ParsedLoanRequest } from './SameChainLoanDetail';

const CrossChainLoanManagerABI = CrossChainLoanManagerABIJson as Abi;

interface CrossChainLoanDetailProps {
  request: ParsedLoanRequest;
  requestId: bigint;
  foundOnChainId?: number; // The chain where this request actually lives (from multi-chain query)
  isCrossChain?: boolean;  // Whether this is genuinely cross-chain (controls cross-chain UI)
}

export default function CrossChainLoanDetail({ request, requestId, foundOnChainId, isCrossChain = true }: CrossChainLoanDetailProps) {
  const router = useRouter();
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const [showFundModal, setShowFundModal] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingStep, setFundingStep] = useState<'approve' | 'fund'>('approve');
  const [simulationError, setSimulationError] = useState<string>('');

  // ── Cross-chain token resolution ──────────────────────────────────
  // `targetChainId` = the chain where this loan request lives (where funding happens).
  // If the page found it on a different chain via multi-chain query, use that;
  // otherwise fall back to the marketplace network switcher's active chain.
  const activeChainId = getActiveChainId();
  const targetChainId = foundOnChainId ?? activeChainId;

  // Get contract addresses for the TARGET chain (where funding tx will execute)
  const targetContracts = getContractAddresses(targetChainId);

  // Detect source chain: check where the borrowAsset or collateralToken actually lives
  const borrowAssetChainId = findTokenChainId(request.borrowAsset);
  const collateralTokenChainId = findTokenChainId(request.collateralToken);
  // Source chain = whichever chain has a foreign token (not the target chain)
  const detectedSourceChainId = borrowAssetChainId && borrowAssetChainId !== targetChainId
    ? borrowAssetChainId
    : collateralTokenChainId && collateralTokenChainId !== targetChainId
      ? collateralTokenChainId
      : (Number(request.chainId) !== 0 && Number(request.chainId) !== targetChainId)
        ? Number(request.chainId)
        : undefined;

  const sourceChain = detectedSourceChainId ? getChainById(detectedSourceChainId) : undefined;
  const targetChain = getChainById(targetChainId);

  // Resolve token symbols using cross-chain fallback in getTokenSymbol
  const collateralSymbol = getTokenSymbol(request.collateralToken);
  const borrowSymbol = getTokenSymbol(request.borrowAsset);
  const collateralDecimals = Number(getTokenDecimals(request.collateralToken));
  const borrowDecimals = Number(getTokenDecimals(request.borrowAsset));

  // Resolve borrow asset to TARGET chain equivalent (for balance, allowance, approval)
  const localBorrowToken = borrowSymbol
    ? getTokenBySymbolForChain(borrowSymbol, targetChainId)
    : undefined;
  const localBorrowAsset: Address | undefined = localBorrowToken?.address as Address | undefined;

  // Resolve collateral to TARGET chain equivalent (for price lookup)
  const localCollateralToken = collateralSymbol
    ? getTokenBySymbolForChain(collateralSymbol, targetChainId)
    : undefined;
  const localCollateralAsset: Address | undefined = localCollateralToken?.address as Address | undefined;

  // Check if user is the borrower
  const isBorrower = address?.toLowerCase() === request.borrower.toLowerCase();

  // Wallet chain mismatch — lender must be on target chain to fund
  const isWrongChain = walletChainId !== targetChainId;

  // ── Balance & Allowance (using target chain token + explicit chainId) ────
  const { data: lenderBalance } = useTokenBalance(localBorrowAsset, address, targetChainId);
  const { data: lenderAllowance, refetch: refetchAllowance } = useTokenAllowance(
    localBorrowAsset,
    address,
    targetContracts.crossChainManager,
    targetChainId
  );

  // ── Price data (use local token addresses for price feed lookup) ──
  const collateralPriceHook = useTokenPrice(localCollateralAsset ?? request.collateralToken);
  const borrowPriceHook = useTokenPrice(localBorrowAsset ?? request.borrowAsset);
  const collateralPrice = collateralPriceHook.price;
  const borrowPrice = borrowPriceHook.price;

  const isPriceStale = collateralPriceHook.isStale || borrowPriceHook.isStale;

  // Price refresh hook
  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  const handleRefreshPrices = async () => {
    try {
      if (collateralPriceHook.isStale && collateralPriceHook.priceFeedAddress && collateralPrice) {
        await refreshPrice(collateralPriceHook.priceFeedAddress as Address, BigInt(collateralPrice), localCollateralAsset ?? request.collateralToken);
      }
      if (borrowPriceHook.isStale && borrowPriceHook.priceFeedAddress && borrowPrice) {
        await refreshPrice(borrowPriceHook.priceFeedAddress as Address, BigInt(borrowPrice), localBorrowAsset ?? request.borrowAsset);
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
  const collateralUSD = collateralPrice
    ? (Number(request.collateralAmount) / Math.pow(10, collateralDecimals)) * Number(collateralPrice) / 1e8
    : 0;
  const borrowUSD = borrowPrice
    ? (Number(request.borrowAmount) / Math.pow(10, borrowDecimals)) * Number(borrowPrice) / 1e8
    : 0;

  // LTV — use local collateral address for LTV config lookup
  const durationDays = Math.ceil(Number(request.duration) / (24 * 60 * 60));
  const { data: ltvBps } = useLTV(localCollateralAsset ?? request.collateralToken, durationDays);
  const currentLTV = ltvBps ? Number(ltvBps) / 100 : 0;

  // Balance calculations
  const maxLenderBalance = lenderBalance
    ? formatUnits(lenderBalance as bigint, borrowDecimals)
    : '0';
  const maxLenderBalanceNumber = parseFloat(maxLenderBalance);

  const hasZeroBalance = maxLenderBalanceNumber === 0;
  const hasInsufficientBalance = lenderBalance
    ? (lenderBalance as bigint) < request.borrowAmount
    : false;

  const hasApproval = lenderAllowance && request.borrowAmount > BigInt(0)
    ? (lenderAllowance as bigint) >= request.borrowAmount
    : false;

  // Write hooks
  const { approveAsync, isPending: approveIsPending, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { fundRequestAsync, isPending: fundIsPending, isSuccess: fundSuccess, error: fundError } = useFundCrossChainLoanRequest();

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Approval successful!');
      refetchAllowance();
      setFundingStep('fund');
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (fundSuccess) {
      toast.success('Cross-chain loan funded successfully!');
      setShowFundModal(false);
      setIsFunding(false);
      router.push('/dashboard');
    }
  }, [fundSuccess, router]);

  useEffect(() => {
    if (fundError) {
      console.error('Fund error:', fundError);
      const errorMessage = fundError.message || 'Failed to fund loan request';
      setSimulationError(errorMessage);
      toast.error(errorMessage);
      setIsFunding(false);
    }
  }, [fundError]);

  const openFundModal = () => {
    if (!request || requestId === undefined) {
      toast.error('Loan request data not available.');
      return;
    }
    setShowFundModal(true);
  };

  useEffect(() => {
    if (showFundModal) {
      setFundingStep(hasApproval ? 'fund' : 'approve');
      setSimulationError('');
    }
  }, [showFundModal, hasApproval]);

  const handleSwitchChain = () => {
    switchChain({ chainId: targetChainId });
  };

  const handleApprove = async () => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!localBorrowAsset) {
      toast.error(`Cannot resolve ${borrowSymbol} on this chain`);
      return;
    }

    setSimulationError('');

    console.log('[CrossChain] handleApprove:', {
      localBorrowAsset,
      spender: targetContracts.crossChainManager,
      amount: request.borrowAmount.toString(),
      account: address,
      targetChainId,
    });

    try {
      const simulation = await simulateContractWrite({
        address: localBorrowAsset,
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
        args: [targetContracts.crossChainManager, request.borrowAmount],
        account: address,
      });

      console.log('[CrossChain] Approve simulation result:', simulation);

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Simulation failed';
        setSimulationError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      await approveAsync(localBorrowAsset, targetContracts.crossChainManager, request.borrowAmount);
    } catch (error: unknown) {
      console.error('[CrossChain] Approve error:', error);
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleFund = async () => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsFunding(true);
    setSimulationError('');

    // For cross-chain funding, we need sourceChainId and sourceLoanId
    const sourceChainIdBigInt = detectedSourceChainId ? BigInt(detectedSourceChainId) : BigInt(0);
    // sourceLoanId: the original request ID on the source chain (relay should provide this)
    // For now, pass 0 — the relay/contract may need to be updated to track this
    const sourceLoanId = BigInt(0);

    console.log('[CrossChain] handleFund:', {
      requestId: requestId.toString(),
      sourceChainId: sourceChainIdBigInt.toString(),
      sourceLoanId: sourceLoanId.toString(),
      crossChainManager: targetContracts.crossChainManager,
      account: address,
      borrowAsset: request.borrowAsset,
      localBorrowAsset,
      borrowAmount: request.borrowAmount.toString(),
      detectedSourceChainId,
      targetChainId,
    });

    try {
      console.log('[CrossChain] Simulating fundCrossChainLoanRequest...');
      const simulation = await simulateContractWrite({
        address: targetContracts.crossChainManager,
        abi: CrossChainLoanManagerABI,
        functionName: 'fundCrossChainLoanRequest',
        args: [requestId, sourceChainIdBigInt, sourceLoanId],
        account: address,
      });

      console.log('[CrossChain] Fund simulation result:', simulation);

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Transaction would fail';
        console.error('[CrossChain] Fund simulation failed:', simulation.error);
        setSimulationError(errorMsg);
        toast.error(errorMsg);
        setIsFunding(false);
        return;
      }

      console.log('[CrossChain] Simulation passed, executing fund...');
      await fundRequestAsync(requestId, sourceChainIdBigInt, sourceLoanId, targetContracts.crossChainManager);
    } catch (error: unknown) {
      console.error('[CrossChain] Fund error:', error);
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

  // Button disabled states
  const isOpenModalDisabled =
    !request ||
    isWrongChain ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    isFunding ||
    fundIsPending ||
    approveIsPending ||
    isApprovalConfirming;

  const isApproveDisabled =
    !request ||
    isWrongChain ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    approveIsPending ||
    isApprovalConfirming;

  const isFundDisabled =
    !request ||
    isWrongChain ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    isFunding ||
    fundIsPending;

  const canFund = request.status === LoanRequestStatus.PENDING && !isBorrower && isConnected;

  const blockExplorer = targetChain?.blockExplorer || sourceChain?.blockExplorer || '';

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
              {isCrossChain && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent-500/20 text-accent-400 border border-accent-500/30">
                  Cross-Chain
                </span>
              )}
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

        {/* Cross-Chain Info Banner — only for genuinely cross-chain requests */}
        {isCrossChain && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <Card className="bg-accent-500/10 border-accent-500/20">
              <div className="flex items-start gap-4 p-4">
                <Layers className="w-6 h-6 text-accent-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-accent-400 mb-2">Cross-Chain Request</h3>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Collateral locked on: </span>
                      <span className="text-white font-medium">{sourceChain?.name || `Chain ${detectedSourceChainId}`}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Funds needed on: </span>
                      <span className="text-white font-medium">{targetChain?.name || `Chain ${targetChainId}`}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    The borrower locked collateral on {sourceChain?.name || 'another chain'} and is requesting funds on {targetChain?.name || 'this chain'}.
                    To fund this request, you need {borrowSymbol} on {targetChain?.name || 'this chain'}.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Wrong Chain Warning */}
        {isWrongChain && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-6"
          >
            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-400 mb-1">Wrong Network</h3>
                    <p className="text-sm text-gray-400">
                      Your wallet is on a different network. Switch to <strong className="text-white">{targetChain?.name || 'the target chain'}</strong> to fund this request.
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleSwitchChain}>
                  Switch Network
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

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
                      <p className="text-sm text-gray-400 mb-1">
                        Collateral Offered
                        {isCrossChain && sourceChain && (
                          <span className="text-xs text-accent-400 ml-1">(on {sourceChain.name})</span>
                        )}
                      </p>
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
                      href={`${blockExplorer}/address/${request.borrower}`}
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
                        {isCrossChain && <span className="text-xs text-gray-500 ml-1">on {targetChain?.name}</span>}
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
                        {isCrossChain && sourceChain && <span className="text-xs text-gray-500 ml-1">on {sourceChain.name}</span>}
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

                      {hasZeroBalance && (
                        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex gap-2 items-start">
                            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-yellow-400 font-medium">No {borrowSymbol} Balance</p>
                              <p className="text-gray-400 mt-1">
                                You need {borrowSymbol} tokens on {targetChain?.name} to fund this request.{' '}
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
            {/* Chain Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-5 h-5 text-accent-400" />
                  <h3 className="font-semibold">Chain Details</h3>
                </div>
                <div className="space-y-3 text-sm">
                  {isCrossChain ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Source Chain</span>
                        <span className="font-medium">{sourceChain?.name || `Chain ${detectedSourceChainId}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Target Chain</span>
                        <span className="font-medium">{targetChain?.name || `Chain ${targetChainId}`}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network</span>
                      <span className="font-medium">{targetChain?.name || `Chain ${targetChainId}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Your Wallet</span>
                    <span className={isWrongChain ? 'text-yellow-400 font-medium' : 'text-green-400 font-medium'}>
                      {isWrongChain ? 'Wrong chain' : 'Connected'}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>

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
                    <span>{formatTimeUntil(request.expireAt)}</span>
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
                  {request.status === LoanRequestStatus.PENDING && !isBorrower && (
                    <>
                      {isConnected ? (
                        isWrongChain ? (
                          <Button
                            onClick={handleSwitchChain}
                            className="w-full"
                            variant="secondary"
                          >
                            Switch to {targetChain?.name}
                          </Button>
                        ) : (
                          <Button
                            onClick={openFundModal}
                            className="w-full"
                            icon={<DollarSign className="w-4 h-4" />}
                            disabled={isOpenModalDisabled}
                          >
                            Fund This Request
                          </Button>
                        )
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
                        Your request is visible to lenders on {targetChain?.name}
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
                    Collateral is held in escrow{isCrossChain && sourceChain ? ` on ${sourceChain.name}` : ''} and can be liquidated if the loan becomes undercollateralized.
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
        title={isCrossChain ? "Fund Cross-Chain Loan Request" : "Fund Loan Request"}
        size="md"
      >
        <div className="space-y-6">
          {/* Cross-chain info in modal — only for genuinely cross-chain */}
          {isCrossChain && (
            <div className="p-3 bg-accent-500/10 border border-accent-500/20 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-accent-400 font-medium mb-1">
                <Layers className="w-4 h-4" />
                Cross-Chain Request
              </div>
              <p className="text-gray-400">
                Collateral on {sourceChain?.name} — Funds from {targetChain?.name}
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Amount to Provide</span>
              <span className="font-semibold">
                {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Interest Rate</span>
              <span className="font-semibold text-green-400">
                {formatPercentage(request.interestRate)} APY
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration</span>
              <span className="font-semibold">
                {formatDuration(request.duration)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Collateral Securing Loan</span>
              <span className="font-semibold">
                {formatTokenAmount(request.collateralAmount, collateralDecimals)} {collateralSymbol}
              </span>
            </div>
          </div>

          {/* Balance Display */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Your Balance ({targetChain?.name})</span>
            <span className={hasInsufficientBalance ? 'text-red-400' : 'text-green-400'}>
              {lenderBalance ? formatTokenAmount(lenderBalance as bigint, borrowDecimals) : '0'} {borrowSymbol}
            </span>
          </div>

          {/* Wrong Chain Warning in Modal */}
          {isWrongChain && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="text-yellow-400 font-medium">Wrong Network</p>
                  <p className="text-gray-400 mt-1">
                    Switch to {targetChain?.name} to fund this request.
                  </p>
                  <Button size="sm" onClick={handleSwitchChain} className="mt-2">
                    Switch Network
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Zero Balance Warning */}
          {!isWrongChain && hasZeroBalance && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">No {borrowSymbol} Balance</p>
                  <p className="text-gray-400 mt-1">
                    You need {borrowSymbol} tokens on {targetChain?.name} to fund this request.
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
          {!isWrongChain && hasInsufficientBalance && !hasZeroBalance && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Insufficient Balance</p>
                  <p className="text-gray-400 mt-1">
                    You need {formatTokenAmount(request.borrowAmount, borrowDecimals)} {borrowSymbol} but only have {formatTokenAmount(lenderBalance as bigint, borrowDecimals)}.
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

          {/* Steps */}
          {!isWrongChain && !hasZeroBalance && !hasInsufficientBalance && !isPriceStale && (
            <div className="space-y-4">
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
