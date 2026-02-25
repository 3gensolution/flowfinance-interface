'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, Abi, Address } from 'viem';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlertTriangle, Zap } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  useLiquidateLoan,
  useApproveToken,
  useTokenAllowance,
  useTokenBalance,
  useTokenPrice,
  useRepaymentInfo,
  useCanLiquidate,
} from '@/hooks/useContracts';
import { CONTRACT_ADDRESSES, getTokenByAddress } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import { useLoansByBorrower, useLoansByLender } from '@/stores/contractStore';
import { useUIStore } from '@/stores/uiStore';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

type LiquidateStep = 'info' | 'approve' | 'liquidate';

export function LiquidateLoanModal() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Get modal state from store
  const { liquidateModalOpen, liquidateLoanId, closeLiquidateModal } = useUIStore();

  // Get loans from store (liquidator could be anyone)
  const borrowedLoans = useLoansByBorrower(address);
  const lentLoans = useLoansByLender(address);

  // Local state
  const [step, setStep] = useState<LiquidateStep>('info');
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [isApprovingToken, setIsApprovingToken] = useState(false);
  const [simulationError, setSimulationError] = useState('');

  // Find the loan from either borrowed or lent loans
  const selectedLoan = useMemo(() => {
    if (!liquidateLoanId) return null;
    const borrowed = borrowedLoans.find(l => l.loanId === liquidateLoanId);
    if (borrowed) return borrowed;
    const lent = lentLoans.find(l => l.loanId === liquidateLoanId);
    if (lent) return lent;
    return null;
  }, [liquidateLoanId, borrowedLoans, lentLoans]);

  // Contract hooks
  const { liquidate: liquidateWrite, isPending: isLiquidatePending } = useLiquidateLoan();
  const { approveAsync } = useApproveToken();

  // Check if loan can be liquidated
  const { data: canLiquidateData } = useCanLiquidate(liquidateLoanId || undefined);
  const canLiquidate = canLiquidateData as boolean | undefined;

  // Get repayment info (outstanding debt)
  const { data: repaymentInfoData } = useRepaymentInfo(liquidateLoanId || undefined);
  const repaymentInfo = repaymentInfoData as readonly [bigint, bigint, bigint, bigint, bigint, boolean, bigint] | undefined;
  const outstandingDebt = repaymentInfo ? repaymentInfo[0] : BigInt(0);
  const remainingCollateral = repaymentInfo ? repaymentInfo[3] : BigInt(0);

  // Token info
  const borrowTokenInfo = selectedLoan ? getTokenByAddress(selectedLoan.borrowAsset) : null;
  const collateralTokenInfo = selectedLoan ? getTokenByAddress(selectedLoan.collateralAsset) : null;
  const borrowDecimals = borrowTokenInfo?.decimals || 18;
  const collateralDecimals = collateralTokenInfo?.decimals || 18;

  // Prices
  const { price: borrowPrice } = useTokenPrice(selectedLoan?.borrowAsset as Address | undefined);
  const { price: collateralPrice } = useTokenPrice(selectedLoan?.collateralAsset as Address | undefined);

  // Calculate liquidation amounts (mirrors contract logic)
  const liquidationAmounts = useMemo(() => {
    if (!outstandingDebt || !collateralPrice || !borrowPrice || outstandingDebt === BigInt(0)) {
      return null;
    }

    // debtValueUSD = outstandingDebt * borrowPrice / 10^borrowDecimals
    const debtValueUSD = (outstandingDebt * (borrowPrice as bigint)) / BigInt(10 ** borrowDecimals);

    // collateralForDebt = debtValueUSD * 10^collateralDecimals / collateralPrice
    const collateralForDebt = (debtValueUSD * BigInt(10 ** collateralDecimals)) / (collateralPrice as bigint);

    // 5% bonus
    const liquidationBonus = (collateralForDebt * BigInt(500)) / BigInt(10000);
    let collateralToLiquidator = collateralForDebt + liquidationBonus;

    // Cap at remaining collateral
    if (collateralToLiquidator > remainingCollateral) {
      collateralToLiquidator = remainingCollateral;
    }

    const collateralToBorrower = remainingCollateral - collateralToLiquidator;

    return {
      debtToPay: outstandingDebt,
      collateralToLiquidator,
      collateralToBorrower,
      liquidationBonus,
    };
  }, [outstandingDebt, borrowPrice, collateralPrice, borrowDecimals, collateralDecimals, remainingCollateral]);

  // User balance of borrow token (what they need to pay)
  const { data: userTokenBalance } = useTokenBalance(selectedLoan?.borrowAsset, address);
  const userBalance = (userTokenBalance as bigint) || BigInt(0);
  const hasEnoughBalance = userBalance >= outstandingDebt;

  // Allowance
  const { refetch: refetchAllowance } = useTokenAllowance(
    selectedLoan?.borrowAsset,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  // Grace period info (for display only — contract handles enforcement)
  const gracePeriodEnd = selectedLoan ? Number(selectedLoan.gracePeriodEnd) * 1000 : 0;

  const handleClose = useCallback(() => {
    setStep('info');
    setSimulationError('');
    closeLiquidateModal();
  }, [closeLiquidateModal]);

  const handleProceedToApprove = useCallback(() => {
    setStep('approve');
  }, []);

  const handleApprove = useCallback(async () => {
    if (!selectedLoan || !address || !publicClient || outstandingDebt === BigInt(0)) return;

    setIsApprovingToken(true);
    const toastId = toast.loading('Approving token...');

    try {
      // Approve a bit more to cover any rounding
      const amountToApprove = outstandingDebt + (outstandingDebt / BigInt(100));

      const approvalHash = await approveAsync(
        selectedLoan.borrowAsset,
        CONTRACT_ADDRESSES.loanMarketPlace,
        amountToApprove
      );

      toast.loading('Waiting for confirmation...', { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });

      if (receipt.status === 'reverted') {
        toast.error('Approval transaction failed.', { id: toastId });
        setIsApprovingToken(false);
        return;
      }

      toast.loading('Verifying allowance...', { id: toastId });
      const { data: newAllowance } = await refetchAllowance();
      const updatedAllowance = (newAllowance as bigint) || BigInt(0);

      if (updatedAllowance < outstandingDebt) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: retryAllowance } = await refetchAllowance();
        const finalAllowance = (retryAllowance as bigint) || BigInt(0);

        if (finalAllowance < outstandingDebt) {
          toast.error('Allowance not updated. Please try again.', { id: toastId });
          setIsApprovingToken(false);
          return;
        }
      }

      toast.success('Token approved! You can now liquidate.', { id: toastId });
      setStep('liquidate');
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsApprovingToken(false);
    }
  }, [selectedLoan, address, publicClient, outstandingDebt, approveAsync, refetchAllowance]);

  const handleLiquidateSubmit = useCallback(async () => {
    if (!selectedLoan || !address || !publicClient) return;

    setIsLiquidating(true);
    setSimulationError('');
    const toastId = toast.loading('Simulating liquidation...');

    try {
      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'liquidateLoan',
        args: [selectedLoan.loanId],
        account: address,
      });

      if (!simulation.success) {
        const errorMsg = simulation.errorMessage || 'Liquidation simulation failed';
        setSimulationError(errorMsg);
        toast.error(errorMsg, { id: toastId });
        setIsLiquidating(false);
        return;
      }

      toast.loading('Liquidating loan...', { id: toastId });
      liquidateWrite(selectedLoan.loanId);

      // Wait for the transaction - since liquidateWrite is fire-and-forget,
      // we rely on the useWaitForTransactionReceipt in the hook
      toast.success('Liquidation transaction submitted!', { id: toastId });
      handleClose();
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      setSimulationError(errorMsg);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsLiquidating(false);
    }
  }, [selectedLoan, address, publicClient, liquidateWrite, handleClose]);

  if (!selectedLoan) {
    return (
      <Modal isOpen={liquidateModalOpen} onClose={handleClose} title="Liquidate Loan">
        <div className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading loan data...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={liquidateModalOpen} onClose={handleClose} title="Liquidate Loan">
      <div className="space-y-4">
        {/* Loan Info */}
        <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Loan ID</span>
            <span>#{selectedLoan.loanId.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Outstanding Debt</span>
            <span className="text-red-400 font-semibold">
              {formatUnits(outstandingDebt, borrowDecimals)} {borrowTokenInfo?.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Remaining Collateral</span>
            <span>
              {formatUnits(remainingCollateral, collateralDecimals)} {collateralTokenInfo?.symbol}
            </span>
          </div>
          {gracePeriodEnd > 0 && Date.now() <= gracePeriodEnd && (
            <div className="flex justify-between">
              <span className="text-gray-400">Grace Period Ends</span>
              <span className="text-yellow-400">
                {new Date(gracePeriodEnd).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>

        {/* Step Indicator */}
        {step !== 'info' && (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'approve' ? 'bg-primary-500 text-white' : 'bg-green-500 text-white'
            }`}>
              1
            </div>
            <div className={`w-12 h-1 ${step === 'liquidate' ? 'bg-green-500' : 'bg-gray-600'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'liquidate' ? 'bg-primary-500 text-white' : 'bg-gray-600 text-gray-400'
            }`}>
              2
            </div>
          </div>
        )}

        {/* Step: Info */}
        {step === 'info' && (
          <>
            {/* Liquidation breakdown */}
            {liquidationAmounts && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-red-400" />
                  <p className="text-red-400 font-medium">Liquidation Breakdown</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">You Pay (Debt)</span>
                    <span className="font-medium text-white">
                      {formatUnits(liquidationAmounts.debtToPay, borrowDecimals)} {borrowTokenInfo?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">You Receive (Collateral + 5% Bonus)</span>
                    <span className="font-medium text-green-400">
                      {formatUnits(liquidationAmounts.collateralToLiquidator, collateralDecimals)} {collateralTokenInfo?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2">
                    <span className="text-gray-400">Returned to Borrower</span>
                    <span className="font-medium text-yellow-400">
                      {formatUnits(liquidationAmounts.collateralToBorrower, collateralDecimals)} {collateralTokenInfo?.symbol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings */}
            {canLiquidate === false && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-yellow-400 text-sm">
                    This loan cannot be liquidated yet. The health factor may still be above the liquidation threshold.
                  </p>
                </div>
              </div>
            )}

            {!hasEnoughBalance && outstandingDebt > BigInt(0) && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm mb-2">
                  You need {formatUnits(outstandingDebt, borrowDecimals)} {borrowTokenInfo?.symbol} to liquidate this loan.
                  Your balance: {formatUnits(userBalance, borrowDecimals)} {borrowTokenInfo?.symbol}.
                </p>
                <Link
                  href="/faucet"
                  className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 underline"
                  onClick={handleClose}
                >
                  Get testnet tokens from Faucet
                </Link>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleProceedToApprove}
                disabled={!canLiquidate || !hasEnoughBalance || outstandingDebt === BigInt(0)}
                className="flex-1"
              >
                {!canLiquidate ? 'Cannot Liquidate' : !hasEnoughBalance ? 'Insufficient Balance' : 'Proceed to Liquidate'}
              </Button>
            </div>
          </>
        )}

        {/* Step: Approve */}
        {step === 'approve' && (
          <>
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 font-medium mb-1">Token Approval Required</p>
              <p className="text-sm text-gray-400 mb-2">
                You need to approve the loan contract to transfer your {borrowTokenInfo?.symbol} tokens to pay the outstanding debt.
              </p>
              <p className="text-xs text-gray-500">
                This is a one-time approval for this liquidation amount.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setStep('info')}
                className="flex-1"
                disabled={isApprovingToken}
              >
                Back
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isApprovingToken}
                loading={isApprovingToken}
                className="flex-1"
              >
                {isApprovingToken ? 'Approving...' : 'Approve'}
              </Button>
            </div>
          </>
        )}

        {/* Step: Liquidate */}
        {step === 'liquidate' && (
          <>
            {simulationError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium mb-1">Transaction Will Fail</p>
                    <p className="text-sm text-gray-400">{simulationError}</p>
                  </div>
                </div>
              </div>
            )}

            {!simulationError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 font-medium mb-1">Ready to Liquidate</p>
                <p className="text-sm text-gray-400">
                  You will pay {formatUnits(outstandingDebt, borrowDecimals)} {borrowTokenInfo?.symbol} and
                  receive {liquidationAmounts ? formatUnits(liquidationAmounts.collateralToLiquidator, collateralDecimals) : '...'} {collateralTokenInfo?.symbol} (including 5% bonus).
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setStep('info')}
                className="flex-1"
                disabled={isLiquidating}
              >
                Back
              </Button>
              <Button
                variant="danger"
                onClick={handleLiquidateSubmit}
                disabled={isLiquidating || isLiquidatePending}
                loading={isLiquidating || isLiquidatePending}
                className="flex-1"
              >
                {isLiquidating || isLiquidatePending ? 'Liquidating...' : 'Confirm Liquidation'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
