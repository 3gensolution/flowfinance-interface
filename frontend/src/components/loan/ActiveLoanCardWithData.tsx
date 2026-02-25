'use client';

import { useMemo } from 'react';
import { Address } from 'viem';
import { LoanStatus } from '@/types';
import { useHealthFactor, useOutstandingDebt, useTokenPrice } from '@/hooks/useContracts';
import { getTokenDecimals } from '@/lib/utils';
import { ActiveLoanCard } from './LoanCard';

export interface LoanData {
  loanId: bigint;
  requestId: bigint;
  borrower: Address;
  lender: Address;
  collateralAsset: Address;
  collateralAmount: bigint;
  collateralReleased: bigint;
  borrowAsset: Address;
  principalAmount: bigint;
  interestRate: bigint;
  duration: bigint;
  startTime: bigint;
  dueDate: bigint;
  amountRepaid: bigint;
  status: number;
  lastInterestUpdate: bigint;
  gracePeriodEnd: bigint;
  isCrossChain: boolean;
  sourceChainId: bigint;
  targetChainId: bigint;
  remoteChainLoanId: bigint;
}

interface ActiveLoanCardWithDataProps {
  loan: LoanData;
  isBorrower: boolean;
  onRepay?: () => void;
  onLiquidate?: () => void;
  chainId?: number;
}

export function ActiveLoanCardWithData({
  loan,
  isBorrower,
  onRepay,
  onLiquidate,
  chainId,
}: ActiveLoanCardWithDataProps) {
  const { data: outstandingDebt } = useOutstandingDebt(loan.loanId);

  // Get token prices (Chainlink 8 decimals)
  const { price: collateralPrice } = useTokenPrice(loan.collateralAsset, chainId);
  const { price: borrowPrice } = useTokenPrice(loan.borrowAsset, chainId);

  // Remaining collateral
  const remainingCollateral = loan.collateralAmount - loan.collateralReleased;

  // Convert outstanding debt to USD (8 decimals) for LTVConfig.getHealthFactor
  const borrowDecimals = getTokenDecimals(loan.borrowAsset, chainId);
  const debtUSD = useMemo(() => {
    if (!outstandingDebt || !borrowPrice) return undefined;
    return ((outstandingDebt as bigint) * (borrowPrice as bigint)) / BigInt(10 ** borrowDecimals);
  }, [outstandingDebt, borrowPrice, borrowDecimals]);

  // Duration in days
  const durationDays = Number(loan.duration) / 86400;

  // Health factor from LTVConfig.getHealthFactor (returns 1e18 = 100%)
  const { data: healthFactorRaw, isLoading: isLoadingHealth } = useHealthFactor(
    loan.collateralAsset,
    remainingCollateral > BigInt(0) ? remainingCollateral : undefined,
    collateralPrice as bigint | undefined,
    debtUSD,
    durationDays > 0 ? Math.round(durationDays) : undefined
  );

  // Convert from 1e18 scale to ratio (e.g., 1.5e18 → 1.5)
  const healthFactor = healthFactorRaw
    ? Number(healthFactorRaw as bigint) / 1e18
    : undefined;

  const loanData = {
    ...loan,
    status: loan.status as LoanStatus,
  };

  return (
    <ActiveLoanCard
      loan={loanData}
      healthFactor={healthFactor}
      isLoadingHealth={isLoadingHealth}
      repaymentAmount={outstandingDebt ? outstandingDebt as bigint : undefined}
      isBorrower={isBorrower}
      onRepay={onRepay}
      onLiquidate={onLiquidate}
      chainId={chainId}
    />
  );
}
