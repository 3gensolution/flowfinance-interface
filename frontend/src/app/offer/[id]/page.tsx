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
  useLTV,
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
import { TOKEN_LIST } from '@/config/contracts';
import { Address } from 'viem';
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

  // State for flexible collateral (when offer accepts any collateral)
  const [selectedCollateralToken, setSelectedCollateralToken] = useState<Address | ''>('');

  // Fetch lender offer data
  const { data: offerData, isLoading: offerLoading, refetch } = useLenderOffer(offerId);

  // Parse offer data from contract (it returns a tuple)
  // Order: offerId, lender, lendAsset, lendAmount, remainingAmount, borrowedAmount,
  //        requiredCollateralAsset, minCollateralAmount, duration, interestRate,
  //        createdAt, expireAt, status, chainId
  const offerTuple = offerData as readonly unknown[];
  const offer = offerData ? {
    offerId: offerTuple[0] as bigint,
    lender: offerTuple[1] as `0x${string}`,
    lendAsset: offerTuple[2] as `0x${string}`,
    lendAmount: offerTuple[3] as bigint,
    remainingAmount: offerTuple[4] as bigint,
    borrowedAmount: offerTuple[5] as bigint,
    requiredCollateralAsset: offerTuple[6] as `0x${string}`,
    minCollateralAmount: offerTuple[7] as bigint,
    duration: offerTuple[8] as bigint,
    interestRate: offerTuple[9] as bigint,
    createdAt: offerTuple[10] as bigint,
    expireAt: offerTuple[11] as bigint,
    status: offerTuple[12] as LoanRequestStatus,
    chainId: offerTuple[13] as bigint,
  } : null;

  // Check if this is a flexible collateral offer (zero address means borrower chooses)
  const isFlexibleCollateral = offer?.requiredCollateralAsset === '0x0000000000000000000000000000000000000000';

  // Token info
  const lendSymbol = offer ? getTokenSymbol(offer.lendAsset) : '';
  const lendDecimals = offer ? Number(getTokenDecimals(offer.lendAsset)) : 18;

  // For flexible collateral, use selected token; otherwise use the required token
  const activeCollateralToken = isFlexibleCollateral
    ? (selectedCollateralToken as Address || undefined)
    : offer?.requiredCollateralAsset;
  const collateralSymbol = isFlexibleCollateral
    ? (selectedCollateralToken ? getTokenSymbol(selectedCollateralToken as Address) : 'Select Token')
    : (offer ? getTokenSymbol(offer.requiredCollateralAsset) : '');
  const collateralDecimals = isFlexibleCollateral
    ? (selectedCollateralToken ? Number(getTokenDecimals(selectedCollateralToken as Address)) : 18)
    : (offer ? Number(getTokenDecimals(offer.requiredCollateralAsset)) : 18);

  // Check if user is the lender (owner of the offer)
  const isLender = offer && address?.toLowerCase() === offer.lender.toLowerCase();

  // Get borrower's collateral balance and allowance
  const { data: borrowerCollateralBalance } = useTokenBalance(activeCollateralToken, address);
  const { data: borrowerCollateralAllowance, refetch: refetchAllowance } = useTokenAllowance(
    activeCollateralToken,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  // Price data for USD values
  const lendPriceHook = useTokenPrice(offer?.lendAsset);
  const collateralPriceHook = useTokenPrice(activeCollateralToken);
  const lendPrice = lendPriceHook.price;
  const collateralPrice = collateralPriceHook.price;

  // Check price staleness (skip collateral price check if no token selected for flexible)
  const isPriceStale = lendPriceHook.isStale || (!isFlexibleCollateral && collateralPriceHook.isStale) ||
    (isFlexibleCollateral && selectedCollateralToken && collateralPriceHook.isStale);

  // Calculate USD values
  const lendUSD = offer && lendPrice
    ? (Number(offer.lendAmount) / Math.pow(10, Number(lendDecimals))) * Number(lendPrice) / 1e8
    : 0;

  // Get LTV from contract (duration is in seconds, convert to days) - moved up for use in calculations
  const durationDays = offer ? Math.ceil(Number(offer.duration) / (24 * 60 * 60)) : 0;
  const { data: ltvBps } = useLTV(activeCollateralToken, durationDays);

  // LTV from contract is in basis points (10000 = 100%)
  const currentLTV = ltvBps ? Number(ltvBps) / 100 : 0;

  // Calculate required collateral from LTV and prices
  // Formula: requiredCollateral = (borrowAmount * borrowPrice / collateralPrice) / (LTV / 10000)
  // Add 5% safety margin to ensure transaction succeeds
  const calculatedCollateralAmount = (() => {
    const ltvValue = ltvBps ? Number(ltvBps) : 0;
    if (!offer || !lendPrice || !collateralPrice || ltvValue === 0) {
      return BigInt(0);
    }
    // borrowAmountUSD = lendAmount * lendPrice / 10^lendDecimals (price has 8 decimals, keep it)
    // requiredCollateralUSD = borrowAmountUSD * 10000 / ltvBps
    // requiredCollateral = requiredCollateralUSD * 10^collateralDecimals / collateralPrice
    const lendAmountBN = BigInt(offer.lendAmount);
    const lendPriceBN = BigInt(lendPrice);
    const collateralPriceBN = BigInt(collateralPrice);
    const ltvBpsBN = BigInt(ltvValue);

    // Calculate: (lendAmount * lendPrice * 10000 * 10^collateralDecimals) / (ltvBps * collateralPrice * 10^lendDecimals)
    const numerator = lendAmountBN * lendPriceBN * BigInt(10000) * BigInt(10 ** collateralDecimals);
    const denominator = ltvBpsBN * collateralPriceBN * BigInt(10 ** lendDecimals);

    if (denominator === BigInt(0)) return BigInt(0);

    // Add 5% safety margin
    const baseAmount = numerator / denominator;
    return (baseAmount * BigInt(105)) / BigInt(100);
  })();

  // For flexible collateral, use calculated amount; otherwise use minimum from offer
  const collateralAmountBigInt = isFlexibleCollateral
    ? calculatedCollateralAmount
    : (offer?.minCollateralAmount || BigInt(0));

  const minCollateralUSD = collateralPrice && collateralAmountBigInt
    ? (Number(collateralAmountBigInt) / Math.pow(10, Number(collateralDecimals))) * Number(collateralPrice) / 1e8
    : 0;

  // The collateral amount - formatted for display
  const requiredCollateralFormatted = collateralAmountBigInt > BigInt(0)
    ? formatTokenAmount(collateralAmountBigInt, collateralDecimals)
    : '0';

  // Balance calculations
  const maxCollateralBalance = borrowerCollateralBalance
    ? formatUnits(borrowerCollateralBalance as bigint, collateralDecimals)
    : '0';
  const maxCollateralBalanceNumber = parseFloat(maxCollateralBalance);

  // Check balance status - for flexible collateral, check against user's input
  const hasZeroBalance = maxCollateralBalanceNumber === 0;
  const hasInsufficientBalance = isFlexibleCollateral
    ? (borrowerCollateralBalance && collateralAmountBigInt
      ? (borrowerCollateralBalance as bigint) < collateralAmountBigInt
      : false)
    : (offer && borrowerCollateralBalance
      ? (borrowerCollateralBalance as bigint) < offer.minCollateralAmount
      : false);

  // Check if already approved - for flexible collateral, check against user's input
  const hasApproval = isFlexibleCollateral
    ? (borrowerCollateralAllowance && collateralAmountBigInt
      ? (borrowerCollateralAllowance as bigint) >= collateralAmountBigInt
      : false)
    : (borrowerCollateralAllowance && offer
      ? (borrowerCollateralAllowance as bigint) >= offer.minCollateralAmount
      : false);

  // For flexible collateral, check if user has selected token and collateral is calculated
  const hasValidFlexibleInput = isFlexibleCollateral
    ? Boolean(selectedCollateralToken && collateralAmountBigInt > BigInt(0))
    : true;

  // Write hooks
  const { approveAsync, isPending: approveIsPending, isConfirming: isApprovalConfirming, isSuccess: approveSuccess } = useApproveToken();
  const { acceptOfferAsync, isPending: acceptIsPending, isConfirming: isAcceptConfirming, isSuccess: acceptSuccess } = useAcceptLenderOffer();

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
    if (isFlexibleCollateral && !selectedCollateralToken) return;
    if (collateralAmountBigInt === BigInt(0)) {
      toast.error('Unable to calculate required collateral. Please ensure prices are loaded.');
      return;
    }
    setSimulationError('');

    const tokenToApprove = isFlexibleCollateral
      ? (selectedCollateralToken as Address)
      : offer.requiredCollateralAsset;

    try {
      // Simulate approval first
      const simulation = await simulateContractWrite({
        address: tokenToApprove,
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
        args: [CONTRACT_ADDRESSES.loanMarketPlace, collateralAmountBigInt],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Simulation failed');
        toast.error(simulation.errorMessage || 'Transaction will fail');
        return;
      }

      await approveAsync(tokenToApprove, CONTRACT_ADDRESSES.loanMarketPlace, collateralAmountBigInt);
      // Transaction submitted - useEffect will handle success
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleAccept = async () => {
    if (!offer || !offerId) return;
    if (isFlexibleCollateral && !selectedCollateralToken) return;
    if (collateralAmountBigInt === BigInt(0)) {
      toast.error('Unable to calculate required collateral. Please ensure prices are loaded.');
      return;
    }
    setIsAccepting(true);
    setSimulationError('');

    // Get the collateral asset - for flexible it's the selected token, otherwise it's from offer
    const collateralAssetToUse = isFlexibleCollateral
      ? (selectedCollateralToken as Address)
      : offer.requiredCollateralAsset;

    // Debug logging
    console.log('Accept Offer Debug:', {
      offerId: offerId.toString(),
      collateralAsset: collateralAssetToUse,
      collateralAmount: collateralAmountBigInt.toString(),
      collateralAmountFormatted: formatUnits(collateralAmountBigInt, collateralDecimals),
      isFlexibleCollateral,
      offerMinCollateral: offer.minCollateralAmount.toString(),
      offerMinCollateralFormatted: formatUnits(offer.minCollateralAmount, collateralDecimals),
      allowance: borrowerCollateralAllowance?.toString(),
      balance: borrowerCollateralBalance?.toString(),
    });

    try {
      // Simulate first
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'acceptLenderOffer',
        args: [offerId, collateralAssetToUse, collateralAmountBigInt],
      });

      if (!simulation.success) {
        setSimulationError(simulation.errorMessage || 'Transaction would fail');
        toast.error(simulation.errorMessage || 'Transaction would fail');
        setIsAccepting(false);
        return;
      }

      await acceptOfferAsync(offerId, collateralAssetToUse, collateralAmountBigInt);
      // Transaction submitted - useEffect will handle success
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
    (isFlexibleCollateral && !hasValidFlexibleInput) ||
    (isFlexibleCollateral && !selectedCollateralToken) ||
    (!isFlexibleCollateral && hasZeroBalance) ||
    (isFlexibleCollateral && selectedCollateralToken && hasZeroBalance) ||
    hasInsufficientBalance ||
    isPriceStale ||
    isAccepting ||
    acceptIsPending ||
    isAcceptConfirming ||
    approveIsPending ||
    isApprovalConfirming;

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
                      {isFlexibleCollateral ? (
                        <p className="text-lg font-semibold text-accent-400">
                          Borrower chooses
                        </p>
                      ) : (
                        <>
                          <p className="text-lg font-semibold">
                            {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol}
                          </p>
                          {minCollateralUSD > 0 && (
                            <p className="text-sm text-gray-500">~${minCollateralUSD.toFixed(2)} USD</p>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Collateral Token</p>
                      {isFlexibleCollateral ? (
                        <p className="text-lg font-semibold text-accent-400">
                          Any supported token
                        </p>
                      ) : (
                        <p className="text-lg font-semibold">
                          {collateralSymbol}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">LTV Ratio</p>
                      {isFlexibleCollateral ? (
                        <p className="text-sm text-gray-500">
                          Depends on collateral chosen
                        </p>
                      ) : (
                        <p className={`text-lg font-semibold ${currentLTV > 80 ? 'text-red-400' : currentLTV > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {currentLTV.toFixed(1)}%
                        </p>
                      )}
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
                      {isFlexibleCollateral ? (
                        <span className="font-medium text-accent-400">You choose</span>
                      ) : (
                        <span className="font-medium">
                          {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">Loan Duration</span>
                      <span className="font-medium">
                        {formatDuration(offer.duration)}
                      </span>
                    </div>
                  </div>

                  {/* Flexible Collateral Selection */}
                  {isFlexibleCollateral && isConnected && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                      <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-3">
                        <p className="text-sm text-accent-400 font-medium">Flexible Collateral</p>
                        <p className="text-xs text-gray-400 mt-1">
                          This offer accepts any supported collateral. Select your token and the required amount will be calculated.
                        </p>
                      </div>

                      {/* Token Selection */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Select Collateral Token</label>
                        <select
                          value={selectedCollateralToken}
                          onChange={(e) => {
                            setSelectedCollateralToken(e.target.value as Address);
                          }}
                          className="w-full input-field bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
                        >
                          <option value="">Select a token</option>
                          {TOKEN_LIST.filter(t => t.symbol !== 'USDC' && t.symbol !== 'USDT' && t.symbol !== 'DAI').map((token) => (
                            <option key={token.address} value={token.address}>
                              {token.symbol}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Calculated Amount Display */}
                      {selectedCollateralToken && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-2">Required Collateral (calculated)</label>
                          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            {collateralAmountBigInt > BigInt(0) ? (
                              <div className="flex justify-between items-center">
                                <span className="text-xl font-bold text-white">
                                  {requiredCollateralFormatted} {collateralSymbol}
                                </span>
                                {minCollateralUSD > 0 && (
                                  <span className="text-sm text-gray-400">~${minCollateralUSD.toFixed(2)} USD</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">Loading prices...</span>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Based on {currentLTV.toFixed(1)}% LTV + 5% safety margin
                            </p>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-2">
                            <span>Your Balance: {maxCollateralBalance} {collateralSymbol}</span>
                            {hasInsufficientBalance && (
                              <span className="text-red-400">Insufficient balance</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Balance Status - for fixed collateral offers */}
                  {!isFlexibleCollateral && isConnected && (
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
                  {isFlexibleCollateral ? (
                    <>
                      <p>
                        This offer accepts any supported collateral token. Select your token and the required amount will be calculated based on current market prices and LTV ratios.
                      </p>
                      <p className="text-accent-400 font-medium">
                        Collateral: Calculated from LTV
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        The collateral amount is fixed by the lender&apos;s offer terms. Your collateral is secured by smart contract.
                      </p>
                      <p className="text-accent-400 font-medium">
                        Required: {formatTokenAmount(offer.minCollateralAmount, collateralDecimals)} {collateralSymbol}
                      </p>
                    </>
                  )}
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

          {/* Collateral Display/Selection */}
          {isFlexibleCollateral ? (
            <div className="space-y-4">
              {/* Token Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Collateral Token</label>
                <select
                  value={selectedCollateralToken}
                  onChange={(e) => {
                    setSelectedCollateralToken(e.target.value as Address);
                  }}
                  className="w-full input-field bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
                >
                  <option value="">Select a token</option>
                  {TOKEN_LIST.filter(t => t.symbol !== 'USDC' && t.symbol !== 'USDT' && t.symbol !== 'DAI').map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Calculated Amount Display */}
              {selectedCollateralToken && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Required Collateral (calculated)</label>
                  <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    {collateralAmountBigInt > BigInt(0) ? (
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-white">
                          {requiredCollateralFormatted} {collateralSymbol}
                        </span>
                        {minCollateralUSD > 0 && (
                          <span className="text-sm text-gray-400">~${minCollateralUSD.toFixed(2)} USD</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Loading prices...</span>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Based on {currentLTV.toFixed(1)}% LTV + 5% safety margin
                    </p>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-400">
                      Balance: {maxCollateralBalance} {collateralSymbol}
                    </span>
                    {currentLTV > 0 && (
                      <span className={`${currentLTV > 80 ? 'text-red-400' : currentLTV > 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                        LTV: {currentLTV.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
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
          )}

          {/* Zero Balance Warning - only show for fixed collateral or when flexible token is selected */}
          {((!isFlexibleCollateral && hasZeroBalance) || (isFlexibleCollateral && selectedCollateralToken && hasZeroBalance)) && (
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
                    You need {requiredCollateralFormatted} {collateralSymbol} but only have {maxCollateralBalance}.
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

          {/* Steps - Only show when balance is sufficient and (for flexible) token is selected */}
          {((!isFlexibleCollateral && !hasZeroBalance && !hasInsufficientBalance && !isPriceStale) ||
            (isFlexibleCollateral && hasValidFlexibleInput && !hasZeroBalance && !hasInsufficientBalance && !isPriceStale)) && (
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

              {/* Approval Explanation */}
              {!hasApproval && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-gray-300">
                    <span className="text-yellow-400 font-medium">Why approve?</span> ERC-20 tokens require you to authorize the contract before it can lock your {collateralSymbol} as collateral. This is a standard security feature that protects your assets.
                  </p>
                </div>
              )}

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
