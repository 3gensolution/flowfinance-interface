'use client';

import { create } from 'zustand';
import { Address } from 'viem';
import { LoanRequest, LenderOffer, Loan, LoanRequestStatus, LoanStatus } from '@/types';
import { FiatLoan, FiatLenderOffer, FiatLoanStatus, FiatLenderOfferStatus } from '@/hooks/useFiatLoan';

// ==================== TYPES ====================

export interface TokenPrice {
  price: bigint;
  updatedAt: number;
  priceFeedAddress: Address;
}

export interface ContractStore {
  // LoanMarketPlace data (keyed by stringified ID for object compatibility)
  loanRequests: Record<string, LoanRequest>;
  lenderOffers: Record<string, LenderOffer>;
  loans: Record<string, Loan>;

  // FiatLoanBridge data
  fiatLoans: Record<string, FiatLoan>;
  fiatLenderOffers: Record<string, FiatLenderOffer>;

  // Token prices (keyed by token address)
  tokenPrices: Record<string, TokenPrice>;

  // ==================== LOAN REQUEST ACTIONS ====================
  setLoanRequest: (request: LoanRequest) => void;
  setLoanRequests: (requests: LoanRequest[]) => void;
  updateLoanRequestStatus: (id: bigint, status: LoanRequestStatus) => void;
  removeLoanRequest: (id: bigint) => void;

  // ==================== LENDER OFFER ACTIONS ====================
  setLenderOffer: (offer: LenderOffer) => void;
  setLenderOffers: (offers: LenderOffer[]) => void;
  updateLenderOfferStatus: (id: bigint, status: LoanRequestStatus) => void;
  removeLenderOffer: (id: bigint) => void;

  // ==================== LOAN ACTIONS ====================
  setLoan: (loan: Loan) => void;
  setLoans: (loans: Loan[]) => void;
  updateLoan: (id: bigint, updates: Partial<Loan>) => void;
  updateLoanStatus: (id: bigint, status: LoanStatus) => void;

  // ==================== FIAT LOAN ACTIONS ====================
  setFiatLoan: (loan: FiatLoan) => void;
  setFiatLoans: (loans: FiatLoan[]) => void;
  updateFiatLoan: (id: bigint, updates: Partial<FiatLoan>) => void;
  updateFiatLoanStatus: (id: bigint, status: FiatLoanStatus) => void;

  // ==================== FIAT LENDER OFFER ACTIONS ====================
  setFiatLenderOffer: (offer: FiatLenderOffer) => void;
  setFiatLenderOffers: (offers: FiatLenderOffer[]) => void;
  updateFiatLenderOfferStatus: (id: bigint, status: FiatLenderOfferStatus) => void;
  removeFiatLenderOffer: (id: bigint) => void;

  // ==================== TOKEN PRICE ACTIONS ====================
  setTokenPrice: (tokenAddress: Address, price: bigint, updatedAt: number, priceFeedAddress: Address) => void;
  getTokenPrice: (tokenAddress: Address) => TokenPrice | undefined;

  // ==================== UTILITY ACTIONS ====================
  clearAll: () => void;
}

// ==================== STORE IMPLEMENTATION ====================

