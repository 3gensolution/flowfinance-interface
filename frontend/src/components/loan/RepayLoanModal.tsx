'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits, Abi, Address } from 'viem';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  useRepayLoan,
  useOutstandingDebt,
  useApproveToken,
  useTokenAllowance,
  useTokenBalance,
  useTokenPrice,
  useRefreshMockPrice,
  useMinRepaymentAmount,
  // useEscrowCollateralInfo,
} from '@/hooks/useContracts';
import { CONTRACT_ADDRESSES, getTokenByAddress } from '@/config/contracts';
import { simulateContractWrite, formatSimulationError } from '@/lib/contractSimulation';
import { useLoansByBorrower } from '@/stores/contractStore';
import { useUIStore } from '@/stores/uiStore';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

type RepayStep = 'input' | 'approve' | 'repay';

export function RepayLoanModal() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Get modal state from store
  const { repayModalOpen, repayLoanId, closeRepayModal } = useUIStore();

  // Get borrowed loans from store
  const borrowedLoans = useLoansByBorrower(address);

  // Local state
  const [repayStep, setRepayStep] = useState<RepayStep>('input');
  const [repayAmount, setRepayAmount] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);
  const [isApprovingToken, setIsApprovingToken] = useState(false);
  const [simulationError, setSimulationError] = useState('');
  const [approvedForLoanId, setApprovedForLoanId] = useState<bigint | null>(null);
  const hasInitializedRepayAmount = useRef(false);

  // Get selected loan
  const selectedLoan = useMemo(() => {
    if (!repayLoanId) return null;
    return borrowedLoans.find(l => l.loanId === repayLoanId) || null;
  }, [repayLoanId, borrowedLoans]);

  // Contract hooks
  const { repayAsync, isPending: isRepayPending } = useRepayLoan();
  const { approveAsync } = useApproveToken();

  // Get outstanding debt from contract - this is the remaining debt after partial repayments
  const {
    data: outstandingDebtData,
    isLoading: isLoadingOutstandingDebt,
    refetch: refetchOutstandingDebt
  } = useOutstandingDebt(repayLoanId || undefined);
  const outstandingDebt = outstandingDebtData ? outstandingDebtData as bigint : BigInt(0);

  // Get minimum repayment amount from config (in USD with 8 decimals)
  const { data: minRepaymentAmountUSD, isLoading: isLoadingMinRepayment } = useMinRepaymentAmount();
  const minRepaymentUSD = minRepaymentAmountUSD ? Number(minRepaymentAmountUSD) / 1e8 : 1; // Default $1

  const { refetch: refetchAllowance } = useTokenAllowance(
    selectedLoan?.borrowAsset,
    address,
    CONTRACT_ADDRESSES.loanMarketPlace
  );

  const { data: userTokenBalance } = useTokenBalance(
    selectedLoan?.borrowAsset,
    address
  );

  const borrowAssetPrice = useTokenPrice(selectedLoan?.borrowAsset as Address | undefined);
  const isPriceStale = borrowAssetPrice.isStale;
  const priceFeedAddress = borrowAssetPrice.priceFeedAddress as Address | undefined;
  const currentPrice = borrowAssetPrice.price;

  // const { data: escrowInfo } = useEscrowCollateralInfo(repayLoanId || undefined);
  // const escrowCollateralAmount = escrowInfo ? (escrowInfo as readonly [Address, bigint, Address])[1] : BigInt(0);

  const { refreshPrice, isPending: isRefreshingPrice } = useRefreshMockPrice();

  // Computed values
  const selectedTokenInfo = selectedLoan ? getTokenByAddress(selectedLoan.borrowAsset) : null;
  const userBalance = (userTokenBalance as bigint) || BigInt(0);
  const hasBalance = userBalance > BigInt(0);

  // Use outstandingDebt directly from contract - no manual calculation needed
  const remainingToRepay = outstandingDebt;

  const formattedUserBalance = selectedTokenInfo && userBalance > BigInt(0)
    ? formatUnits(userBalance, selectedTokenInfo.decimals)
    : '0';
  const formattedRemainingToRepay = selectedTokenInfo && remainingToRepay > BigInt(0)
    ? formatUnits(remainingToRepay, selectedTokenInfo.decimals)
    : '0';

  const getRepayAmountBigInt = useCallback(() => {
    if (!selectedLoan || !repayAmount) return BigInt(0);
    const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
    if (!tokenInfo) return BigInt(0);
    try {
      return parseUnits(repayAmount, tokenInfo.decimals);
    } catch {
      return BigInt(0);
    }
  }, [selectedLoan, repayAmount]);

  const repayAmountBigInt = getRepayAmountBigInt();

  // Check if amount is close to full repayment (within 0.1% tolerance)
  // This handles precision issues when user clicks "Max" and the formatted value is parsed back
  const tolerance = remainingToRepay > BigInt(0) ? remainingToRepay / BigInt(1000) : BigInt(0);
  const isCloseToFull = repayAmountBigInt >= remainingToRepay - tolerance;
  const isPartialRepayment = remainingToRepay > BigInt(0) && repayAmountBigInt > BigInt(0) && !isCloseToFull;

  // Calculate minimum repayment in token terms (from USD)
  // minRepaymentUSD is in USD, currentPrice is in 8 decimals (e.g., 1e8 = $1)
  const minRepaymentTokens = useMemo(() => {
    if (!currentPrice || !selectedTokenInfo) return BigInt(0);
    // Convert USD to token amount: (minUSD * 10^8 * 10^decimals) / price
    const minUSDScaled = BigInt(Math.floor(minRepaymentUSD * 1e8));
    return (minUSDScaled * BigInt(10 ** selectedTokenInfo.decimals)) / BigInt(currentPrice);
  }, [currentPrice, selectedTokenInfo, minRepaymentUSD]);

  const formattedMinRepayment = selectedTokenInfo && minRepaymentTokens > BigInt(0)
    ? formatUnits(minRepaymentTokens, selectedTokenInfo.decimals)
    : '0';

  // Validation: check if amount exceeds debt
  const exceedsDebt = repayAmountBigInt > remainingToRepay;

  // Validation: check if partial repayment is below minimum (only for partial)
  const isBelowMinimum = isPartialRepayment && repayAmountBigInt > BigInt(0) && repayAmountBigInt < minRepaymentTokens;

  // Check if calculation is still loading
  const isCalculationPending = isLoadingOutstandingDebt || isLoadingMinRepayment;

  // Reset state when modal opens
  const handleClose = useCallback(() => {
    setRepayStep('input');
    setRepayAmount('');
    setSimulationError('');
    hasInitializedRepayAmount.current = false;
    closeRepayModal();
  }, [closeRepayModal]);

  // Initialize repay amount when modal opens with new loan
  if (repayModalOpen && selectedLoan && remainingToRepay > BigInt(0) && selectedTokenInfo && !hasInitializedRepayAmount.current) {
    const formattedAmount = formatUnits(remainingToRepay, selectedTokenInfo.decimals);
    setRepayAmount(formattedAmount);
    hasInitializedRepayAmount.current = true;
    // Reset approval if different loan
    if (approvedForLoanId !== repayLoanId) {
      setApprovedForLoanId(null);
    }
    setTimeout(() => refetchAllowance(), 100);
  }

  // Reset initialization flag when modal closes
  if (!repayModalOpen && hasInitializedRepayAmount.current) {
    hasInitializedRepayAmount.current = false;
  }

  // Handlers
  const handleProceedToApproveOrRepay = useCallback(async () => {
    if (!hasBalance) {
      toast.error(`You don't have any ${selectedTokenInfo?.symbol || 'tokens'} to repay with.`);
      return;
    }

    if (repayAmountBigInt === BigInt(0)) {
      toast.error('Please enter an amount to repay.');
      return;
    }

    // Always go to approve step first
    setRepayStep('approve');
  }, [hasBalance, selectedTokenInfo, repayAmountBigInt]);

  const handleApprove = useCallback(async () => {
    if (!selectedLoan || !repayAmount || !address || !publicClient) return;

    setIsApprovingToken(true);
    const toastId = toast.loading('Approving token...');

    try {
      const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
      if (!tokenInfo) throw new Error('Token not found');

      const baseAmount = parseUnits(repayAmount, tokenInfo.decimals);
      const amountToApprove = baseAmount + (baseAmount / BigInt(100));

      const approvalHash = await approveAsync(
        selectedLoan.borrowAsset,
        CONTRACT_ADDRESSES.loanMarketPlace,
        amountToApprove
      );

      toast.loading('Waiting for confirmation...', { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });

      if (receipt.status === 'reverted') {
        toast.error('Approval transaction failed. Please try again.', { id: toastId });
        setIsApprovingToken(false);
        return;
      }

      toast.loading('Verifying allowance...', { id: toastId });
      const { data: newAllowance } = await refetchAllowance();

      const updatedAllowance = (newAllowance as bigint) || BigInt(0);
      if (updatedAllowance < amountToApprove) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: retryAllowance } = await refetchAllowance();
        const finalAllowance = (retryAllowance as bigint) || BigInt(0);

        if (finalAllowance < amountToApprove) {
          toast.error('Allowance not updated. Please try again.', { id: toastId });
          setIsApprovingToken(false);
          return;
        }
      }

      toast.success('Token approved! You can now repay.', { id: toastId });
      setApprovedForLoanId(repayLoanId);
      setRepayStep('repay');
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsApprovingToken(false);
    }
  }, [selectedLoan, repayAmount, address, publicClient, approveAsync, refetchAllowance, repayLoanId]);

  const handleRefreshPrice = useCallback(async () => {
    if (!priceFeedAddress || !currentPrice || !selectedLoan?.borrowAsset) {
      toast.error('Price feed not available');
      return;
    }

    const toastId = toast.loading('Refreshing price feed...');
    try {
      const hash = await refreshPrice(priceFeedAddress, currentPrice, selectedLoan.borrowAsset);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await borrowAssetPrice.refetch();
      toast.success('Price feed refreshed!', { id: toastId });
      setSimulationError('');
    } catch (error: unknown) {
      const errorMsg = formatSimulationError(error);
      toast.error(`Failed to refresh price: ${errorMsg}`, { id: toastId });
    }
  }, [priceFeedAddress, currentPrice, selectedLoan?.borrowAsset, refreshPrice, publicClient, borrowAssetPrice]);

  const handleRepaySubmit = useCallback(async () => {
    if (!selectedLoan || !repayAmount || !address || !publicClient) return;

    const tokenInfo = getTokenByAddress(selectedLoan.borrowAsset);
    if (!tokenInfo) return;

    let amountToRepay = parseUnits(repayAmount, tokenInfo.decimals);

    setIsRepaying(true);
    setSimulationError('');
    const toastId = toast.loading('Verifying repayment amount...');

    try {
      // First, refetch the latest outstanding debt from contract
      const { data: latestOutstandingData } = await refetchOutstandingDebt();
      const latestRemainingDebt = latestOutstandingData ? latestOutstandingData as bigint : BigInt(0);

      // Handle precision issues: if amount is very close to remaining debt (within 0.1%),
      // treat it as full repayment to avoid the minimum repayment check blocking small remainders
      const tolerance = latestRemainingDebt / BigInt(1000); // 0.1% tolerance
      const isCloseToFull = amountToRepay >= latestRemainingDebt - tolerance && amountToRepay <= latestRemainingDebt + tolerance;

      if (isCloseToFull || amountToRepay >= latestRemainingDebt) {
        // Use exact remaining debt for full repayment to avoid precision issues
        amountToRepay = latestRemainingDebt;
      }

      // Validate: amount should not exceed remaining debt
      if (amountToRepay > latestRemainingDebt) {
        toast.error(`Amount exceeds remaining debt. Max: ${formatUnits(latestRemainingDebt, tokenInfo.decimals)} ${tokenInfo.symbol}`, { id: toastId });
        setIsRepaying(false);
        return;
      }

      // For partial repayments, validate against minimum
      const isPartial = amountToRepay < latestRemainingDebt;
      if (isPartial && minRepaymentTokens > BigInt(0) && amountToRepay < minRepaymentTokens) {
        toast.error(`Partial repayment below minimum. Min: ${formattedMinRepayment} ${tokenInfo.symbol} (~$${minRepaymentUSD})`, { id: toastId });
        setIsRepaying(false);
        return;
      }

      toast.loading('Simulating transaction...', { id: toastId });

      const simulation = await simulateContractWrite({
        address: CONTRACT_ADDRESSES.loanMarketPlace,
        abi: LoanMarketPlaceABI,
        functionName: 'repayLoan',
        args: [selectedLoan.loanId, amountToRepay],
        account: address,
      });

      if (!simulation.success) {
        let errorMsg = simulation.errorMessage || 'Transaction simulation failed';

        if (simulation.error) {
          const rawError = simulation.error as Error & {
            cause?: { data?: { errorName?: string } };
            shortMessage?: string;
          };

          // Check for custom contract error name in cause.data.errorName
          const customErrorName = rawError.cause?.data?.errorName;
          if (customErrorName) {
            // Map custom error names to user-friendly messages
            const errorMessages: Record<string, string> = {
              'RepaymentBelowMinimum': `Repayment amount is below the minimum. Minimum: ${formattedMinRepayment} ${selectedTokenInfo?.symbol} (~$${minRepaymentUSD.toFixed(2)})`,
              'AmountExceedsDebt': 'Amount exceeds remaining debt',
              'LoanNotActive': 'This loan is not active',
              'OnlyBorrowerCanRepay': 'Only the borrower can repay this loan',
              'AmountMustBeGreaterThanZero': 'Amount must be greater than zero',
            };
            errorMsg = errorMessages[customErrorName] || customErrorName;
          } else if (rawError.message && rawError.message.includes('revert')) {
            const revertMatch = rawError.message.match(/revert[:\s]*(.*?)(?:\n|$)/i);
            if (revertMatch && revertMatch[1]) {
              errorMsg = revertMatch[1].trim();
            }
          } else if (rawError.shortMessage) {
            errorMsg = rawError.shortMessage;
          }
        }

        setSimulationError(errorMsg);
        toast.error(errorMsg, { id: toastId });
        setIsRepaying(false);
        return;
      }

      toast.loading('Repaying loan...', { id: toastId });
      const repayHash = await repayAsync(selectedLoan.loanId, amountToRepay);

      toast.loading('Waiting for confirmation...', { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: repayHash });

      if (receipt.status === 'reverted') {
        toast.error('Transaction reverted. Please try again.', { id: toastId });
        return;
      }

      toast.success('Loan repaid successfully!', { id: toastId });
      handleClose();
    } catch (error: unknown) {
      let errorMsg = formatSimulationError(error);

      // Check for custom contract error in catch block as well
      const err = error as Error & {
        cause?: { data?: { errorName?: string } };
      };
      const customErrorName = err.cause?.data?.errorName;
      if (customErrorName) {
        const errorMessages: Record<string, string> = {
          'RepaymentBelowMinimum': `Repayment amount is below the minimum. Minimum: ${formattedMinRepayment} ${selectedTokenInfo?.symbol} (~$${minRepaymentUSD.toFixed(2)})`,
          'AmountExceedsDebt': 'Amount exceeds remaining debt',
          'LoanNotActive': 'This loan is not active',
          'OnlyBorrowerCanRepay': 'Only the borrower can repay this loan',
          'AmountMustBeGreaterThanZero': 'Amount must be greater than zero',
        };
        errorMsg = errorMessages[customErrorName] || customErrorName;
      }

      setSimulationError(errorMsg);
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsRepaying(false);
    }
  }, [selectedLoan, repayAmount, address, publicClient, repayAsync, handleClose, refetchOutstandingDebt, minRepaymentTokens, formattedMinRepayment, minRepaymentUSD, selectedTokenInfo]);

  if (!selectedLoan) {
    return (
      <Modal isOpen={repayModalOpen} onClose={handleClose} title="Repay Loan">
        <div className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-gray-400">Loading loan data...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={repayModalOpen} onClose={handleClose} title="Repay Loan">
      <div className="space-y-4">
        {/* Loan Info */}
        <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Loan ID</span>
            <span>#{selectedLoan.loanId.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Principal</span>
            <span>
              {formatUnits(
                selectedLoan.principalAmount,
                getTokenByAddress(selectedLoan.borrowAsset)?.decimals || 18
              )} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Debt (with interest)</span>
            <span className="text-primary-400 font-semibold">
              {outstandingDebt > BigInt(0) || selectedLoan.amountRepaid > BigInt(0)
                ? formatUnits(
                    outstandingDebt + selectedLoan.amountRepaid,
                    getTokenByAddress(selectedLoan.borrowAsset)?.decimals || 18
                  )
                : '...'
              } {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Already Repaid</span>
            <span>
              {formatUnits(
                selectedLoan.amountRepaid,
                getTokenByAddress(selectedLoan.borrowAsset)?.decimals || 18
              )} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
            <span className="text-gray-400 font-medium">Remaining to Repay</span>
            <span className="text-primary-400 font-bold">
              {formattedRemainingToRepay} {selectedTokenInfo?.symbol}
            </span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-gray-400">Your Balance</span>
            <span className={`font-semibold ${hasBalance ? 'text-green-400' : 'text-red-400'}`}>
              {formattedUserBalance} {selectedTokenInfo?.symbol}
            </span>
          </div>
          {userBalance < remainingToRepay && hasBalance && (
            <p className="text-xs text-yellow-500 mt-1">
              Your balance is less than the remaining amount. You can make a partial repayment.
            </p>
          )}
        </div>
        {/* Step Indicator */}
        {repayStep !== 'input' && (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              repayStep === 'approve' ? 'bg-primary-500 text-white' : 'bg-green-500 text-white'
            }`}>
              1
            </div>
            <div className={`w-12 h-1 ${repayStep === 'repay' ? 'bg-green-500' : 'bg-gray-600'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              repayStep === 'repay' ? 'bg-primary-500 text-white' : 'bg-gray-600 text-gray-400'
            }`}>
              2
            </div>
          </div>
        )}

        {/* Step: Input Amount */}
        {repayStep === 'input' && (
          <>
            {/* Loading state for calculation */}
            {isCalculationPending && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-blue-400 text-sm">
                    Calculating repayment amount from contract...
                  </p>
                </div>
              </div>
            )}

            {!isCalculationPending && (
              <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Total Amount Due (from contract)</p>
                <p className="text-2xl font-bold text-primary-400">
                  {formattedRemainingToRepay} {selectedTokenInfo?.symbol}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Principal + accrued interest. You can pay partially or in full.
                </p>
              </div>
            )}

            {/* Minimum repayment info */}
            {!isCalculationPending && minRepaymentTokens > BigInt(0) && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  <strong>Minimum partial repayment:</strong> {formattedMinRepayment} {selectedTokenInfo?.symbol} (~${minRepaymentUSD.toFixed(2)} USD)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Partial repayments must be at least this amount. Full repayment has no minimum.
                </p>
              </div>
            )}

            {/* Price stale warning - show early so user can refresh before proceeding */}
            {isPriceStale && (
              <div className={`p-4 ${isPartialRepayment ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30'} border rounded-lg`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 ${isPartialRepayment ? 'text-red-400' : 'text-orange-400'} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1">
                    <p className={`${isPartialRepayment ? 'text-red-400' : 'text-orange-400'} font-medium mb-1`}>Price Data is Stale</p>
                    <p className="text-sm text-gray-400 mb-3">
                      {isPartialRepayment
                        ? 'The price feed data is older than 15 minutes. Partial repayments require fresh price data. Please refresh before continuing.'
                        : 'The price feed data is older than 15 minutes. Full repayments do not require fresh price data, but you can refresh if needed.'}
                    </p>
                    <Button
                      size="sm"
                      onClick={handleRefreshPrice}
                      disabled={isRefreshingPrice || !priceFeedAddress}
                      loading={isRefreshingPrice}
                      className="w-full"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
                      {isRefreshingPrice ? 'Refreshing...' : 'Refresh Price Feed'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!hasBalance && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm mb-2">
                  You don&apos;t have any {selectedTokenInfo?.symbol || 'tokens'} to repay with.
                </p>
                <Link
                  href="/faucet"
                  className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 underline"
                  onClick={handleClose}
                >
                  Get testnet tokens from Faucet →
                </Link>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Repayment Amount
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className={`input-field flex-1 ${exceedsDebt ? 'border-red-500' : isBelowMinimum ? 'border-yellow-500' : ''}`}
                  disabled={!hasBalance || isCalculationPending}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRepayAmount(formattedMinRepayment)}
                  disabled={!hasBalance || isCalculationPending || minRepaymentTokens === BigInt(0)}
                  title="Set to minimum repayment"
                >
                  Min
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setRepayAmount(formattedRemainingToRepay)}
                  disabled={!hasBalance || isCalculationPending || remainingToRepay === BigInt(0)}
                  title="Set to full repayment"
                >
                  Max
                </Button>
              </div>

              {/* Validation errors */}
              {exceedsDebt && (
                <p className="text-xs text-red-400 mt-1">
                  Amount exceeds remaining debt. Maximum: {formattedRemainingToRepay} {selectedTokenInfo?.symbol}
                </p>
              )}
              {isBelowMinimum && !exceedsDebt && (
                <p className="text-xs text-yellow-400 mt-1">
                  Partial repayment below minimum. Min: {formattedMinRepayment} {selectedTokenInfo?.symbol} or pay in full.
                </p>
              )}
              {!exceedsDebt && !isBelowMinimum && (
                <p className="text-xs text-gray-500 mt-1">
                  Your balance: {formattedUserBalance} {selectedTokenInfo?.symbol}
                  {hasBalance && userBalance < remainingToRepay && (
                    <span className="text-yellow-400 ml-2">(partial repayment possible)</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToApproveOrRepay}
                disabled={!hasBalance || !repayAmount || repayAmountBigInt === BigInt(0) || isCalculationPending || exceedsDebt || isBelowMinimum || (isPriceStale && isPartialRepayment)}
                className="flex-1"
              >
                {isCalculationPending ? 'Calculating...' : !hasBalance ? 'No Balance' : exceedsDebt ? 'Exceeds Debt' : isBelowMinimum ? 'Below Minimum' : (isPriceStale && isPartialRepayment) ? 'Refresh Price First' : 'Continue'}
              </Button>
            </div>
          </>
        )}

        {/* Step: Approve Token */}
        {repayStep === 'approve' && (
          <>
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 font-medium mb-1">Token Approval Required</p>
              <p className="text-sm text-gray-400 mb-2">
                Before you can repay this loan, you need to approve the loan contract to transfer your {getTokenByAddress(selectedLoan.borrowAsset)?.symbol} tokens.
              </p>
              <p className="text-xs text-gray-500">
                <strong>Why is this needed?</strong> ERC-20 tokens require a two-step process: first you approve the contract to access your tokens, then you can complete the repayment.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setRepayStep('input')}
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

        {/* Step: Repay */}
        {repayStep === 'repay' && (
          <>
            {isPriceStale && isPartialRepayment && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-400 font-medium mb-1">Price Data is Stale</p>
                    <p className="text-sm text-gray-400 mb-3">
                      The price feed data is older than 15 minutes. Partial repayments require fresh price data.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleRefreshPrice}
                      disabled={isRefreshingPrice}
                      loading={isRefreshingPrice}
                      className="w-full"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
                      {isRefreshingPrice ? 'Refreshing...' : 'Refresh Price Feed'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {simulationError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium mb-1">Transaction Will Fail</p>
                    <p className="text-sm text-gray-400">{simulationError}</p>
                    {simulationError.toLowerCase().includes('stale') && priceFeedAddress && currentPrice && (
                      <Button
                        size="sm"
                        onClick={handleRefreshPrice}
                        disabled={isRefreshingPrice}
                        loading={isRefreshingPrice}
                        className="mt-3 w-full"
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingPrice ? 'animate-spin' : ''}`} />
                        {isRefreshingPrice ? 'Refreshing...' : 'Refresh Price Feed'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isPriceStale && !simulationError && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 font-medium mb-1">Ready to Repay</p>
                <p className="text-sm text-gray-400">
                  You are about to repay {repayAmount} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol} to your loan.
                  {!isPartialRepayment && ' This is a full repayment - all collateral will be returned.'}
                </p>
              </div>
            )}

            {isPriceStale && !isPartialRepayment && !simulationError && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 font-medium mb-1">Ready to Repay</p>
                <p className="text-sm text-gray-400">
                  You are about to fully repay {repayAmount} {getTokenByAddress(selectedLoan.borrowAsset)?.symbol}.
                  Full repayments do not require price data.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setRepayStep('input')}
                className="flex-1"
                disabled={isRepaying}
              >
                Back
              </Button>
              <Button
                onClick={handleRepaySubmit}
                disabled={isRepaying || isRepayPending || (isPriceStale && isPartialRepayment)}
                loading={isRepaying || isRepayPending}
                className="flex-1"
              >
                {isRepaying || isRepayPending ? 'Repaying...' : 'Confirm Repay'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
