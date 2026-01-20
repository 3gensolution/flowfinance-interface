'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RequestStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  useLenderOffer,
  useAcceptLenderOffer,
  useTokenPrice,
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
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Wallet,
  Info,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DEFAULT_CHAIN, CONTRACT_ADDRESSES } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.id ? BigInt(params.id as string) : undefined;
  const { address, isConnected } = useAccount();

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptStep, setAcceptStep] = useState<'approve' | 'accept'>('approve');
  const [simulationError, setSimulationError] = useState<string>('');

  // Fetch lender offer data
  const { data: offerData, isLoading: offerLoading, refetch } = useLenderOffer(offerId);

  // Parse offer data from contract (it returns a tuple)
  const offerTuple = offerData as readonly unknown[];
  const offer = offerData ? {
    offerId: offerTuple[0] as bigint,
    lender: offerTuple[1] as `0x${string}`,
    lendAsset: offerTuple[2] as `0x${string}`,
    lendAmount: offerTuple[3] as bigint,
    requiredCollateralAsset: offerTuple[4] as `0x${string}`,
    minCollateralAmount: offerTuple[5] as bigint,
    duration: offerTuple[6] as bigint,
    interestRate: offerTuple[7] as bigint,
    createdAt: offerTuple[8] as bigint,
    expireAt: offerTuple[9] as bigint,
    status: offerTuple[10] as LoanRequestStatus,
  } : null;

  // Token info
  const lendSymbol = offer ? getTokenSymbol(offer.lendAsset) : '';
  const collateralSymbol = offer ? getTokenSymbol(offer.requiredCollateralAsset) : '';
  const lendDecimals = offer ? Number(getTokenDecimals(offer.lendAsset)) : 18;
  const collateralDecimals = offer ? Number(getTokenDecimals(offer.requiredCollateralAsset)) : 18;

  // Check if user is the lender (owner of the offer)
  const isLender = offer && address?.toLowerCase() === offer.lender.toLowerCase();

  // Get borrower's collateral balance and allowance
  const { data: borrowerCollateralBalance } = useTokenBalance(offer?.requiredCollateralAsset, address);
  const { data: borrowerCollateralAllowance, refetch: refetchAllowance } = useTokenAllowance(
    offer?.requiredCollateralAsset,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  // Price data for USD values
  const lendPriceHook = useTokenPrice(offer?.lendAsset);
  const collateralPriceHook = useTokenPrice(offer?.requiredCollateralAsset);
  const lendPrice = lendPriceHook.price;
  const collateralPrice = collateralPriceHook.price;

  // Check price staleness
  const isPriceStale = lendPriceHook.isStale || collateralPriceHook.isStale;

  // Calculate USD values
  const lendUSD = offer && lendPrice
    ? (Number(offer.lendAmount) / Math.pow(10, Number(lendDecimals))) * Number(lendPrice) / 1e8
    : 0;
  const minCollateralUSD = offer && collateralPrice
    ? (Number(offer.minCollateralAmount) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  // The collateral amount is fixed as the minimum required (read-only)
  const requiredCollateralFormatted = offer
    ? formatTokenAmount(offer.minCollateralAmount, collateralDecimals)
    : '0';

  // Calculate LTV for the minimum collateral
  const currentLTV = minCollateralUSD > 0 && lendUSD > 0
    ? (lendUSD / minCollateralUSD) * 100
    : 0;

  // Balance calculations
  const maxCollateralBalance = borrowerCollateralBalance
    ? formatUnits(borrowerCollateralBalance as bigint, collateralDecimals)
    : '0';
  const maxCollateralBalanceNumber = parseFloat(maxCollateralBalance);

  // Check balance status
  const hasZeroBalance = maxCollateralBalanceNumber === 0;
  const hasInsufficientBalance = offer && borrowerCollateralBalance
    ? (borrowerCollateralBalance as bigint) < offer.minCollateralAmount
    : false;

  // Check if already approved
  const hasApproval = borrowerCollateralAllowance && offer
    ? (borrowerCollateralAllowance as bigint) >= offer.minCollateralAmount
    : false;

  // Write hooks
  const { approve, isPending: approveIsPending, isSuccess: approveSuccess } = useApproveToken();
  const { acceptOffer, isPending: acceptIsPending, isSuccess: acceptSuccess } = useAcceptLenderOffer();

  // Handle approval success
  useEffect(() => {
    if (approveSuccess) {
      toast.success('Approval successful!');
      refetchAllowance();
      setAcceptStep('accept');
    }
  }, [approveSuccess, refetchAllowance]);

  // Handle accept success
  useEffect(() => {
    if (acceptSuccess) {
      toast.success('Offer accepted! The loan is now active.');
      setShowAcceptModal(false);
      setIsAccepting(false);
      refetch();
      router.push('/dashboard');
    }
  }, [acceptSuccess, router, refetch]);

  // Reset step when opening modal
  useEffect(() => {
    if (showAcceptModal) {
      setAcceptStep(hasApproval ? 'accept' : 'approve');
      setSimulationError('');
    }
  }, [showAcceptModal, hasApproval]);

  const handleApprove = async () => {
    if (!offer) return;
    setSimulationError('');

    try {
      // Simulate approval first
      const simulation = await simulateContractWrite({
        address: offer.requiredCollateralAsset,
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
        args: [CONTRACT_ADDRESSES.loanMarketPlace, offer.minCollateralAmount],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Simulation failed');
        toast.error(simulation.errorMessage || 'Transaction will fail');
        return;
      }

      approve(offer.requiredCollateralAsset, CONTRACT_ADDRESSES.loanMarketPlace, offer.minCollateralAmount);
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleAccept = async () => {
    if (!offer || !offerId) return;
    setIsAccepting(true);
    setSimulationError('');

    try {
      // Simulate first
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'acceptLenderOffer',
        args: [offerId, offer.minCollateralAmount],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Transaction would fail');
        toast.error(simulation.errorMessage || 'Transaction would fail');
        setIsAccepting(false);
        return;
      }

      acceptOffer(offerId, offer.minCollateralAmount);
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
      setIsAccepting(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied!');
  };

  // Check if accept button should be disabled
  const isAcceptDisabled =
    !offer ||
    hasZeroBalance ||
    hasInsufficientBalance ||
    isPriceStale ||
    isAccepting ||
    acceptIsPending ||
    approveIsPending;

  if (offerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Check if offer exists (invalid/empty slot will have zero address lender)
  if (!offer || !offer.lender || offer.lender === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Offer Not Found</h2>
          <p className="text-gray-400 mb-6">
            This lender offer doesn&apos;t exist or has been removed.
          </p>
          <Link href="/marketplace">
            <Button>Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isExpired = Number(offer.expireAt) * 1000 < Date.now();
  const canAccept = offer.status === LoanRequestStatus.PENDING && !isLender && !isExpired && isConnected;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
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
              <h1 className="text-3xl font-bold">Lender Offer #{offer.offerId.toString()}</h1>
              <RequestStatusBadge status={offer.status} />
            </div>
            <p className="text-gray-400">
              {isLender ? 'Your offer to lend' : 'Lender offering'}{' '}
              <span className="text-white font-medium">
                {formatTokenAmount(offer.lendAmount, lendDecimals)} {lendSymbol}
              </span>
            </p>
          </div>

          {canAccept && (
            <Button
              onClick={() => setShowAcceptModal(true)}
              icon={<Wallet className="w-4 h-4" />}
              size="lg"
              disabled={isAcceptDisabled}
            >
              Accept This Offer
            </Button>
          )}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Offer Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <h2 className="text-xl font-bold mb-6">Offer Details</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Lend Amount</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(offer.lendAmount, lendDecimals)} {lendSymbol}
                      </p>
                      {lendUSD > 0 && (
                        <p className="text-sm text-gray-500">~${lendUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Interest Rate</p>
                      <p className="text-lg font-semibold text-green-400">
                        {formatPercentage(offer.interestRate)} APY
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Duration</p>
                      <p className="text-lg font-semibold">
                        {formatDuration(offer.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Required Collateral</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol}
                      </p>
                      {minCollateralUSD > 0 && (
                        <p className="text-sm text-gray-500">~${minCollateralUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Collateral Token</p>
                      <p className="text-lg font-semibold">
                        {collateralSymbol}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">LTV Ratio</p>
                      <p className={`text-lg font-semibold ${currentLTV > 80 ? 'text-red-400' : currentLTV > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {currentLTV.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Lender Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <h2 className="text-xl font-bold mb-6">Lender</h2>
                <div className="flex items-center justify-between p-4 glass-card rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-accent-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Wallet Address</p>
                      <p className="font-mono">{formatAddress(offer.lender, 6)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLender && <Badge variant="info" size="sm">You</Badge>}
                    <button onClick={() => copyAddress(offer.lender)} className="p-2 hover:bg-white/10 rounded-lg">
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={`${DEFAULT_CHAIN.blockExplorer}/address/${offer.lender}`}
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

            {/* Borrowing Opportunity (for borrowers) */}
            {!isLender && offer.status === LoanRequestStatus.PENDING && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border border-accent-500/30 bg-accent-500/5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-accent-400" />
                    <h3 className="font-semibold">Borrowing Opportunity</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">You Receive</span>
                      <span className="font-medium">
                        {formatTokenAmount(offer.lendAmount, lendDecimals)} {lendSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Interest Rate</span>
                      <span className="font-medium text-yellow-400">
                        {formatPercentage(offer.interestRate)} APY
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Collateral Required</span>
                      <span className="font-medium">
                        {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">Loan Duration</span>
                      <span className="font-medium">
                        {formatDuration(offer.duration)}
                      </span>
                    </div>
                  </div>

                  {/* Balance Status */}
                  {isConnected && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Your {collateralSymbol} Balance</span>
                        <span className={hasInsufficientBalance ? 'text-red-400' : 'text-green-400'}>
                          {borrowerCollateralBalance ? formatTokenAmount(borrowerCollateralBalance as bigint, collateralDecimals) : '0'} {collateralSymbol}
                        </span>
                      </div>

                      {/* Zero Balance Warning */}
                      {hasZeroBalance && (
                        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex gap-2 items-start">
                            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-yellow-400 font-medium">No {collateralSymbol} Balance</p>
                              <p className="text-gray-400 mt-1">
                                You need {collateralSymbol} tokens to accept this offer.{' '}
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
                                You need {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol} but only have {formatTokenAmount(borrowerCollateralBalance as bigint, collateralDecimals)}.{' '}
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
                    <div className="space-y-1 text-sm">
                      <p className="text-red-400 font-medium">Price Data is Stale</p>
                      <p className="text-gray-400">
                        The price feed data is outdated. Transactions will fail until prices are refreshed.
                      </p>
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
                    <span>{new Date(Number(offer.createdAt) * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expires</span>
                    <span className={isExpired ? 'text-red-400' : ''}>
                      {isExpired ? 'Expired' : formatTimeUntil(offer.expireAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Loan Duration</span>
                    <span>{formatDuration(offer.duration)}</span>
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
                  {offer.status === LoanRequestStatus.PENDING && !isLender && !isExpired && (
                    <>
                      {isConnected ? (
                        <Button
                          onClick={() => setShowAcceptModal(true)}
                          className="w-full"
                          icon={<Wallet className="w-4 h-4" />}
                          disabled={isAcceptDisabled}
                        >
                          Accept This Offer
                        </Button>
                      ) : (
                        <p className="text-center text-gray-400 text-sm">
                          Connect wallet to accept this offer
                        </p>
                      )}
                    </>
                  )}

                  {offer.status === LoanRequestStatus.PENDING && isLender && (
                    <div className="text-center py-4">
                      <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                      <p className="text-yellow-400 font-semibold">Awaiting Acceptance</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Your offer is visible to borrowers
                      </p>
                    </div>
                  )}

                  {offer.status === LoanRequestStatus.FUNDED && (
                    <div className="text-center py-4">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                      <p className="text-green-400 font-semibold">Offer Accepted</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This loan is now active
                      </p>
                    </div>
                  )}

                  {offer.status === LoanRequestStatus.CANCELLED && (
                    <div className="text-center py-4">
                      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 font-semibold">Offer Cancelled</p>
                    </div>
                  )}

                  {offer.status === LoanRequestStatus.EXPIRED && (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-2" />
                      <p className="text-orange-400 font-semibold">Offer Expired</p>
                    </div>
                  )}

                  {isExpired && offer.status === LoanRequestStatus.PENDING && (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-2" />
                      <p className="text-orange-400 font-semibold">Offer Expired</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This offer can no longer be accepted
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
                    The collateral amount is fixed by the lender&apos;s offer terms. Your collateral is secured by smart contract.
                  </p>
                  <p className="text-accent-400 font-medium">
                    Required: {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol}
                  </p>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Accept Offer Modal */}
      <Modal
        isOpen={showAcceptModal}
        onClose={() => {
          setShowAcceptModal(false);
          setSimulationError('');
        }}
        title="Accept Lender Offer"
        size="md"
      >
        <div className="space-y-6">
          {/* Summary */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">You Will Receive</span>
              <span className="font-semibold">
                {offer && formatTokenAmount(offer.lendAmount, lendDecimals)} {lendSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Interest Rate</span>
              <span className="font-semibold text-yellow-400">
                {offer && formatPercentage(offer.interestRate)} APY
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration</span>
              <span className="font-semibold">
                {offer && formatDuration(offer.duration)}
              </span>
            </div>
          </div>

          {/* Collateral Display (Read-only) */}
          <div>
            <div className="relative">
              <Input
                label={`Required Collateral (${collateralSymbol})`}
                type="text"
                value={requiredCollateralFormatted}
                readOnly
                disabled
                suffix={collateralSymbol}
                className="bg-gray-800/50 cursor-not-allowed"
              />
              <div className="absolute right-16 top-9">
                <Info className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-gray-400">
                Your Balance: {borrowerCollateralBalance ? formatTokenAmount(borrowerCollateralBalance as bigint, collateralDecimals) : '0'} {collateralSymbol}
              </span>
              <span className={`${currentLTV > 80 ? 'text-red-400' : currentLTV > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                LTV: {currentLTV.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Collateral amount is determined by the lender&apos;s offer terms
            </p>
          </div>

          {/* Zero Balance Warning */}
          {hasZeroBalance && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">No {collateralSymbol} Balance</p>
                  <p className="text-gray-400 mt-1">
                    You need {collateralSymbol} tokens to accept this offer.
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
                    You need {requiredCollateralFormatted} {collateralSymbol} but only have {formatTokenAmount(borrowerCollateralBalance as bigint, collateralDecimals)}.
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
                <div className="text-sm">
                  <p className="text-red-400 font-medium">Price Data is Stale</p>
                  <p className="text-gray-400 mt-1">
                    Transaction will fail until price feeds are refreshed.
                  </p>
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
                <div className={`flex items-center gap-2 ${acceptStep === 'approve' || hasApproval ? 'text-primary-400' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasApproval ? 'bg-green-500' : acceptStep === 'approve' ? 'bg-primary-500' : 'bg-gray-700'}`}>
                    {hasApproval ? <CheckCircle className="w-5 h-5" /> : '1'}
                  </div>
                  <span>Approve</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-700" />
                <div className={`flex items-center gap-2 ${acceptStep === 'accept' ? 'text-primary-400' : 'text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${acceptStep === 'accept' ? 'bg-primary-500' : 'bg-gray-700'}`}>
                    2
                  </div>
                  <span>Accept</span>
                </div>
              </div>

              {/* Action Button */}
              {!hasApproval ? (
                <Button
                  onClick={handleApprove}
                  loading={approveIsPending}
                  className="w-full"
                  disabled={isAcceptDisabled}
                >
                  Approve {collateralSymbol}
                </Button>
              ) : (
                <Button
                  onClick={handleAccept}
                  loading={isAccepting || acceptIsPending}
                  className="w-full"
                  disabled={isAcceptDisabled}
                >
                  Confirm & Accept Offer
                </Button>
              )}
            </div>
          )}

          <Button
            variant="secondary"
            onClick={() => setShowAcceptModal(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
