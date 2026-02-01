'use client';

import { useWatchContractEvent } from 'wagmi';
import { Address, Abi } from 'viem';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import { useContractStore } from '@/stores/contractStore';
import { LoanRequestStatus, LoanStatus } from '@/types';
import toast from 'react-hot-toast';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;

// ==================== LOAN REQUEST EVENTS ====================

/**
 * Watch for LoanRequestCreated events
 * Emitted when: createLoanRequest() is called
 */
export function useLoanRequestCreatedEvent(enabled = true) {
  const setLoanRequest = useContractStore((state) => state.setLoanRequest);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanRequestCreated',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          requestId: bigint;
          borrower: Address;
          collateralToken: Address;
          collateralAmount: bigint;
          borrowAsset: Address;
          borrowAmount: bigint;
          interestRate: bigint;
          duration: bigint;
        };

        if (!args.requestId) return;

        setLoanRequest({
          requestId: args.requestId,
          borrower: args.borrower,
          collateralToken: args.collateralToken,
          collateralAmount: args.collateralAmount,
          borrowAsset: args.borrowAsset,
          borrowAmount: args.borrowAmount,
          interestRate: args.interestRate,
          maxInterestRate: args.interestRate,
          duration: args.duration,
          status: LoanRequestStatus.PENDING,
          createdAt: BigInt(Math.floor(Date.now() / 1000)),
          expireAt: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
          chainId: BigInt(84532), // Base Sepolia chain ID
        });

        toast.success(`New loan request #${args.requestId.toString()} created`);
      });
    },
  });
}

/**
 * Watch for LoanRequestCancelled events
 * Emitted when: cancelLoanRequest() is called
 */
export function useLoanRequestCancelledEvent(enabled = true) {
  const updateLoanRequestStatus = useContractStore((state) => state.updateLoanRequestStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanRequestCancelled',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          requestId: bigint;
          borrower: Address;
        };

        if (!args.requestId) return;

        updateLoanRequestStatus(args.requestId, LoanRequestStatus.CANCELLED);

        toast('Loan request cancelled', {
          icon: 'i',
        });
      });
    },
  });
}

/**
 * Watch for LoanRequestExpired events
 * Emitted when: expireLoanRequest() is called
 */
export function useLoanRequestExpiredEvent(enabled = true) {
  const updateLoanRequestStatus = useContractStore((state) => state.updateLoanRequestStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanRequestExpired',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          requestId: bigint;
          borrower: Address;
        };

        if (!args.requestId) return;

        updateLoanRequestStatus(args.requestId, LoanRequestStatus.EXPIRED);

        toast('Loan request expired', {
          icon: 'i',
        });
      });
    },
  });
}

// ==================== LOAN FUNDED EVENTS ====================

/**
 * Watch for LoanFunded events
 * Emitted when: fundLoanRequest() or acceptLenderOffer() is called
 */
export function useLoanFundedEvent(enabled = true) {
  const updateLoanRequestStatus = useContractStore((state) => state.updateLoanRequestStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanFunded',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          requestId: bigint;
          lender: Address;
          borrower: Address;
          amount: bigint;
        };

        if (!args.loanId) return;

        // Update the request status to FUNDED
        updateLoanRequestStatus(args.requestId, LoanRequestStatus.FUNDED);

        // We don't have full loan details from the event, but we can create a partial entry
        // The full data will be loaded when the page fetches it
        toast.success(`Loan #${args.loanId.toString()} funded!`, {
          icon: '🎉',
        });
      });
    },
  });
}

// ==================== LENDER OFFER EVENTS ====================

/**
 * Watch for LenderOfferCreated events
 * Emitted when: createLenderOffer() is called
 */
export function useLenderOfferCreatedEvent(enabled = true) {
  const setLenderOffer = useContractStore((state) => state.setLenderOffer);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LenderOfferCreated',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          offerId: bigint;
          lender: Address;
          lendAmount: bigint;
          lendAsset: Address;
          minCollateralAmount: bigint;
          requiredCollateralAsset: Address;
          interestRate: bigint;
          duration: bigint;
        };

        if (!args.offerId) return;

        setLenderOffer({
          offerId: args.offerId,
          lender: args.lender,
          lendAsset: args.lendAsset,
          lendAmount: args.lendAmount,
          remainingAmount: args.lendAmount, // Initially, remaining = full amount
          borrowedAmount: BigInt(0),
          requiredCollateralAsset: args.requiredCollateralAsset,
          minCollateralAmount: args.minCollateralAmount,
          interestRate: args.interestRate,
          duration: args.duration,
          status: LoanRequestStatus.PENDING,
          createdAt: BigInt(Math.floor(Date.now() / 1000)),
          expireAt: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
          chainId: BigInt(84532), // Base Sepolia chain ID
        });

        toast.success(`New lender offer #${args.offerId.toString()} created`);
      });
    },
  });
}

