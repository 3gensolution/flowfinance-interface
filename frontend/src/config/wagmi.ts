import type { Config } from 'wagmi';

function ensureServerLocalStorageShim() {
  // During Next.js prerender/build, we're running in Node (no `window`), but on recent Node versions
  // `globalThis.localStorage` may exist as a partial stub (missing `getItem` / `setItem`), which can
  // crash dependencies that check only for the existence of `localStorage`.
  if (typeof window !== 'undefined') return;

  const g = globalThis as unknown as { localStorage?: unknown };
  const ls = g.localStorage as { getItem?: unknown; setItem?: unknown } | undefined;
  const needsShim =
    !!ls && (typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function');

  if (!needsShim) return;

  const store = new Map<string, string>();
  g.localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

ensureServerLocalStorageShim();

// Singleton pattern to prevent multiple WalletConnect initializations
let configInstance: Config | null = null;

if(!process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]) {
  console.warn('Warning: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Please set it in your environment variables.');
}

function createConfig() {
  if (configInstance) {
    return configInstance;
  }

  /* eslint-disable @typescript-eslint/no-require-imports */
  const { getDefaultConfig } = require('@rainbow-me/rainbowkit') as typeof import('@rainbow-me/rainbowkit');
  const {
    // Testnets
    baseSepolia,
    polygonAmoy,
    sepolia,
    arbitrumSepolia,
    optimismSepolia,
    foundry,
    // Mainnets
    base,
  } = require('wagmi/chains') as typeof import('wagmi/chains');
  const { http } = require('wagmi') as typeof import('wagmi');
  /* eslint-enable @typescript-eslint/no-require-imports */

  // Batch JSON-RPC requests per-transport to reduce rate-limit errors (429) on public RPCs.
  // See: viem `http(..., { batch: true | { wait, batchSize } })`
  const batch = { batch: { wait: 25 } as const };

  configInstance = getDefaultConfig({
    appName: 'Awinfi',
    projectId: process.env["NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"]!,
    chains: [
      // Testnets (Base Sepolia first as default)
      baseSepolia,
      polygonAmoy,
      sepolia,
      arbitrumSepolia,
      optimismSepolia,
      foundry,
      // Mainnets
      base,
    ],
    transports: {
      // Mainnet transports
      [base.id]: http('https://mainnet.base.org', batch),
      // Testnet transports
      [baseSepolia.id]: http('https://sepolia.base.org', batch),
      [polygonAmoy.id]: http('https://polygon-amoy.drpc.org', batch),
      [sepolia.id]: http('https://rpc.sepolia.org', batch),
      [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc', batch),
      [optimismSepolia.id]: http('https://sepolia.optimism.io', batch),
      [foundry.id]: http('http://127.0.0.1:8545', batch),
    },
    ssr: true,
  });

  return configInstance;
}

export const config = createConfig();
