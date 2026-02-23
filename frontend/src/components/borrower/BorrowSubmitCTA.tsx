'use client';

import { useState, useEffect } from 'react';
import { parseUnits, Address, Abi } from 'viem';
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useNetwork } from '@/contexts/NetworkContext';
import { CollateralAsset } from './CollateralSelector';
import { BorrowAsset, BorrowType } from './BorrowAssetSelector';
import { TransactionFlow } from '@/components/ui/TransactionFlow';
import {
  useApproveToken,
  useTokenAllowance,
  useCreateLoanRequest,
  useInitiateCrossChainLoanRequest,
} from '@/hooks/useContracts';
import { useCreateFiatLoanRequest } from '@/hooks/useFiatLoan';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { formatSimulationError } from '@/lib/contractSimulation';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import CrossChainLoanManagerABIJson from '@/contracts/CrossChainLoanManagerABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
const CrossChainLoanManagerABI = CrossChainLoanManagerABIJson as Abi;

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
  targetChainId?: number;
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
  targetChainId,
}: BorrowSubmitCTAProps) {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const { selectedNetwork } = useNetwork();
  const publicClient = usePublicClient();
  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isCryptoCollateral = !!collateral?.address;
  const isCryptoBorrow = borrowType === 'crypto' && borrowAsset?.type === 'crypto' && !!borrowAsset?.address;
  const isFiatBorrow = borrowType === 'cash';
  const isCrossChain = !!(targetChainId && targetChainId !== selectedNetwork?.id);

  // Convert duration to seconds for contract call
  const durationSeconds = BigInt(duration * 24 * 60 * 60);

  // Approval hooks
  const { approveAsync, simulateApprove, hash: approveHash, isPending: isApprovePending } = useApproveToken();
  const { isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  // Create loan request hooks (crypto and fiat)
  const { createRequest, hash: createHash, isPending: isCreatePending } = useCreateLoanRequest();
  const { isSuccess: isCreateConfirmed } = useWaitForTransactionReceipt({ hash: createHash });

  // Cross-chain loan request hook
  const { initiateRequest: initiateCrossChain, hash: crossChainHash, isPending: isCrossChainPending } = useInitiateCrossChainLoanRequest();
  const { isSuccess: isCrossChainConfirmed } = useWaitForTransactionReceipt({ hash: crossChainHash });

  // Fiat loan hook
  const { createFiatLoanRequest, hash: fiatCreateHash, isPending: isFiatCreatePending } = useCreateFiatLoanRequest();
  const { isSuccess: isFiatCreateConfirmed } = useWaitForTransactionReceipt({ hash: fiatCreateHash });

  // Determine which contract needs approval based on borrow type
  // Cross-chain: approve CrossChainLoanManager (it transfers collateral to marketplace)
  const approvalContractAddress = isFiatBorrow
    ? CONTRACT_ADDRESSES.fiatLoanBridge
    : isCrossChain
    ? CONTRACT_ADDRESSES.crossChainManager
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
  const borrowDecimals = borrowAsset?.decimals || 6;
  const borrowAmountInWei = isCryptoBorrow
    ? parseUnits(loanAmount.toString(), borrowDecimals)
    : BigInt(0);

  // Interest rate in basis points (e.g., 10% = 1000 bps)
  const interestRateBps = BigInt(Math.floor(interestRate * 100));

  const currentAllowance = allowanceData != null ? BigInt(allowanceData.toString()) : BigInt(0);
  const needsApproval = isCryptoCollateral && currentAllowance < collateralAmountInWei;

  const isApproving = submitStep === 'approving' || isApprovePending;
  const isCreating = submitStep === 'creating' || isCreatePending || isFiatCreatePending || isCrossChainPending;

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

  // Effects - Handle create success (crypto, fiat, and cross-chain)
  useEffect(() => {
    if (isCreateConfirmed || isFiatCreateConfirmed || isCrossChainConfirmed) {
      setSubmitStep('success');
      setShowSuccessModal(true);
      setTimeout(() => router.push('/marketplace'), 3000);
    }
  }, [isCreateConfirmed, isFiatCreateConfirmed, isCrossChainConfirmed, router]);

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

        await createFiatLoanRequest(
          collateral.address as Address,
          collateralAmountInWei,
          fiatAmountCents,
          fiatCurrency,
          interestRateBps,
          durationSeconds
        );
      } else if (isCrossChain && targetChainId) {
        // Cross-chain crypto borrow
        if (!isCryptoBorrow) {
          setSubmitStep('idle');
          setErrorMessage('Please select a valid borrow asset.');
          return;
        }

        if (publicClient) {
          console.log('=== Cross-Chain Loan Request Parameters ===');
          console.log('Target Chain:', targetChainId);
          console.log('Collateral Token:', collateral.address);
          console.log('Collateral Amount:', collateralAmountInWei.toString());
          console.log('Borrow Token (target chain):', borrowAsset.address);
          console.log('Borrow Amount:', borrowAmountInWei.toString());
          console.log('Interest Rate (bps):', interestRateBps.toString());
          console.log('Duration (seconds):', durationSeconds.toString());

          try {
            await publicClient.simulateContract({
              address: CONTRACT_ADDRESSES.crossChainManager,
              abi: CrossChainLoanManagerABI,
              functionName: 'initiateCrossChainLoanRequest',
              args: [
                BigInt(targetChainId),
                collateral.address,
                collateralAmountInWei,
                borrowAsset.address,
                borrowAmountInWei,
                interestRateBps,
                durationSeconds
              ],
              account: userAddress,
            });
            console.log('Cross-chain simulation successful!');
          } catch (simError: unknown) {
            console.error('Cross-chain simulation failed:', simError);
            const err = simError as { shortMessage?: string; message?: string };
            const errorMsg = err.shortMessage || err.message || 'Transaction will fail. Please check your inputs.';
            setSubmitStep('idle');
            setErrorMessage(errorMsg);
            return;
          }
        }

        await initiateCrossChain(
          BigInt(targetChainId),
          collateral.address as Address,
          collateralAmountInWei,
          borrowAsset.address as Address,
          borrowAmountInWei,
          interestRateBps,
          durationSeconds
        );
      } else {
        // Same-chain crypto borrow
        if (!isCryptoBorrow) {
          setSubmitStep('idle');
          setErrorMessage('Please select a valid borrow asset.');
          return;
        }

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

  return (
    <TransactionFlow
      needsApproval={needsApproval}
      tokenSymbol={collateral?.symbol || ''}
      approvalSafetyNote="Your collateral is held safely until you repay in full."
      isApproving={isApproving}
      isCreating={isCreating}
      isValid={isValid}
      errorMessage={errorMessage}
      errorTitle="Request Failed"
      onDismissError={handleDismissError}
      onApprove={handleApprove}
      onSubmit={handleSubmitRequest}
      submitText="Submit Borrow Request"
      submitLoadingText="Submitting..."
      statusText={getStatusText()}
      showSuccess={showSuccessModal}
      successTitle={isCrossChain ? "Cross-Chain Request Submitted!" : "Borrow Request Submitted!"}
      successMessage={isCrossChain
        ? `Your cross-chain borrow request for ${currencySymbol}${formatNumber(loanAmount)} ${borrowAsset?.symbol || ''} has been submitted. The relay will process it shortly.`
        : `Your borrow request for ${currencySymbol}${formatNumber(loanAmount)} ${borrowAsset?.symbol || ''} has been submitted to the marketplace.`
      }
      onGoToMarketplace={handleGoToMarketplace}
    />
  );
}