export const useContractStore = create<ContractStore>((set, get) => ({
  // Initial state
  loanRequests: {},
  lenderOffers: {},
  loans: {},
  fiatLoans: {},
  fiatLenderOffers: {},
  tokenPrices: {},

  // ==================== LOAN REQUEST ACTIONS ====================

  setLoanRequest: (request) =>
    set((state) => ({
      loanRequests: {
        ...state.loanRequests,
        [request.requestId.toString()]: request,
      },
    })),

  setLoanRequests: (requests) =>
    set((state) => {
      const newRequests = { ...state.loanRequests };
      requests.forEach((request) => {
        newRequests[request.requestId.toString()] = request;
      });
      return { loanRequests: newRequests };
    }),

  updateLoanRequestStatus: (id, status) =>
    set((state) => {
      const key = id.toString();
      const existing = state.loanRequests[key];
      if (!existing) return state;
      return {
        loanRequests: {
          ...state.loanRequests,
          [key]: { ...existing, status },
        },
      };
    }),

  removeLoanRequest: (id) =>
    set((state) => {
      const newRequests = { ...state.loanRequests };
      delete newRequests[id.toString()];
      return { loanRequests: newRequests };
    }),

  // ==================== LENDER OFFER ACTIONS ====================

  setLenderOffer: (offer) =>
    set((state) => ({
      lenderOffers: {
        ...state.lenderOffers,
        [offer.offerId.toString()]: offer,
      },
    })),

  setLenderOffers: (offers) =>
    set((state) => {
      const newOffers = { ...state.lenderOffers };
      offers.forEach((offer) => {
        newOffers[offer.offerId.toString()] = offer;
      });
      return { lenderOffers: newOffers };
    }),

  updateLenderOfferStatus: (id, status) =>
    set((state) => {
      const key = id.toString();
      const existing = state.lenderOffers[key];
      if (!existing) return state;
      return {
        lenderOffers: {
          ...state.lenderOffers,
          [key]: { ...existing, status },
        },
      };
    }),

  removeLenderOffer: (id) =>
    set((state) => {
      const newOffers = { ...state.lenderOffers };
      delete newOffers[id.toString()];
      return { lenderOffers: newOffers };
    }),

  // ==================== LOAN ACTIONS ====================

  setLoan: (loan) =>
    set((state) => ({
      loans: {
        ...state.loans,
        [loan.loanId.toString()]: loan,
      },
    })),

  setLoans: (loans) =>
    set((state) => {
      const newLoans = { ...state.loans };
      loans.forEach((loan) => {
        newLoans[loan.loanId.toString()] = loan;
      });
      return { loans: newLoans };
    }),

  updateLoan: (id, updates) =>
    set((state) => {
      const key = id.toString();
      const existing = state.loans[key];
      if (!existing) return state;
      return {
        loans: {
          ...state.loans,
          [key]: { ...existing, ...updates },
        },
      };
    }),

  updateLoanStatus: (id, status) =>
    set((state) => {
      const key = id.toString();
      const existing = state.loans[key];
      if (!existing) return state;
      return {
        loans: {
          ...state.loans,
          [key]: { ...existing, status },
        },
      };
    }),

  // ==================== FIAT LOAN ACTIONS ====================

  setFiatLoan: (loan) =>
    set((state) => ({
      fiatLoans: {
        ...state.fiatLoans,
        [loan.loanId.toString()]: loan,
      },
    })),

  setFiatLoans: (loans) =>
    set((state) => {
      const newLoans = { ...state.fiatLoans };
      loans.forEach((loan) => {
        newLoans[loan.loanId.toString()] = loan;
      });
      return { fiatLoans: newLoans };
    }),

  updateFiatLoan: (id, updates) =>
    set((state) => {
      const key = id.toString();
      const existing = state.fiatLoans[key];
      if (!existing) return state;
      return {
        fiatLoans: {
          ...state.fiatLoans,
          [key]: { ...existing, ...updates },
        },
      };
    }),

  updateFiatLoanStatus: (id, status) =>
    set((state) => {
      const key = id.toString();
      const existing = state.fiatLoans[key];
      if (!existing) return state;
      return {
        fiatLoans: {
          ...state.fiatLoans,
          [key]: { ...existing, status },
        },
      };
    }),

  // ==================== FIAT LENDER OFFER ACTIONS ====================

  setFiatLenderOffer: (offer) =>
    set((state) => ({
      fiatLenderOffers: {
        ...state.fiatLenderOffers,
        [offer.offerId.toString()]: offer,
      },
    })),

  setFiatLenderOffers: (offers) =>
    set((state) => {
      const newOffers = { ...state.fiatLenderOffers };
      offers.forEach((offer) => {
        newOffers[offer.offerId.toString()] = offer;
      });
      return { fiatLenderOffers: newOffers };
    }),

  updateFiatLenderOfferStatus: (id, status) =>
    set((state) => {
      const key = id.toString();
      const existing = state.fiatLenderOffers[key];
      if (!existing) return state;
      return {
        fiatLenderOffers: {
          ...state.fiatLenderOffers,
          [key]: { ...existing, status },
        },
      };
    }),

  removeFiatLenderOffer: (id) =>
    set((state) => {
      const newOffers = { ...state.fiatLenderOffers };
      delete newOffers[id.toString()];
      return { fiatLenderOffers: newOffers };
    }),

  // ==================== TOKEN PRICE ACTIONS ====================

  setTokenPrice: (tokenAddress, price, updatedAt, priceFeedAddress) =>
    set((state) => ({
      tokenPrices: {
        ...state.tokenPrices,
        [tokenAddress.toLowerCase()]: { price, updatedAt, priceFeedAddress },
      },
    })),

  getTokenPrice: (tokenAddress) => {
    return get().tokenPrices[tokenAddress.toLowerCase()];
  },

  // ==================== UTILITY ACTIONS ====================

  clearAll: () =>
    set({
      loanRequests: {},
      lenderOffers: {},
      loans: {},
      fiatLoans: {},
      fiatLenderOffers: {},
      tokenPrices: {},
    }),
}));

// ==================== SELECTOR HOOKS ====================

// Get all loan requests as array
export const useLoanRequestsArray = () =>
  useContractStore((state) => Object.values(state.loanRequests));

// Get pending loan requests
export const usePendingLoanRequests = () =>
  useContractStore((state) =>
    Object.values(state.loanRequests).filter((r) => r.status === LoanRequestStatus.PENDING)
  );

