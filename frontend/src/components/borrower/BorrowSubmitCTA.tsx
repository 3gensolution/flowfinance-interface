'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { parseUnits, Address } from 'viem';
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useRouter } from 'next/navigation';
import { CollateralAsset } from './CollateralSelector';
import { BorrowAsset, BorrowType } from './BorrowAssetSelector';
import { ErrorMessage, SuccessModal, TransactionButton, ApprovalInfo } from '@/components/lender';
import {
  useApproveToken,
  useTokenAllowance,
  useCreateLoanRequest,
} from '@/hooks/useContracts';
import { useCreateFiatLoanRequest } from '@/hooks/useFiatLoan';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { Abi } from 'viem';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

interface BorrowSubmitCTAProps {
  collateral: CollateralAsset | null;
  collateralAmount: string;
  borrowAsset: BorrowAsset | null;
  loanAmount: number;
  interestRate: number;
  duration: number;
  isValid: boolean;
  borrowType?: BorrowType;
  fiatAmountCents?: bigint;
  fiatCurrency?: string;
}

type SubmitStep = 'idle' | 'approving' | 'creating' | 'success';

// Currency symbol helper
const getCurrencySymbol = (symbol: string) => {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    EUR: '€',
    GBP: '£',
    USDT: '$',
    USDC: '$',
    DAI: '$',
  };
  return symbols[symbol] || '$';
};