/**
 * Watch for LenderOfferAccepted events
 * Emitted when: acceptLenderOffer() is called
 */
export function useLenderOfferAcceptedEvent(enabled = true) {
  const updateLenderOfferStatus = useContractStore((state) => state.updateLenderOfferStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LenderOfferAccepted',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          offerId: bigint;
          borrower: Address;
          loanId: bigint;
          collateralAmount: bigint;
        };

        if (!args.offerId) return;

        updateLenderOfferStatus(args.offerId, LoanRequestStatus.FUNDED);

        toast.success(`Offer #${args.offerId.toString()} accepted! Loan #${args.loanId.toString()} created`, {
          icon: '🎉',
        });
      });
    },
  });
}

/**
 * Watch for LenderOfferCancelled events
 * Emitted when: cancelLenderOffer() is called
 */
export function useLenderOfferCancelledEvent(enabled = true) {
  const updateLenderOfferStatus = useContractStore((state) => state.updateLenderOfferStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LenderOfferCancelled',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          offerId: bigint;
          lender: Address;
        };

        if (!args.offerId) return;

        updateLenderOfferStatus(args.offerId, LoanRequestStatus.CANCELLED);

        toast('Lender offer cancelled', {
          icon: 'i',
        });
      });
    },
  });
}

/**
 * Watch for LenderOfferExpired events
 * Emitted when: expireLenderOffer() is called
 */
export function useLenderOfferExpiredEvent(enabled = true) {
  const updateLenderOfferStatus = useContractStore((state) => state.updateLenderOfferStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LenderOfferExpired',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          offerId: bigint;
        };

        if (!args.offerId) return;

        updateLenderOfferStatus(args.offerId, LoanRequestStatus.EXPIRED);

        toast('Lender offer expired', {
          icon: 'i',
        });
      });
    },
  });
}

// ==================== LOAN LIFECYCLE EVENTS ====================

/**
 * Watch for LoanRepaid events
 * Emitted when: repayLoan() is called (partial or full repayment)
 */
export function useLoanRepaidEvent(enabled = true) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanRepaid',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          amount: bigint;
          remainingDebt: bigint;
        };

        if (!args.loanId) return;

        // Note: The full loan data will be re-fetched by the page when needed
        toast.success(`Payment of ${args.amount.toString()} received on loan #${args.loanId.toString()}`);
      });
    },
  });
}

/**
 * Watch for LoanFullyRepaid events
 * Emitted when: repayLoan() pays off the entire debt
 */
export function useLoanFullyRepaidEvent(enabled = true) {
  const updateLoanStatus = useContractStore((state) => state.updateLoanStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanFullyRepaid',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
        };

        if (!args.loanId) return;

        updateLoanStatus(args.loanId, LoanStatus.REPAID);

        toast.success(`Loan #${args.loanId.toString()} fully repaid!`, {
          icon: '🎉',
        });
      });
    },
  });
}

/**
 * Watch for LoanLiquidated events
 * Emitted when: liquidateLoan() is called
 */
export function useLoanLiquidatedEvent(enabled = true) {
  const updateLoanStatus = useContractStore((state) => state.updateLoanStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanLiquidated',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          liquidator: Address;
          collateralSeized: bigint;
          debtRepaid: bigint;
        };

        if (!args.loanId) return;

        updateLoanStatus(args.loanId, LoanStatus.LIQUIDATED);

        toast.error(`Loan #${args.loanId.toString()} was liquidated`, {
          icon: '⚠️',
        });
      });
    },
  });
}

/**
 * Watch for PartialLiquidation events
 * Emitted when: partialLiquidation() is called
 */
export function usePartialLiquidationEvent(enabled = true) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'PartialLiquidation',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          liquidator: Address;
          percentage: bigint;
          debtRepaid: bigint;
          collateralSeized: bigint;
        };

        if (!args.loanId) return;

        toast(`Loan #${args.loanId.toString()} partially liquidated (${Number(args.percentage) / 100}%)`, {
          icon: '⚠️',
        });
      });
    },
  });
}

// ==================== LOAN EXTENSION EVENTS ====================

/**
 * Watch for LoanExtensionRequested events
 * Emitted when: requestLoanExtension() is called
 */
