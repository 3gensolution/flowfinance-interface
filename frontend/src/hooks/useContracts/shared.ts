'use client';

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import type { Address, Abi } from 'viem';
import { useEffect, useCallback } from 'react';
import {
  CONTRACT_ADDRESSES,
  getTokenByAddress,
  TOKEN_LIST,
  getActiveChainId,
  getContractAddresses,
  CONTRACT_ADDRESSES_BY_CHAIN,
  getGasOverrides,
  ZERO_ADDRESS,
} from '@/config/contracts';
import type { LoanRequest, LenderOffer, Loan } from '@/types';
import LoanMarketPlaceABIJson from '@/contracts/LoanMarketPlaceABI.json';
import ConfigurationABIJson from '@/contracts/ConfigurationABI.json';
import LTVConfigABIJson from '@/contracts/LTVConfigABI.json';
import ERC20ABIJson from '@/contracts/ERC20ABI.json';
import CrossChainLoanManagerABIJson from '@/contracts/CrossChainLoanManagerABI.json';

const LoanMarketPlaceABI = LoanMarketPlaceABIJson as Abi;
const ConfigurationABI = ConfigurationABIJson as Abi;
const LTVConfigABI = LTVConfigABIJson as Abi;
const ERC20ABI = ERC20ABIJson as Abi;
const CrossChainLoanManagerABI = CrossChainLoanManagerABIJson as Abi;

export {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useAccount,
  formatUnits,
  useEffect,
  useCallback,
  CONTRACT_ADDRESSES,
  getTokenByAddress,
  TOKEN_LIST,
  getActiveChainId,
  getContractAddresses,
  CONTRACT_ADDRESSES_BY_CHAIN,
  getGasOverrides,
  ZERO_ADDRESS,
  LoanMarketPlaceABI,
  ConfigurationABI,
  LTVConfigABI,
  ERC20ABI,
  CrossChainLoanManagerABI,
};

export type { Address, Abi, LoanRequest, LenderOffer, Loan };
