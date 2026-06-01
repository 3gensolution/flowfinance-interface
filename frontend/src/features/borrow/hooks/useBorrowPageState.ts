'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { type BorrowAsset, type BorrowType, type CollateralAsset, type StablecoinAsset } from '@/components/borrower';

interface BorrowPageState {
  currentStep: number;
  borrowType: BorrowType;
  selectedFiatCurrency: string | null;
  selectedStablecoin: StablecoinAsset | null;
  selectedCollateral: CollateralAsset | null;
  collateralAmount: string;
  selectedBorrowAsset: BorrowAsset | null;
  selectedLTV: number;
  interestRate: number;
  duration: number;
  customDate: Date | null;
  targetChainId: number;
}

type BorrowPageAction =
  | { type: 'set_current_step'; payload: number }
  | { type: 'set_selected_fiat_currency'; payload: string | null }
  | { type: 'set_selected_stablecoin'; payload: StablecoinAsset | null }
  | { type: 'set_selected_collateral'; payload: CollateralAsset | null }
  | { type: 'set_collateral_amount'; payload: string }
  | { type: 'set_selected_borrow_asset'; payload: BorrowAsset | null }
  | { type: 'set_selected_ltv'; payload: number }
  | { type: 'set_interest_rate'; payload: number }
  | { type: 'set_duration'; payload: number }
  | { type: 'set_custom_date'; payload: Date | null }
  | { type: 'set_target_chain_id'; payload: number }
  | { type: 'reset_for_borrow_type'; payload: BorrowType }
  | { type: 'reset_borrow_asset_selection' };

function createBorrowAssetFromStablecoin(stablecoin: StablecoinAsset): BorrowAsset {
  return {
    symbol: stablecoin.symbol,
    name: stablecoin.name,
    address: stablecoin.address,
    decimals: stablecoin.decimals,
    icon: stablecoin.icon,
    type: 'crypto',
  };
}

function createBorrowAssetFromCurrency(code: string, currencies: ReadonlyArray<{ code: string; name: string }>): BorrowAsset {
  const currencyInfo = currencies.find((currency) => currency.code === code);

  return {
    symbol: code,
    name: currencyInfo?.name || code,
    type: 'fiat',
  };
}

function borrowPageReducer(state: BorrowPageState, action: BorrowPageAction): BorrowPageState {
  switch (action.type) {
    case 'set_current_step':
      return { ...state, currentStep: action.payload };
    case 'set_selected_fiat_currency':
      return { ...state, selectedFiatCurrency: action.payload };
    case 'set_selected_stablecoin':
      return { ...state, selectedStablecoin: action.payload };
    case 'set_selected_collateral':
      return { ...state, selectedCollateral: action.payload };
    case 'set_collateral_amount':
      return { ...state, collateralAmount: action.payload };
    case 'set_selected_borrow_asset':
      return { ...state, selectedBorrowAsset: action.payload };
    case 'set_selected_ltv':
      return { ...state, selectedLTV: action.payload };
    case 'set_interest_rate':
      return { ...state, interestRate: action.payload };
    case 'set_duration':
      return { ...state, duration: action.payload };
    case 'set_custom_date':
      return { ...state, customDate: action.payload };
    case 'set_target_chain_id':
      return { ...state, targetChainId: action.payload };
    case 'reset_for_borrow_type':
      return {
        ...state,
        borrowType: action.payload,
        selectedFiatCurrency: null,
        selectedStablecoin: null,
        selectedCollateral: null,
        collateralAmount: '',
        selectedBorrowAsset: null,
        selectedLTV: 0,
      };
    case 'reset_borrow_asset_selection':
      return {
        ...state,
        selectedStablecoin: null,
        selectedBorrowAsset: null,
      };
    default:
      return state;
  }
}

export function useBorrowPageState(params: {
  selectedNetworkId: number;
  supportedFiatCurrencies: ReadonlyArray<{ code: string; name: string }>;
}) {
  const { selectedNetworkId, supportedFiatCurrencies } = params;

  const [state, dispatch] = useReducer(borrowPageReducer, {
    currentStep: 0,
    borrowType: null,
    selectedFiatCurrency: null,
    selectedStablecoin: null,
    selectedCollateral: null,
    collateralAmount: '',
    selectedBorrowAsset: null,
    selectedLTV: 0,
    interestRate: 10,
    duration: 30,
    customDate: null,
    targetChainId: selectedNetworkId,
  });

  useEffect(() => {
    dispatch({ type: 'reset_borrow_asset_selection' });
  }, [state.targetChainId]);

  useEffect(() => {
    if (state.borrowType === 'crypto' && state.selectedStablecoin) {
      dispatch({
        type: 'set_selected_borrow_asset',
        payload: createBorrowAssetFromStablecoin(state.selectedStablecoin),
      });
      return;
    }

    if (state.borrowType === 'cash' && state.selectedFiatCurrency) {
      dispatch({
        type: 'set_selected_borrow_asset',
        payload: createBorrowAssetFromCurrency(state.selectedFiatCurrency, supportedFiatCurrencies),
      });
      return;
    }

    dispatch({ type: 'set_selected_borrow_asset', payload: null });
  }, [state.borrowType, state.selectedStablecoin, state.selectedFiatCurrency, supportedFiatCurrencies]);

  const actions = useMemo(() => ({
      setCurrentStep: (value: number) => dispatch({ type: 'set_current_step', payload: value }),
      setBorrowType: (value: BorrowType) => dispatch({ type: 'reset_for_borrow_type', payload: value }),
      setSelectedFiatCurrency: (value: string | null) => dispatch({ type: 'set_selected_fiat_currency', payload: value }),
      setSelectedStablecoin: (value: StablecoinAsset | null) => dispatch({ type: 'set_selected_stablecoin', payload: value }),
      setSelectedCollateral: (value: CollateralAsset | null) => dispatch({ type: 'set_selected_collateral', payload: value }),
      setCollateralAmount: (value: string) => dispatch({ type: 'set_collateral_amount', payload: value }),
      setSelectedLTV: (value: number) => dispatch({ type: 'set_selected_ltv', payload: value }),
      setInterestRate: (value: number) => dispatch({ type: 'set_interest_rate', payload: value }),
      setDuration: (value: number) => dispatch({ type: 'set_duration', payload: value }),
      setCustomDate: (value: Date | null) => dispatch({ type: 'set_custom_date', payload: value }),
      setTargetChainId: (value: number) => dispatch({ type: 'set_target_chain_id', payload: value }),
  }), []);

  return {
    state,
    actions,
  };
}
