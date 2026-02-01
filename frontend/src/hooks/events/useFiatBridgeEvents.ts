'use client';

import { useWatchContractEvent } from 'wagmi';
import { Address, Abi } from 'viem';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import FiatLoanBridgeABIJson from '@/contracts/FiatLoanBridgeABI.json';
import { useContractStore } from '@/stores/contractStore';
import { FiatLoanStatus, FiatLenderOfferStatus } from '@/hooks/useFiatLoan';
import toast from 'react-hot-toast';

const FiatLoanBridgeABI = FiatLoanBridgeABIJson as Abi;

// ==================== FIAT LOAN REQUEST EVENTS ====================

/**
 * Watch for FiatLoanRequested events
 * Emitted when: createFiatLoanRequest() is called
 */
export function useFiatLoanRequestedEvent(enabled = true) {
  const setFiatLoan = useContractStore((state) => state.setFiatLoan);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLoanRequested',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          fiatAmountCents: bigint;
          currency: string;
          collateralAmount: bigint;
          collateralAsset: Address;
        };

        if (!args?.loanId) return;

        setFiatLoan({
          loanId: args.loanId,
          borrower: args.borrower,
          supplier: '0x0000000000000000000000000000000000000000' as Address,
          collateralAsset: args.collateralAsset,
          collateralAmount: args.collateralAmount,
          fiatAmountCents: args.fiatAmountCents,
          currency: args.currency,
          interestRate: BigInt(0),
          duration: BigInt(0),
          status: FiatLoanStatus.PENDING_SUPPLIER,
          createdAt: BigInt(Math.floor(Date.now() / 1000)),
          activatedAt: BigInt(0),
          dueDate: BigInt(0),
          gracePeriodEnd: BigInt(0),
          claimableAmountCents: BigInt(0),
          fundsWithdrawn: false,
          repaymentDepositId: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          exchangeRateAtCreation: BigInt(0),
          chainId: BigInt(84532), // Base Sepolia chain ID
        });

        const amountFormatted = (Number(args.fiatAmountCents) / 100).toFixed(2);
        toast.success(`New fiat loan request #${args.loanId.toString()} for ${args.currency} ${amountFormatted}`);
      });
    },
  });
}

/**
 * Watch for FiatLoanAccepted events
 * Emitted when: acceptFiatLoanRequest() is called
 */
export function useFiatLoanAcceptedEvent(enabled = true) {
  const updateFiatLoan = useContractStore((state) => state.updateFiatLoan);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLoanAccepted',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          supplier: Address;
          borrower: Address;
        };

        if (!args?.loanId) return;

        updateFiatLoan(args.loanId, {
          supplier: args.supplier,
          status: FiatLoanStatus.ACTIVE,
          activatedAt: BigInt(Math.floor(Date.now() / 1000)),
        });

        toast.success(`Fiat loan #${args.loanId.toString()} accepted by supplier!`, {
          icon: '🎉',
        });
      });
    },
  });
}

/**
 * Watch for FiatLoanCancelled events
 * Emitted when: cancelFiatLoanRequest() is called
 */
export function useFiatLoanCancelledEvent(enabled = true) {
  const updateFiatLoanStatus = useContractStore((state) => state.updateFiatLoanStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLoanCancelled',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
        };

        if (!args?.loanId) return;

        updateFiatLoanStatus(args.loanId, FiatLoanStatus.CANCELLED);

        toast('Fiat loan request cancelled', { icon: 'i' });
      });
    },
  });
}

/**
 * Watch for FiatLoanRepaid events
 * Emitted when: confirmFiatRepayment() is called (oracle confirmation)
 */
export function useFiatLoanRepaidEvent(enabled = true) {
  const updateFiatLoanStatus = useContractStore((state) => state.updateFiatLoanStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLoanRepaid',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          repaymentDepositId: `0x${string}`;
        };

        if (!args?.loanId) return;

        updateFiatLoanStatus(args.loanId, FiatLoanStatus.REPAID);

        toast.success(`Fiat loan #${args.loanId.toString()} repaid!`, { icon: '🎉' });
      });
    },
  });
}

/**
 * Watch for FiatLoanLiquidated events
 * Emitted when: liquidateFiatLoan() is called
 */
export function useFiatLoanLiquidatedEvent(enabled = true) {
  const updateFiatLoanStatus = useContractStore((state) => state.updateFiatLoanStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLoanLiquidated',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          liquidator: Address;
          collateralSeized: bigint;
        };

        if (!args?.loanId) return;

        updateFiatLoanStatus(args.loanId, FiatLoanStatus.LIQUIDATED);

        toast.error(`Fiat loan #${args.loanId.toString()} was liquidated`, { icon: '⚠️' });
      });
    },
  });
}

// ==================== FUNDS EVENTS ====================

/**
 * Watch for FundsClaimable events
 * Emitted when: loan is accepted and funds are available
 */
export function useFundsClaimableEvent(enabled = true) {
  const updateFiatLoan = useContractStore((state) => state.updateFiatLoan);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FundsClaimable',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          amountCents: bigint;
          currency: string;
        };

        if (!args?.loanId) return;

        updateFiatLoan(args.loanId, { claimableAmountCents: args.amountCents });

        const amountFormatted = (Number(args.amountCents) / 100).toFixed(2);
        toast.success(`${args.currency} ${amountFormatted} is now claimable!`, { icon: '💰' });
      });
    },
  });
}

/**
 * Watch for FundsWithdrawn events
 * Emitted when: confirmFundsWithdrawn() is called (oracle confirmation)
 */
