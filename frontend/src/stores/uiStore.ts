'use client';

import { create } from 'zustand';

interface UIState {
  // Repay modal state
  repayModalOpen: boolean;
  repayLoanId: bigint | null;
  openRepayModal: (loanId: bigint) => void;
  closeRepayModal: () => void;

  // Liquidate modal state
  liquidateModalOpen: boolean;
  liquidateLoanId: bigint | null;
  openLiquidateModal: (loanId: bigint) => void;
  closeLiquidateModal: () => void;

  // Extension modal state
  extensionModalOpen: boolean;
  extensionLoanId: bigint | null;
  openExtensionModal: (loanId: bigint) => void;
  closeExtensionModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Repay modal
  repayModalOpen: false,
  repayLoanId: null,
  openRepayModal: (loanId: bigint) => set({ repayModalOpen: true, repayLoanId: loanId }),
  closeRepayModal: () => set({ repayModalOpen: false, repayLoanId: null }),

  // Liquidate modal
  liquidateModalOpen: false,
  liquidateLoanId: null,
  openLiquidateModal: (loanId: bigint) => set({ liquidateModalOpen: true, liquidateLoanId: loanId }),
  closeLiquidateModal: () => set({ liquidateModalOpen: false, liquidateLoanId: null }),

  // Extension modal
  extensionModalOpen: false,
  extensionLoanId: null,
  openExtensionModal: (loanId: bigint) => set({ extensionModalOpen: true, extensionLoanId: loanId }),
  closeExtensionModal: () => set({ extensionModalOpen: false, extensionLoanId: null }),
}));