export function useLoanExtensionRequestedEvent(enabled = true) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanExtensionRequested',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          additionalDuration: bigint;
        };

        if (!args.loanId) return;

        toast(`Extension requested for loan #${args.loanId.toString()}`, {
          icon: 'i',
        });
      });
    },
  });
}

/**
 * Watch for LoanExtensionApproved events
 * Emitted when: approveLoanExtension() is called
 */
export function useLoanExtensionApprovedEvent(enabled = true) {
  const updateLoan = useContractStore((state) => state.updateLoan);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'LoanExtensionApproved',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          lender: Address;
          newDueDate: bigint;
        };

        if (!args.loanId) return;

        updateLoan(args.loanId, { dueDate: args.newDueDate });

        toast.success(`Extension approved for loan #${args.loanId.toString()}`, {
          icon: '✅',
        });
      });
    },
  });
}

// ==================== COLLATERAL EVENTS ====================

/**
 * Watch for CollateralReleased events
 * Emitted when: loan is fully repaid
 */
export function useCollateralReleasedEvent(enabled = true) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'CollateralReleased',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          amount: bigint;
        };

        if (!args.loanId) return;

        toast.success(`Collateral released for loan #${args.loanId.toString()}`);
      });
    },
  });
}

/**
 * Watch for PartialCollateralReleased events
 * Emitted when: partial repayment releases some collateral
 */
export function usePartialCollateralReleasedEvent(enabled = true) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'PartialCollateralReleased',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          collateralAmount: bigint;
          repaymentAmount: bigint;
        };

        if (!args.loanId) return;

        toast(`Partial collateral released for loan #${args.loanId.toString()}`);
      });
    },
  });
}

// ==================== PLATFORM EVENTS ====================

/**
 * Watch for PlatformFeeCollected events
 * Emitted when: loan is funded
 */
export function usePlatformFeeCollectedEvent(enabled = true) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.loanMarketPlace,
    abi: LoanMarketPlaceABI,
    eventName: 'PlatformFeeCollected',
    enabled,
    onLogs() {
      // Platform fee events are informational, no UI action needed
      // Could be used for analytics/admin dashboard
    },
  });
}

// ==================== CONVENIENCE HOOKS ====================

/**
 * Watch all marketplace events at once
 * Use this in pages that need to react to any marketplace activity
 */
export function useAllMarketplaceEvents(enabled = true) {
  // Loan Request events
  useLoanRequestCreatedEvent(enabled);
  useLoanRequestCancelledEvent(enabled);
  useLoanRequestExpiredEvent(enabled);

  // Loan Funded event
  useLoanFundedEvent(enabled);

  // Lender Offer events
  useLenderOfferCreatedEvent(enabled);
  useLenderOfferAcceptedEvent(enabled);
  useLenderOfferCancelledEvent(enabled);
  useLenderOfferExpiredEvent(enabled);

  // Loan Lifecycle events
  useLoanRepaidEvent(enabled);
  useLoanFullyRepaidEvent(enabled);
  useLoanLiquidatedEvent(enabled);
  usePartialLiquidationEvent(enabled);

  // Extension events
  useLoanExtensionRequestedEvent(enabled);
  useLoanExtensionApprovedEvent(enabled);

  // Collateral events
  useCollateralReleasedEvent(enabled);
  usePartialCollateralReleasedEvent(enabled);

  // Platform events
  usePlatformFeeCollectedEvent(enabled);
}

/**
 * Watch only loan request related events
 * Use this on borrow page
 */
export function useLoanRequestEvents(enabled = true) {
  useLoanRequestCreatedEvent(enabled);
  useLoanRequestCancelledEvent(enabled);
  useLoanRequestExpiredEvent(enabled);
  useLoanFundedEvent(enabled);
}

/**
 * Watch only lender offer related events
 * Use this on lend page
 */
export function useLenderOfferEvents(enabled = true) {
  useLenderOfferCreatedEvent(enabled);
  useLenderOfferAcceptedEvent(enabled);
  useLenderOfferCancelledEvent(enabled);
  useLenderOfferExpiredEvent(enabled);
}

/**
 * Watch only active loan related events
 * Use this on dashboard for active loans
 */
export function useActiveLoanEvents(enabled = true) {
  useLoanRepaidEvent(enabled);
  useLoanFullyRepaidEvent(enabled);
  useLoanLiquidatedEvent(enabled);
  usePartialLiquidationEvent(enabled);
  useLoanExtensionRequestedEvent(enabled);
  useLoanExtensionApprovedEvent(enabled);
  useCollateralReleasedEvent(enabled);
  usePartialCollateralReleasedEvent(enabled);
}
