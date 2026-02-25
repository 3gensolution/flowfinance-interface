'use client';

import { useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, usePublicClient } from 'wagmi';
import { Abi } from 'viem';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, LoanStatusBadge } from '@/components/ui/Badge';
import {
  useTokenPrice,
  useRepaymentInfo,
  useHealthFactor,
  useCanLiquidate,
  useLoanExtension,
  useApproveExtension,
} from '@/hooks/useContracts';
import { LoanStatus } from '@/types';
import {
  formatTokenAmount,
  formatPercentage,
  formatDuration,
  formatAddress,
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
  Heart,
  DollarSign,
  Zap,
  CalendarPlus,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { DEFAULT_CHAIN, CONTRACT_ADDRESSES } from '@/config/contracts';
import { useLoansByBorrower, useLoansByLender } from '@/stores/contractStore';
import { useUIStore } from '@/stores/uiStore';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import { RepayLoanModal } from '@/components/loan/RepayLoanModal';
import { LiquidateLoanModal } from '@/components/loan/LiquidateLoanModal';
import { RequestExtensionModal } from '@/components/loan/RequestExtensionModal';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

export default function ActiveLoanDetailPage() {
  const params = useParams();
  const loanId = params.id ? BigInt(params.id as string) : undefined;
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // UI Store for modals
  const { openRepayModal, openLiquidateModal, openExtensionModal } = useUIStore();

  // Get loans from store
  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);

  // Find the loan
  const loan = useMemo(() => {
    if (!loanId) return null;
    const borrowed = borrowedLoans.find(l => l.loanId === loanId);
    if (borrowed) return { ...borrowed, isBorrower: true };
    const lent = lentLoans.find(l => l.loanId === loanId);
    if (lent) return { ...lent, isBorrower: false };
    return null;
  }, [loanId, borrowedLoans, lentLoans]);

  // Token info
  const collateralSymbol = loan ? getTokenSymbol(loan.collateralAsset) : '';
  const borrowSymbol = loan ? getTokenSymbol(loan.borrowAsset) : '';
  const collateralDecimals = loan ? Number(getTokenDecimals(loan.collateralAsset)) : 18;
  const borrowDecimals = loan ? Number(getTokenDecimals(loan.borrowAsset)) : 18;

  // Price data for USD values
  const collateralPriceHook = useTokenPrice(loan?.collateralAsset);
  const borrowPriceHook = useTokenPrice(loan?.borrowAsset);
  const collateralPrice = collateralPriceHook.price;
  const borrowPrice = borrowPriceHook.price;

  // Get repayment info from contract
  const { data: repaymentInfoData } = useRepaymentInfo(loanId);
  const repaymentInfo = repaymentInfoData as readonly [bigint, bigint, bigint, bigint, bigint, boolean, bigint] | undefined;
  const outstandingDebt = repaymentInfo ? repaymentInfo[0] : BigInt(0);
  const amountRepaid = repaymentInfo ? repaymentInfo[1] : BigInt(0);
  const remainingCollateral = repaymentInfo ? repaymentInfo[3] : BigInt(0);
  const collateralReleased = repaymentInfo ? repaymentInfo[4] : BigInt(0);

  // Compute debt in USD (8 decimals) for LTVConfig.getHealthFactor
  const debtUSD8 = useMemo(() => {
    if (!outstandingDebt || outstandingDebt === BigInt(0) || !borrowPrice) return undefined;
    return (outstandingDebt * (borrowPrice as bigint)) / BigInt(10 ** borrowDecimals);
  }, [outstandingDebt, borrowPrice, borrowDecimals]);

  const durationDays = loan ? Math.round(Number(loan.duration) / 86400) : 0;

  // Health factor from LTVConfig.getHealthFactor (returns 1e18 = 100%)
  const { data: healthFactorRaw } = useHealthFactor(
    loan?.collateralAsset,
    remainingCollateral > BigInt(0) ? remainingCollateral : undefined,
    collateralPrice as bigint | undefined,
    debtUSD8,
    durationDays > 0 ? durationDays : undefined
  );
  const healthFactor = healthFactorRaw
    ? Number(healthFactorRaw as bigint) / 1e18
    : 0;

  // Check if loan can be liquidated
  const { data: canLiquidateData } = useCanLiquidate(
    loan?.status === LoanStatus.ACTIVE ? loanId : undefined
  );
  const canLiquidate = canLiquidateData as boolean | undefined;

  // Get loan extension state
  const { data: extensionData, refetch: refetchExtension } = useLoanExtension(
    loan?.status === LoanStatus.ACTIVE ? loanId : undefined
  );
  const extensionInfo = extensionData as readonly [bigint, boolean, boolean] | undefined;
  const extensionAdditionalDuration = extensionInfo ? extensionInfo[0] : BigInt(0);
  const extensionRequested = extensionInfo ? extensionInfo[1] : false;
  const extensionApproved = extensionInfo ? extensionInfo[2] : false;

  // Approve extension hook (for lender)
  const { approveExtension, isPending: isApprovingExtension } = useApproveExtension();

  // Calculate USD values
  const collateralUSD = loan && collateralPrice
    ? (Number(loan.collateralAmount) / Math.pow(10, collateralDecimals)) * Number(collateralPrice) / 1e8
    : 0;
  const borrowUSD = loan && borrowPrice
    ? (Number(loan.principalAmount) / Math.pow(10, borrowDecimals)) * Number(borrowPrice) / 1e8
    : 0;
  const debtUSD = borrowPrice && outstandingDebt > BigInt(0)
    ? (Number(outstandingDebt) / Math.pow(10, borrowDecimals)) * Number(borrowPrice) / 1e8
    : 0;

  // Health status
  const getHealthStatus = () => {
    if (healthFactor >= 1.5) return { status: 'healthy', color: 'text-green-400', bgColor: 'bg-green-500/20' };
    if (healthFactor >= 1.2) return { status: 'warning', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    return { status: 'danger', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  };
  const healthStatus = getHealthStatus();

  // Grace period
  const gracePeriodEnd = loan ? Number(loan.gracePeriodEnd) * 1000 : 0;
  const isGracePeriodExpired = gracePeriodEnd > 0 && Date.now() > gracePeriodEnd;

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied!');
  };

  const handleRepay = () => {
    if (loanId !== undefined) {
      openRepayModal(loanId);
    }
  };

  const handleLiquidate = () => {
    if (loanId !== undefined) {
      openLiquidateModal(loanId);
    }
  };

  const handleRequestExtension = () => {
    if (loanId !== undefined) {
      openExtensionModal(loanId);
    }
  };

  const handleApproveExtension = useCallback(async () => {
    if (!loanId || !address || !publicClient) return;

    const toastId = toast.loading('Simulating approval...');

    try {
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'approveLoanExtension',
        args: [loanId],
        account: address,
      });

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Approval simulation failed';
        toast.error(errorMsg, { id: toastId });
        return;
      }

      toast.loading('Approving extension...', { id: toastId });
      approveExtension(loanId);
      toast.success('Extension approved!', { id: toastId });
      refetchExtension();
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      toast.error(errorMsg, { id: toastId });
    }
  }, [loanId, address, publicClient, approveExtension, refetchExtension]);

  if (!loan) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Loan Not Found</h2>
          <p className="text-gray-400 mb-6">
            This loan doesn&apos;t exist or you don&apos;t have access to view it.
          </p>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isBorrower = loan.isBorrower;
  const dueDate = new Date(Number(loan.dueDate) * 1000);
  const isOverdue = loan.status === LoanStatus.ACTIVE && dueDate < new Date();

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Loan #{loan.loanId.toString()}</h1>
              <LoanStatusBadge status={loan.status} />
              {isBorrower && <Badge variant="info" size="sm">Borrower</Badge>}
              {!isBorrower && <Badge variant="success" size="sm">Lender</Badge>}
            </div>
            <p className="text-gray-400">
              {isBorrower ? 'You borrowed' : 'You lent'}{' '}
              <span className="text-white font-medium">
                {formatTokenAmount(loan.principalAmount, borrowDecimals)} {borrowSymbol}
              </span>
            </p>
          </div>

          <div className="flex gap-2">
            {loan.status === LoanStatus.ACTIVE && isBorrower && (
              <>
                <Button
                  onClick={handleRequestExtension}
                  variant="secondary"
                  icon={<CalendarPlus className="w-4 h-4" />}
                  size="lg"
                >
                  Extend
                </Button>
                <Button
                  onClick={handleRepay}
                  icon={<DollarSign className="w-4 h-4" />}
                  size="lg"
                >
                  Repay Loan
                </Button>
              </>
            )}
            {loan.status === LoanStatus.ACTIVE && !isBorrower && canLiquidate && (
              <Button
                onClick={handleLiquidate}
                variant="danger"
                icon={<Zap className="w-4 h-4" />}
                size="lg"
              >
                Liquidate
              </Button>
            )}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Loan Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <h2 className="text-xl font-bold mb-6">Loan Details</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Principal Amount</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(loan.principalAmount, borrowDecimals)} {borrowSymbol}
                      </p>
                      {borrowUSD > 0 && (
                        <p className="text-sm text-gray-500">~${borrowUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Interest Rate</p>
                      <p className="text-lg font-semibold text-green-400">
                        {formatPercentage(loan.interestRate)} APY
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Duration</p>
                      <p className="text-lg font-semibold">
                        {formatDuration(loan.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Collateral Deposited</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(loan.collateralAmount, collateralDecimals)} {collateralSymbol}
                      </p>
                      {collateralUSD > 0 && (
                        <p className="text-sm text-gray-500">~${collateralUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Remaining Collateral</p>
                      <p className="text-lg font-semibold">
                        {formatTokenAmount(remainingCollateral, collateralDecimals)} {collateralSymbol}
                      </p>
                      {collateralReleased > BigInt(0) && (
                        <p className="text-sm text-green-400">
                          {formatTokenAmount(collateralReleased, collateralDecimals)} released
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Health Factor</p>
                      <p className={`text-lg font-semibold ${healthStatus.color}`}>
                        {healthFactor.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Debt & Repayment Card */}
            {loan.status === LoanStatus.ACTIVE && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="border border-primary-500/30 bg-primary-500/5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-primary-400" />
                    <h3 className="font-semibold">Debt & Repayment</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Outstanding Debt</span>
                      <div className="text-right">
                        <span className="font-medium text-lg">
                          {formatTokenAmount(outstandingDebt, borrowDecimals)} {borrowSymbol}
                        </span>
                        {debtUSD > 0 && (
                          <p className="text-sm text-gray-500">~${debtUSD.toFixed(2)} USD</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400">Amount Repaid</span>
                      <span className="font-medium text-green-400">
                        {formatTokenAmount(amountRepaid, borrowDecimals)} {borrowSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">Repayment Progress</span>
                      <span className="font-medium">
                        {loan.principalAmount > BigInt(0)
                          ? ((Number(amountRepaid) / Number(outstandingDebt + amountRepaid)) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                  </div>

                  {isBorrower && (
                    <Button
                      onClick={handleRepay}
                      className="w-full mt-4"
                      icon={<DollarSign className="w-4 h-4" />}
                    >
                      Make Repayment
                    </Button>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Extension Status Card */}
            {loan.status === LoanStatus.ACTIVE && extensionRequested && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.17 }}
              >
                <Card className={`border ${extensionApproved ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarPlus className={`w-5 h-5 ${extensionApproved ? 'text-green-400' : 'text-yellow-400'}`} />
                    <h3 className="font-semibold">Loan Extension</h3>
                    <Badge variant={extensionApproved ? 'success' : 'warning'} size="sm">
                      {extensionApproved ? 'Approved' : 'Pending Approval'}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Requested Extension</span>
                      <span className="font-medium">{formatDuration(extensionAdditionalDuration)}</span>
                    </div>
                    {extensionApproved && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">New Due Date</span>
                        <span className="font-medium text-green-400">
                          {new Date(Number(loan.dueDate) * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {!extensionApproved && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">New Due Date (if approved)</span>
                        <span className="font-medium text-yellow-400">
                          {new Date((Number(loan.dueDate) + Number(extensionAdditionalDuration)) * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Lender can approve */}
                  {!isBorrower && !extensionApproved && (
                    <Button
                      onClick={handleApproveExtension}
                      className="w-full mt-4"
                      loading={isApprovingExtension}
                      disabled={isApprovingExtension}
                      icon={<CheckCircle className="w-4 h-4" />}
                    >
                      {isApprovingExtension ? 'Approving...' : 'Approve Extension'}
                    </Button>
                  )}

                  {isBorrower && !extensionApproved && (
                    <p className="text-xs text-gray-400 mt-3">
                      Waiting for the lender to approve your extension request.
                    </p>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Parties Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <h2 className="text-xl font-bold mb-6">Parties</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 glass-card rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Borrower</p>
                        <p className="font-mono">{formatAddress(loan.borrower, 6)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isBorrower && <Badge variant="info" size="sm">You</Badge>}
                      <button onClick={() => copyAddress(loan.borrower)} className="p-2 hover:bg-white/10 rounded-lg">
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`${DEFAULT_CHAIN.blockExplorer}/address/${loan.borrower}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 glass-card rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Lender</p>
                        <p className="font-mono">{formatAddress(loan.lender, 6)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isBorrower && <Badge variant="success" size="sm">You</Badge>}
                      <button onClick={() => copyAddress(loan.lender)} className="p-2 hover:bg-white/10 rounded-lg">
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`${DEFAULT_CHAIN.blockExplorer}/address/${loan.lender}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Health Factor Card */}
            {loan.status === LoanStatus.ACTIVE && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className={`border ${healthStatus.status === 'danger' ? 'border-red-500/50' : healthStatus.status === 'warning' ? 'border-yellow-500/50' : 'border-green-500/50'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Heart className={`w-5 h-5 ${healthStatus.color}`} />
                    <h3 className="font-semibold">Health Factor</h3>
                  </div>
                  <div className={`text-4xl font-bold ${healthStatus.color} mb-2`}>
                    {healthFactor.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-400">
                    {healthStatus.status === 'healthy' && 'Your loan is well-collateralized'}
                    {healthStatus.status === 'warning' && 'Consider adding collateral or repaying'}
                    {healthStatus.status === 'danger' && 'At risk of liquidation!'}
                  </p>
                  {healthStatus.status === 'danger' && (
                    <div className="mt-3 p-2 bg-red-500/20 rounded-lg">
                      <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Liquidation imminent
                      </p>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Liquidation Info Card (for lenders on overdue loans) */}
            {loan.status === LoanStatus.ACTIVE && !isBorrower && isOverdue && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Card className="border border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-red-400" />
                    <h3 className="font-semibold">Liquidation</h3>
                  </div>
                  {canLiquidate ? (
                    <>
                      <p className="text-sm text-gray-400 mb-3">
                        This loan can be liquidated. You will pay the outstanding debt and receive collateral + 5% bonus.
                      </p>
                      <Button
                        variant="danger"
                        onClick={handleLiquidate}
                        className="w-full"
                        icon={<Zap className="w-4 h-4" />}
                      >
                        Liquidate Loan
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Loan health factor is still above the liquidation threshold.
                    </p>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Timeline */}
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
                    <span className="text-gray-400">Started</span>
                    <span>{new Date(Number(loan.startTime) * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Due Date</span>
                    <span className={isOverdue ? 'text-red-400' : ''}>
                      {dueDate.toLocaleDateString()}
                      {isOverdue && ' (Overdue)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duration</span>
                    <span>{formatDuration(loan.duration)}</span>
                  </div>
                  {gracePeriodEnd > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Grace Period End</span>
                      <span className={isGracePeriodExpired ? 'text-red-400' : 'text-yellow-400'}>
                        {new Date(gracePeriodEnd).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {isGracePeriodExpired && ' (Expired)'}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <h3 className="font-semibold mb-4">Status</h3>
                <div className="text-center py-4">
                  {loan.status === LoanStatus.ACTIVE && (
                    <>
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                      <p className="text-green-400 font-semibold">Active Loan</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {isBorrower ? 'Make repayments to release collateral' : 'Earning interest on your funds'}
                      </p>
                    </>
                  )}

                  {loan.status === LoanStatus.REPAID && (
                    <>
                      <CheckCircle className="w-12 h-12 text-primary-400 mx-auto mb-2" />
                      <p className="text-primary-400 font-semibold">Fully Repaid</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This loan has been fully repaid
                      </p>
                    </>
                  )}

                  {loan.status === LoanStatus.LIQUIDATED && (
                    <>
                      <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 font-semibold">Liquidated</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This loan was liquidated
                      </p>
                    </>
                  )}

                  {loan.status === LoanStatus.DEFAULTED && (
                    <>
                      <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-2" />
                      <p className="text-orange-400 font-semibold">Defaulted</p>
                      <p className="text-gray-400 text-sm mt-1">
                        This loan has defaulted
                      </p>
                    </>
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
                    Collateral is held in escrow and can be liquidated if the health factor drops below 1.0.
                  </p>
                  <p className="text-accent-400 font-medium">
                    Current Health: {healthFactor.toFixed(2)}
                  </p>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Global Modals */}
      <RepayLoanModal />
      <LiquidateLoanModal />
      <RequestExtensionModal />
    </div>
  );
}
