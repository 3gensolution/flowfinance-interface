import { Address } from 'viem';

// Loan Request Status
export enum LoanRequestStatus {
  PENDING = 0,
  FUNDED = 1,
  EXPIRED = 2,
  CANCELLED = 3,
}

// Loan Status
export enum LoanStatus {
  NULL = 0,
  ACTIVE = 1,
  REPAID = 2,
  LIQUIDATED = 3,
  DEFAULTED = 4,
}

// Loan Request from smart contract
export interface LoanRequest {
  requestId: bigint;
  borrower: Address;
  collateralAmount: bigint;
  collateralToken: Address;
  borrowAsset: Address;
  borrowAmount: bigint;
  duration: bigint;
  maxInterestRate: bigint;
  interestRate: bigint;
  createdAt: bigint;
  expireAt: bigint;
  status: LoanRequestStatus;
  chainId?: bigint;
}

// Lender Offer from smart contract
export interface LenderOffer {
  offerId: bigint;
  lender: Address;
  lendAsset: Address;
  lendAmount: bigint;
  remainingAmount: bigint;
  borrowedAmount: bigint;
  requiredCollateralAsset: Address;
  minCollateralAmount: bigint;
  duration: bigint;
  interestRate: bigint;
  createdAt: bigint;
  expireAt: bigint;
  status: LoanRequestStatus;
  chainId?: bigint;
}

// Active Loan from smart contract
export interface Loan {
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
  status: LoanStatus;
  lastInterestUpdate: bigint;
  gracePeriodEnd: bigint;
  isCrossChain: boolean;
  sourceChainId: bigint;
  targetChainId: bigint;
  remoteChainLoanId: bigint;
}

// Loan Extension
export interface LoanExtension {
  additionalDuration: bigint;
  requested: boolean;
  approved: boolean;
}

// Token info
export interface Token {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

// Form data for creating loan request
export interface CreateLoanRequestForm {
  collateralToken: Address;
  collateralAmount: string;
  borrowAsset: Address;
  borrowAmount: string;
  interestRate: string;
  duration: number; // in days
}

// Form data for creating lender offer
export interface CreateLenderOfferForm {
  lendAsset: Address;
  lendAmount: string;
  requiredCollateralAsset: Address;
  minCollateralAmount: string;
  interestRate: string;
  duration: number; // in days
}

// Health factor status
export type HealthStatus = 'healthy' | 'warning' | 'danger' | 'liquidatable';

export const getHealthStatus = (healthFactor: number): HealthStatus => {
  if (healthFactor >= 1.5) return 'healthy';
  if (healthFactor >= 1.2) return 'warning';
  if (healthFactor >= 1.0) return 'danger';
  return 'liquidatable';
};

// Stats
export interface PlatformStats {
  totalLoans: number;
  totalValueLocked: bigint;
  activeLoans: number;
  totalBorrowed: bigint;
}
