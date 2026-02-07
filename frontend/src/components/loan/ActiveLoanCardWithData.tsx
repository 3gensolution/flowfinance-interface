'use client';

import { Address } from 'viem';
import { LoanStatus } from '@/types';
import { useLoanHealthFactor, useOutstandingDebt } from '@/hooks/useContracts';
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
}

export function ActiveLoanCardWithData({
  loan,
  isBorrower,
  onRepay,
}: ActiveLoanCardWithDataProps) {
  const { data: healthFactor, isLoading: isLoadingHealth } = useLoanHealthFactor(loan.loanId);
  const { data: outstandingDebt } = useOutstandingDebt(loan.loanId);

  const loanData = {
    ...loan,
    status: loan.status as LoanStatus,
  };

  const healthFactorValue = healthFactor ? healthFactor as bigint : undefined;

  return (
    <ActiveLoanCard
      loan={loanData}
      healthFactor={healthFactorValue}
      isLoadingHealth={isLoadingHealth}
      repaymentAmount={outstandingDebt ? outstandingDebt as bigint : undefined}
      isBorrower={isBorrower}
      onRepay={onRepay}
    />
  );
}
