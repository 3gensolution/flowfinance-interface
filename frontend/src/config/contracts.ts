import { Address } from 'viem';

// Zero address constant
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

// Contract address type
export type ContractAddresses = {
  loanMarketPlace: Address;
  configuration: Address;
  collateralEscrow: Address;
  ltvConfig: Address;
  supplierRegistry: Address;
  fiatOracle: Address;
  fiatLoanBridge: Address;
};

// Base Sepolia contract addresses (default)
const BASE_SEPOLIA_CONTRACT_ADDRESSES: ContractAddresses = {
  loanMarketPlace: process.env.NEXT_PUBLIC_LOAN_MARKETPLACE_ADDRESS as Address || ZERO_ADDRESS,
  configuration: process.env.NEXT_PUBLIC_CONFIGURATION_ADDRESS as Address || ZERO_ADDRESS,
  collateralEscrow: process.env.NEXT_PUBLIC_COLLATERAL_ESCROW_ADDRESS as Address || ZERO_ADDRESS,
  ltvConfig: process.env.NEXT_PUBLIC_LTV_CONFIG_ADDRESS as Address || ZERO_ADDRESS,
  supplierRegistry: process.env.NEXT_PUBLIC_SUPPLIER_REGISTRY_ADDRESS as Address || ZERO_ADDRESS,
  fiatOracle: process.env.NEXT_PUBLIC_FIAT_ORACLE_ADDRESS as Address || ZERO_ADDRESS,
  fiatLoanBridge: process.env.NEXT_PUBLIC_FIAT_LOAN_BRIDGE_ADDRESS as Address || ZERO_ADDRESS,
};

// Dynamic CONTRACT_ADDRESSES — mutated in-place when chain switches via setActiveChainId()
// All files importing this will automatically get the correct chain's addresses
export const CONTRACT_ADDRESSES: ContractAddresses = { ...BASE_SEPOLIA_CONTRACT_ADDRESSES };

// Contract addresses on Polygon Amoy (Proxy Addresses)
// Fiat contracts (fiatOracle, fiatLoanBridge) are Base-only — zeroed out here
export const POLYGON_AMOY_CONTRACT_ADDRESSES: ContractAddresses = {
  loanMarketPlace: process.env.NEXT_PUBLIC_POLYGON_AMOY_LOAN_MARKETPLACE_ADDRESS as Address || ZERO_ADDRESS,
  configuration: process.env.NEXT_PUBLIC_POLYGON_AMOY_CONFIGURATION_ADDRESS as Address || ZERO_ADDRESS,
  collateralEscrow: process.env.NEXT_PUBLIC_POLYGON_AMOY_COLLATERAL_ESCROW_ADDRESS as Address || ZERO_ADDRESS,
  ltvConfig: process.env.NEXT_PUBLIC_POLYGON_AMOY_LTV_CONFIG_ADDRESS as Address || ZERO_ADDRESS,
  supplierRegistry: process.env.NEXT_PUBLIC_POLYGON_AMOY_SUPPLIER_REGISTRY_ADDRESS as Address || ZERO_ADDRESS,
  fiatOracle: ZERO_ADDRESS,
  fiatLoanBridge: ZERO_ADDRESS,
};

// Contract addresses indexed by chain ID
export const CONTRACT_ADDRESSES_BY_CHAIN: Record<number, ContractAddresses> = {
  84532: BASE_SEPOLIA_CONTRACT_ADDRESSES,     // Base Sepolia
  80002: POLYGON_AMOY_CONTRACT_ADDRESSES,     // Polygon Amoy
};

// Get contract addresses for a specific chain (defaults to Base Sepolia)
export function getContractAddresses(chainId: number): ContractAddresses {
  return CONTRACT_ADDRESSES_BY_CHAIN[chainId] || BASE_SEPOLIA_CONTRACT_ADDRESSES;
}

// Active chain ID tracker
let _activeChainId: number = 84532; // Default: Base Sepolia

// Switch the active chain — mutates CONTRACT_ADDRESSES, TOKEN_LIST, getTokenByAddress, getTokenBySymbol in-place
// Called from NetworkContext when user switches networks
export function setActiveChainId(chainId: number) {
  _activeChainId = chainId;
  // Update CONTRACT_ADDRESSES in-place so all imports see the new values
  Object.assign(CONTRACT_ADDRESSES, getContractAddresses(chainId));
  // Update TOKEN_LIST in-place
  const newTokens = getTokenListForChain(chainId);
  TOKEN_LIST.length = 0;
  TOKEN_LIST.push(...newTokens);
}