export function useFundsWithdrawnEvent(enabled = true) {
  const updateFiatLoan = useContractStore((state) => state.updateFiatLoan);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FundsWithdrawn',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          loanId: bigint;
          borrower: Address;
          withdrawalId: `0x${string}`;
        };

        if (!args?.loanId) return;

        updateFiatLoan(args.loanId, { fundsWithdrawn: true });

        toast.success(`Funds withdrawn for loan #${args.loanId.toString()}`);
      });
    },
  });
}

// ==================== FIAT LENDER OFFER EVENTS ====================

/**
 * Watch for FiatLenderOfferCreated events
 * Emitted when: createFiatLenderOffer() is called
 */
export function useFiatLenderOfferCreatedEvent(enabled = true) {
  const setFiatLenderOffer = useContractStore((state) => state.setFiatLenderOffer);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLenderOfferCreated',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          offerId: bigint;
          lender: Address;
          fiatAmountCents: bigint;
          currency: string;
          minCollateralValueUSD: bigint;
          duration: bigint;
          interestRate: bigint;
        };

        if (!args?.offerId) return;

        setFiatLenderOffer({
          offerId: args.offerId,
          lender: args.lender,
          fiatAmountCents: args.fiatAmountCents,
          remainingAmountCents: args.fiatAmountCents, // Initially, remaining = full amount
          borrowedAmountCents: BigInt(0),
          currency: args.currency,
          minCollateralValueUSD: args.minCollateralValueUSD,
          duration: args.duration,
          interestRate: args.interestRate,
          createdAt: BigInt(Math.floor(Date.now() / 1000)),
          expireAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
          status: FiatLenderOfferStatus.ACTIVE,
          exchangeRateAtCreation: BigInt(0),
          chainId: BigInt(84532), // Base Sepolia chain ID
        });

        const amountFormatted = (Number(args.fiatAmountCents) / 100).toFixed(2);
        toast.success(`New fiat offer #${args.offerId.toString()} for ${args.currency} ${amountFormatted}`);
      });
    },
  });
}

/**
 * Watch for FiatLenderOfferAccepted events
 * Emitted when: acceptFiatLenderOffer() is called
 */
export function useFiatLenderOfferAcceptedEvent(enabled = true) {
  const updateFiatLenderOfferStatus = useContractStore((state) => state.updateFiatLenderOfferStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLenderOfferAccepted',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          offerId: bigint;
          borrower: Address;
          loanId: bigint;
          collateralAsset: Address;
          collateralAmount: bigint;
        };

        if (!args?.offerId) return;

        updateFiatLenderOfferStatus(args.offerId, FiatLenderOfferStatus.ACCEPTED);

        toast.success(`Fiat offer #${args.offerId.toString()} accepted! Loan #${args.loanId.toString()} created`, {
          icon: '🎉',
        });
      });
    },
  });
}

/**
 * Watch for FiatLenderOfferCancelled events
 * Emitted when: cancelFiatLenderOffer() is called
 */
export function useFiatLenderOfferCancelledEvent(enabled = true) {
  const updateFiatLenderOfferStatus = useContractStore((state) => state.updateFiatLenderOfferStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLenderOfferCancelled',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as {
          offerId: bigint;
          lender: Address;
        };

        if (!args?.offerId) return;

        updateFiatLenderOfferStatus(args.offerId, FiatLenderOfferStatus.CANCELLED);

        toast('Fiat lender offer cancelled', { icon: 'i' });
      });
    },
  });
}

/**
 * Watch for FiatLenderOfferExpired events
 * Emitted when: expireFiatLenderOffer() is called
 */
export function useFiatLenderOfferExpiredEvent(enabled = true) {
  const updateFiatLenderOfferStatus = useContractStore((state) => state.updateFiatLenderOfferStatus);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.fiatLoanBridge,
    abi: FiatLoanBridgeABI,
    eventName: 'FiatLenderOfferExpired',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args as { offerId: bigint };

        if (!args?.offerId) return;

        updateFiatLenderOfferStatus(args.offerId, FiatLenderOfferStatus.EXPIRED);

        toast('Fiat lender offer expired', { icon: 'i' });
      });
    },
  });
}

// ==================== CONVENIENCE HOOKS ====================

/**
 * Watch all fiat bridge events at once
 */
export function useAllFiatBridgeEvents(enabled = true) {
  useFiatLoanRequestedEvent(enabled);
  useFiatLoanAcceptedEvent(enabled);
  useFiatLoanCancelledEvent(enabled);
  useFiatLoanRepaidEvent(enabled);
  useFiatLoanLiquidatedEvent(enabled);
  useFundsClaimableEvent(enabled);
  useFundsWithdrawnEvent(enabled);
  useFiatLenderOfferCreatedEvent(enabled);
  useFiatLenderOfferAcceptedEvent(enabled);
  useFiatLenderOfferCancelledEvent(enabled);
  useFiatLenderOfferExpiredEvent(enabled);
}

/**
 * Watch only fiat loan request related events
 */
export function useFiatLoanRequestEvents(enabled = true) {
  useFiatLoanRequestedEvent(enabled);
  useFiatLoanAcceptedEvent(enabled);
  useFiatLoanCancelledEvent(enabled);
  useFundsClaimableEvent(enabled);
  useFundsWithdrawnEvent(enabled);
}

/**
 * Watch only fiat lender offer related events
 */
export function useFiatLenderOfferEvents(enabled = true) {
  useFiatLenderOfferCreatedEvent(enabled);
  useFiatLenderOfferAcceptedEvent(enabled);
  useFiatLenderOfferCancelledEvent(enabled);
  useFiatLenderOfferExpiredEvent(enabled);
}

/**
 * Watch only active fiat loan related events
 */
export function useActiveFiatLoanEvents(enabled = true) {
  useFiatLoanRepaidEvent(enabled);
  useFiatLoanLiquidatedEvent(enabled);
  useFundsWithdrawnEvent(enabled);
}