export function BorrowSubmitCTA({
  collateral,
  collateralAmount,
  borrowAsset,
  loanAmount,
  interestRate,
  duration,
  isValid,
  borrowType = 'crypto',
  fiatAmountCents,
  fiatCurrency,
}: BorrowSubmitCTAProps) {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isCryptoCollateral = !!collateral?.address;
  const isCryptoBorrow = borrowType === 'crypto' && borrowAsset?.type === 'crypto' && !!borrowAsset?.address;
  const isFiatBorrow = borrowType === 'cash';

  // Convert duration to seconds for contract call
  const durationSeconds = BigInt(duration * 24 * 60 * 60);

  // Approval hooks
  const { approveAsync, simulateApprove, hash: approveHash, isPending: isApprovePending } = useApproveToken();
  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  // Create loan request hooks (crypto and fiat)
  const { createRequest, hash: createHash, isPending: isCreatePending } = useCreateLoanRequest();
  const { isSuccess: isCreateConfirmed } = useWaitForTransactionReceipt({ hash: createHash });

  // Fiat loan hook
  const { createFiatLoanRequest, hash: fiatCreateHash, isPending: isFiatCreatePending } = useCreateFiatLoanRequest();
  const { isSuccess: isFiatCreateConfirmed } = useWaitForTransactionReceipt({ hash: fiatCreateHash });

  // Determine which contract needs approval based on borrow type
  const approvalContractAddress = isFiatBorrow
    ? CONTRACT_ADDRESSES.fiatLoanBridge
    : CONTRACT_ADDRESSES.loanMarketPlace;

  const tokenAddress = isCryptoCollateral ? (collateral?.address as Address) : undefined;
  const { data: allowanceData, refetch: refetchAllowance } = useTokenAllowance(
    tokenAddress,
    userAddress,
    approvalContractAddress
  );

  const collateralAmountInWei = isCryptoCollateral && collateral && collateralAmount
    ? parseUnits(collateralAmount, collateral.decimals || 18)
    : BigInt(0);

  // Calculate borrow amount in wei (for crypto borrows)
  const borrowDecimals = borrowAsset?.decimals || 6; // Default to 6 for stablecoins
  const borrowAmountInWei = isCryptoBorrow
    ? parseUnits(loanAmount.toString(), borrowDecimals)
    : BigInt(0);

  // Interest rate in basis points (e.g., 10% = 1000 bps)
  const interestRateBps = BigInt(Math.floor(interestRate * 100));

  const currentAllowance = allowanceData != null ? BigInt(allowanceData.toString()) : BigInt(0);
  const needsApproval = isCryptoCollateral && currentAllowance < collateralAmountInWei;

  const isApproving = submitStep === 'approving' || isApprovePending;
  const isCreating = submitStep === 'creating' || isCreatePending || isFiatCreatePending;
  const isProcessing = isApproving || isCreating;

  // Format display values
  const currencySymbol = borrowAsset ? getCurrencySymbol(borrowAsset.symbol) : '$';
  const formatNumber = (num: number) => num.toLocaleString(undefined, { maximumFractionDigits: 0 });

  // Effects - Reset state after approval is confirmed
  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
      setSubmitStep('idle');
    }
  }, [isApproveConfirmed, refetchAllowance]);

  // Effects - Handle create success (both crypto and fiat)
  useEffect(() => {
    if (isCreateConfirmed || isFiatCreateConfirmed) {
      setSubmitStep('success');
      setShowSuccessModal(true);
      setTimeout(() => router.push('/marketplace'), 3000);
    }
  }, [isCreateConfirmed, isFiatCreateConfirmed, router]);

  // Handlers
  const handleApprove = async () => {
    if (!collateral || !userAddress || !collateral.address) return;
    setErrorMessage(null);
    setSubmitStep('approving');

    try {
      const simulation = await simulateApprove(
        collateral.address as Address,
        approvalContractAddress,
        collateralAmountInWei,
        userAddress
      );

      if (!simulation.success) {
        setSubmitStep('idle');
        setErrorMessage(simulation.error || 'Authorization failed. Please try again.');
        return;
      }

      await approveAsync(collateral.address as Address, approvalContractAddress, collateralAmountInWei);
    } catch (err) {
      setSubmitStep('idle');
      setErrorMessage(formatSimulationError(err));
    }
  };

  const handleSubmitRequest = async () => {
    if (!isValid || !collateral || !borrowAsset || !userAddress) return;

    setErrorMessage(null);
    setSubmitStep('creating');

    try {
      if (isFiatBorrow) {
        // Handle fiat/cash loan request
        if (!fiatAmountCents || !fiatCurrency) {
          setSubmitStep('idle');
          setErrorMessage('Fiat amount or currency is missing.');
          return;
        }

        console.log('=== Fiat Loan Request Parameters ===');
        console.log('Collateral Token:', collateral.address);
        console.log('Collateral Amount:', collateralAmountInWei.toString());
        console.log('Fiat Amount (cents):', fiatAmountCents.toString());
        console.log('Currency:', fiatCurrency);
        console.log('Interest Rate (bps):', interestRateBps.toString());
        console.log('Duration (seconds):', durationSeconds.toString());

        // Create the fiat loan request (simulation is handled inside the hook)
        await createFiatLoanRequest(
          collateral.address as Address,
          collateralAmountInWei,
          fiatAmountCents,
          fiatCurrency,
          interestRateBps,
          durationSeconds
        );
      } else {
        // Handle crypto-to-crypto loan request
        if (!isCryptoBorrow) {
          setSubmitStep('idle');
          setErrorMessage('Please select a valid borrow asset.');
          return;
        }

        // Simulate the transaction first
        if (publicClient) {
          console.log('=== Crypto Loan Request Parameters ===');
          console.log('Collateral Token:', collateral.address);
          console.log('Collateral Amount:', collateralAmountInWei.toString());
          console.log('Borrow Token:', borrowAsset.address);
          console.log('Borrow Amount:', borrowAmountInWei.toString());
          console.log('Interest Rate (bps):', interestRateBps.toString());
          console.log('Duration (seconds):', durationSeconds.toString());

          try {
            await publicClient.simulateContract({
              address: CONTRACT_ADDRESSES.loanMarketPlace,
              abi: LoanMarketPlaceABI,
              functionName: 'createLoanRequest',
              args: [
                collateral.address,
                collateralAmountInWei,
                borrowAsset.address,
                borrowAmountInWei,
                interestRateBps,
                durationSeconds
              ],
              account: userAddress,
            });
            console.log('Simulation successful!');
          } catch (simError: unknown) {
            console.error('Simulation failed:', simError);
            const err = simError as { shortMessage?: string; message?: string };
            const errorMsg = err.shortMessage || err.message || 'Transaction will fail. Please check your inputs.';
            setSubmitStep('idle');
            setErrorMessage(errorMsg);
            return;
          }
        }

        // Create the crypto loan request
        await createRequest(
          collateral.address as Address,
          collateralAmountInWei,
          borrowAsset.address as Address,
          borrowAmountInWei,
          interestRateBps,
          durationSeconds
        );
      }
    } catch (err) {
      setSubmitStep('idle');
      setErrorMessage(formatSimulationError(err));
    }
  };

  const handleGoToMarketplace = () => router.push('/marketplace');
  const handleDismissError = () => setErrorMessage(null);

  // Status text
  const getStatusText = () => {
    if (isApproving) return 'Please confirm in your wallet...';
    if (isCreating) return 'Processing your request...';
    if (!errorMessage) return 'Your collateral is held safely until you repay in full.';
    return null;
  };

  const statusText = getStatusText();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl mx-auto space-y-4"
      >
        {/* Approval Info (if collateral needs approval) */}
        {needsApproval && (
          <ApprovalInfo tokenSymbol={collateral?.symbol || ''} />
        )}

        {/* Error Message */}
        {errorMessage && (
          <ErrorMessage
            message={errorMessage}
            title="Request Failed"
            onDismiss={handleDismissError}
          />
        )}

        {/* Buttons */}
        <div className="space-y-3">
          {needsApproval && (
            <TransactionButton
              type="approve"
              tokenSymbol={collateral?.symbol}
              isLoading={isApproving}
              isDisabled={!isValid || isProcessing}
              stepNumber={1}
              onClick={handleApprove}
            />
          )}
          <TransactionButton
            type="submit"
            isLoading={isCreating}
            isDisabled={!isValid || needsApproval || isProcessing}
            isSecondary={needsApproval}
            stepNumber={needsApproval ? 2 : undefined}
            onClick={handleSubmitRequest}
            defaultText="Submit Borrow Request"
            loadingText="Submitting..."
          />
        </div>

        {/* Status Text */}
        {statusText && (
          <p className={`text-sm text-center ${isProcessing ? 'text-white/60' : 'text-white/40'}`}>
            {statusText}
          </p>
        )}
      </motion.div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        amount={`${currencySymbol}${formatNumber(loanAmount)}`}
        tokenSymbol={borrowAsset?.symbol || ''}
        rate={interestRate}
        onGoToMarketplace={handleGoToMarketplace}
      />
    </>
  );
}