// Get loan requests by borrower
export const useLoanRequestsByBorrower = (borrower: Address | undefined) =>
  useContractStore((state) =>
    borrower
      ? Object.values(state.loanRequests).filter(
          (r) => r.borrower.toLowerCase() === borrower.toLowerCase()
        )
      : []
  );

// Get all lender offers as array
export const useLenderOffersArray = () =>
  useContractStore((state) => Object.values(state.lenderOffers));

// Get active lender offers
export const useActiveLenderOffers = () =>
  useContractStore((state) =>
    Object.values(state.lenderOffers).filter((o) => o.status === LoanRequestStatus.PENDING)
  );

// Get lender offers by lender
export const useLenderOffersByLender = (lender: Address | undefined) =>
  useContractStore((state) =>
    lender
      ? Object.values(state.lenderOffers).filter(
          (o) => o.lender.toLowerCase() === lender.toLowerCase()
        )
      : []
  );

// Get all loans as array
export const useLoansArray = () =>
  useContractStore((state) => Object.values(state.loans));

// Get active loans
export const useActiveLoans = () =>
  useContractStore((state) =>
    Object.values(state.loans).filter((l) => l.status === LoanStatus.ACTIVE)
  );

// Get loans by borrower
export const useLoansByBorrower = (borrower: Address | undefined) =>
  useContractStore((state) =>
    borrower
      ? Object.values(state.loans).filter(
          (l) => l.borrower.toLowerCase() === borrower.toLowerCase()
        )
      : []
  );

// Get loans by lender
export const useLoansByLender = (lender: Address | undefined) =>
  useContractStore((state) =>
    lender
      ? Object.values(state.loans).filter(
          (l) => l.lender.toLowerCase() === lender.toLowerCase()
        )
      : []
  );

// Get single loan request by ID
export const useLoanRequestById = (id: bigint | undefined) =>
  useContractStore((state) => (id ? state.loanRequests[id.toString()] : undefined));

// Get single lender offer by ID
export const useLenderOfferById = (id: bigint | undefined) =>
  useContractStore((state) => (id ? state.lenderOffers[id.toString()] : undefined));

// Get single loan by ID
export const useLoanById = (id: bigint | undefined) =>
  useContractStore((state) => (id ? state.loans[id.toString()] : undefined));

// ==================== FIAT SELECTORS ====================

// Get all fiat loans as array
export const useFiatLoansArray = () =>
  useContractStore((state) => Object.values(state.fiatLoans));

// Get pending fiat loans
export const usePendingFiatLoansFromStore = () =>
  useContractStore((state) =>
    Object.values(state.fiatLoans).filter((l) => l.status === FiatLoanStatus.PENDING_SUPPLIER)
  );

// Get active fiat loans
export const useActiveFiatLoansFromStore = () =>
  useContractStore((state) =>
    Object.values(state.fiatLoans).filter((l) => l.status === FiatLoanStatus.ACTIVE)
  );

// Get fiat loans by borrower
export const useFiatLoansByBorrower = (borrower: Address | undefined) =>
  useContractStore((state) =>
    borrower
      ? Object.values(state.fiatLoans).filter(
          (l) => l.borrower.toLowerCase() === borrower.toLowerCase()
        )
      : []
  );

// Get fiat loans by supplier
export const useFiatLoansBySupplier = (supplier: Address | undefined) =>
  useContractStore((state) =>
    supplier
      ? Object.values(state.fiatLoans).filter(
          (l) => l.supplier.toLowerCase() === supplier.toLowerCase()
        )
      : []
  );

// Get single fiat loan by ID
export const useFiatLoanById = (id: bigint | undefined) =>
  useContractStore((state) => (id ? state.fiatLoans[id.toString()] : undefined));

// Get all fiat lender offers as array
export const useFiatLenderOffersArray = () =>
  useContractStore((state) => Object.values(state.fiatLenderOffers));

// Get active fiat lender offers
export const useActiveFiatLenderOffersFromStore = () =>
  useContractStore((state) =>
    Object.values(state.fiatLenderOffers).filter((o) => o.status === FiatLenderOfferStatus.ACTIVE)
  );

// Get fiat lender offers by lender
export const useFiatLenderOffersByLender = (lender: Address | undefined) =>
  useContractStore((state) =>
    lender
      ? Object.values(state.fiatLenderOffers).filter(
          (o) => o.lender.toLowerCase() === lender.toLowerCase()
        )
      : []
  );

// Get single fiat lender offer by ID
export const useFiatLenderOfferById = (id: bigint | undefined) =>
  useContractStore((state) => (id ? state.fiatLenderOffers[id.toString()] : undefined));

// ==================== TOKEN PRICE SELECTORS ====================

// Get token price from store
export const useTokenPriceFromStore = (tokenAddress: Address | undefined) =>
  useContractStore((state) =>
    tokenAddress ? state.tokenPrices[tokenAddress.toLowerCase()] : undefined
  );