export function getActiveChainId(): number {
  return _activeChainId;
}

// Fiat features are only available on Base chains (Base Sepolia testnet, Base mainnet)
export const FIAT_SUPPORTED_CHAIN_IDS = [84532, 8453] as const; // Base Sepolia, Base Mainnet

export function isFiatSupportedChain(chainId: number): boolean {
  return (FIAT_SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function isFiatSupportedOnActiveChain(): boolean {
  return isFiatSupportedChain(_activeChainId);
}

// Native ETH address (used as placeholder for native token)
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address;

// Supported tokens on Base Sepolia (Testnet)
export const SUPPORTED_TOKENS = {
  ETH: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    icon: '/tokens/eth.svg',
    isNative: true,
  },
  WETH: {
    address: '0x7bcB620CD64775503BBEd5e789A44cBC351cA8CB' as Address, // Base Sepolia WETH (Mock)
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    icon: '/tokens/weth.svg',
    isNative: false,
  },
  USDC: {
    address: '0xDdc0F4DF08005f6c29D35a68D46d31B747564a20' as Address, // Base Sepolia USDC (Mock)
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: '/tokens/usdc.svg',
    isNative: false,
  },
  USDT: {
    address: '0x87bF471B054151e5E4F13E0D1DDE7Ffb5535d6dA' as Address, // Base Sepolia USDT (Mock)
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    icon: '/tokens/usdt.svg',
    isNative: false,
  },
  DAI: {
    address: '0xe282547aaC06762Cd7af6B2cDcc76f50b755852c' as Address, // Base Sepolia DAI (Mock)
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    icon: '/tokens/dai.svg',
    isNative: false,
  },
  WBTC: {
    address: '0xc76Cb414fD702b581E24d524a4756c7c622Aa903' as Address, // Base Sepolia WBTC (Mock)
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    icon: '/tokens/wbtc.svg',
    isNative: false,
  },
  LINK: {
    address: '0xdDA1f6c82F4B9036853879443930423A3F200129' as Address, // Base Sepolia LINK (Mock)
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    icon: '/tokens/link.svg',
    isNative: false,
  },
  UNI: {
    address: '0x108ac290C9D230DC0189A1d433F193c7f14c2b23' as Address, // Base Sepolia UNI (Mock)
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    icon: '/tokens/uni.svg',
    isNative: false,
  },
} as const;

// Token addresses by chain (for multi-chain support)
export const TOKENS_BY_CHAIN: Record<number, typeof SUPPORTED_TOKENS> = {
  // Base Sepolia (84532)
  84532: SUPPORTED_TOKENS,
  // Polygon Amoy (80002)
  80002: {
    ETH: { ...SUPPORTED_TOKENS.ETH },
    WETH: { ...SUPPORTED_TOKENS.WETH, address: (process.env.NEXT_PUBLIC_POLYGON_AMOY_MOCK_WETH || ZERO_ADDRESS) as Address },
    USDC: { ...SUPPORTED_TOKENS.USDC, address: (process.env.NEXT_PUBLIC_POLYGON_AMOY_MOCK_USDC || ZERO_ADDRESS) as Address },
    USDT: { ...SUPPORTED_TOKENS.USDT, address: (process.env.NEXT_PUBLIC_POLYGON_AMOY_MOCK_USDT || ZERO_ADDRESS) as Address },
    DAI: { ...SUPPORTED_TOKENS.DAI, address: (process.env.NEXT_PUBLIC_POLYGON_AMOY_MOCK_DAI || ZERO_ADDRESS) as Address },
    WBTC: { ...SUPPORTED_TOKENS.WBTC, address: (process.env.NEXT_PUBLIC_POLYGON_AMOY_MOCK_WBTC || ZERO_ADDRESS) as Address },
    LINK: { ...SUPPORTED_TOKENS.LINK, address: (process.env.NEXT_PUBLIC_POLYGON_AMOY_MOCK_LINK || ZERO_ADDRESS) as Address },
    UNI: { ...SUPPORTED_TOKENS.UNI, address: (process.env.NEXT_PUBLIC_POLYGON_AMOY_MOCK_UNI || ZERO_ADDRESS) as Address },
  },
  // Sepolia (11155111)
  11155111: {
    ETH: { ...SUPPORTED_TOKENS.ETH },
    WETH: { ...SUPPORTED_TOKENS.WETH, address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as Address },
    USDC: { ...SUPPORTED_TOKENS.USDC, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address },
    USDT: { ...SUPPORTED_TOKENS.USDT, address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06' as Address },
    DAI: { ...SUPPORTED_TOKENS.DAI, address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574' as Address },
    WBTC: { ...SUPPORTED_TOKENS.WBTC, address: ZERO_ADDRESS },
    LINK: { ...SUPPORTED_TOKENS.LINK, address: '0x779877A7B0D9E8603169DdbD7836e478b4624789' as Address },
    UNI: { ...SUPPORTED_TOKENS.UNI, address: ZERO_ADDRESS },
  },
  // Anvil (31337) - uses same addresses as Base Sepolia or deploy your own
  31337: SUPPORTED_TOKENS,
};

// Filter out native ETH since it's not enabled in LTV config
// Use WETH instead of native ETH for now
export const TOKEN_LIST = Object.values(SUPPORTED_TOKENS).filter(token => !token.isNative);

// Chain-aware token list (excludes native token)
export function getTokenListForChain(chainId: number) {
  const tokens = TOKENS_BY_CHAIN[chainId] || SUPPORTED_TOKENS;
  return Object.values(tokens).filter(token => !token.isNative);
}

export const getTokenByAddress = (address: Address | undefined) => {
  if (!address) return undefined;
  return TOKEN_LIST.find(token => token.address.toLowerCase() === address.toLowerCase());
};

// Chain-aware token lookup by address
export function getTokenByAddressForChain(address: Address | undefined, chainId: number) {
  if (!address) return undefined;
  const tokens = getTokenListForChain(chainId);
  return tokens.find(token => token.address.toLowerCase() === address.toLowerCase());
}

export const getTokenBySymbol = (symbol: string) => {
  return TOKEN_LIST.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
};

// Chain-aware token lookup by symbol
export function getTokenBySymbolForChain(symbol: string, chainId: number) {
  const tokens = getTokenListForChain(chainId);
  return tokens.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
}

// Chain configuration
export const CHAIN_CONFIG = {
  // Mainnets
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  },
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  avalanche: {
    id: 43114,
    name: 'Avalanche C-Chain',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  },
  // Testnets
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  polygonAmoy: {
    id: 80002,
    name: 'Polygon Amoy',
    rpcUrl: 'https://polygon-amoy.drpc.org',
    blockExplorer: 'https://amoy.polygonscan.com',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  },
  sepolia: {
    id: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  arbitrumSepolia: {
    id: 421614,
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  optimismSepolia: {
    id: 11155420,
    name: 'Optimism Sepolia',
    rpcUrl: 'https://sepolia.optimism.io',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  // Local Development
  anvil: {
    id: 31337,
    name: 'Anvil (Local)',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: '',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
} as const;

// Testnet chains
export const TESTNET_CHAINS = [
  CHAIN_CONFIG.baseSepolia,
  CHAIN_CONFIG.polygonAmoy,
  CHAIN_CONFIG.sepolia,
  CHAIN_CONFIG.arbitrumSepolia,
  CHAIN_CONFIG.optimismSepolia,
  CHAIN_CONFIG.anvil,
] as const;

// Mainnet chains
export const MAINNET_CHAINS = [
  CHAIN_CONFIG.base,
  CHAIN_CONFIG.ethereum,
  CHAIN_CONFIG.arbitrum,
  CHAIN_CONFIG.optimism,
  CHAIN_CONFIG.polygon,
  CHAIN_CONFIG.bsc,
  CHAIN_CONFIG.avalanche,
] as const;

// Supported chains for the app (Testnets only for development)
export const SUPPORTED_CHAINS = [
  CHAIN_CONFIG.baseSepolia,
  CHAIN_CONFIG.polygonAmoy,
  CHAIN_CONFIG.sepolia,
  CHAIN_CONFIG.arbitrumSepolia,
  CHAIN_CONFIG.optimismSepolia,
  CHAIN_CONFIG.anvil,
] as const;
// Default chain (change for production)
export const DEFAULT_CHAIN = CHAIN_CONFIG.baseSepolia;

// Get chain by ID
export const getChainById = (chainId: number) => {
  return Object.values(CHAIN_CONFIG).find(chain => chain.id === chainId);
};

// Get tokens for a specific chain
export const getTokensForChain = (chainId: number) => {
  return TOKENS_BY_CHAIN[chainId] || SUPPORTED_TOKENS;
};

// Check if token is native ETH
export const isNativeToken = (address: Address) => {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
};
