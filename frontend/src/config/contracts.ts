import { Address } from 'viem';

// Contract addresses on Base Sepolia
export const CONTRACT_ADDRESSES = {
  loanMarketPlace: process.env.NEXT_PUBLIC_LOAN_MARKETPLACE_ADDRESS as Address || '0x0000000000000000000000000000000000000000' as Address,
  configuration: process.env.NEXT_PUBLIC_CONFIGURATION_ADDRESS as Address || '0x0000000000000000000000000000000000000000' as Address,
  collateralEscrow: process.env.NEXT_PUBLIC_COLLATERAL_ESCROW_ADDRESS as Address || '0x0000000000000000000000000000000000000000' as Address,
  ltvConfig: process.env.NEXT_PUBLIC_LTV_CONFIG_ADDRESS as Address || '0x0000000000000000000000000000000000000000' as Address,
} as const;

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
  // Sepolia (11155111)
  11155111: {
    ETH: { ...SUPPORTED_TOKENS.ETH },
    WETH: { ...SUPPORTED_TOKENS.WETH, address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as Address },
    USDC: { ...SUPPORTED_TOKENS.USDC, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address },
    USDT: { ...SUPPORTED_TOKENS.USDT, address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06' as Address },
    DAI: { ...SUPPORTED_TOKENS.DAI, address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574' as Address },
    WBTC: { ...SUPPORTED_TOKENS.WBTC, address: '0x0000000000000000000000000000000000000000' as Address },
    LINK: { ...SUPPORTED_TOKENS.LINK, address: '0x779877A7B0D9E8603169DdbD7836e478b4624789' as Address },
    UNI: { ...SUPPORTED_TOKENS.UNI, address: '0x0000000000000000000000000000000000000000' as Address },
  },
  // Anvil (31337) - uses same addresses as Base Sepolia or deploy your own
  31337: SUPPORTED_TOKENS,
};

// Filter out native ETH since it's not enabled in LTV config
// Use WETH instead of native ETH for now
export const TOKEN_LIST = Object.values(SUPPORTED_TOKENS).filter(token => !token.isNative);

export const getTokenByAddress = (address: Address | undefined) => {
  if (!address) return undefined;
  return TOKEN_LIST.find(token => token.address.toLowerCase() === address.toLowerCase());
};

export const getTokenBySymbol = (symbol: string) => {
  return TOKEN_LIST.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
};

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
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
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

// Supported chains for the app (Testnets only for development)
export const SUPPORTED_CHAINS = [
  CHAIN_CONFIG.baseSepolia,
  CHAIN_CONFIG.sepolia,
  CHAIN_CONFIG.arbitrumSepolia,
  CHAIN_CONFIG.optimismSepolia,
  CHAIN_CONFIG.anvil,
] as const;

// Mainnet chains (for production - uncomment when ready)
// export const SUPPORTED_CHAINS = [
//   CHAIN_CONFIG.base,
//   CHAIN_CONFIG.ethereum,
//   CHAIN_CONFIG.arbitrum,
//   CHAIN_CONFIG.optimism,
//   CHAIN_CONFIG.polygon,
// ] as const;

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
