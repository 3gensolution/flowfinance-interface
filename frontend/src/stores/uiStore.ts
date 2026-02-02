'use client';

import { create } from 'zustand';

interface UIState {
  // Repay modal state
  repayModalOpen: boolean;
  repayLoanId: bigint | null;
  openRepayModal: (loanId: bigint) => void;
  closeRepayModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Repay modal
  repayModalOpen: false,
  repayLoanId: null,
  openRepayModal: (loanId: bigint) => set({ repayModalOpen: true, repayLoanId: loanId }),
  closeRepayModal: () => set({ repayModalOpen: false, repayLoanId: null }),
}));
