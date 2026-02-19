'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { getTokensForChain } from '@/config/contracts';
import { Droplets, Wallet, CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNetwork } from '@/contexts/NetworkContext';

// Mock ERC20 ABI - just the mint function
const MOCK_TOKEN_ABI = [
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Mint amounts per token
const MINT_AMOUNTS: Record<string, string> = {
  USDC: '10000', // 10,000 USDC
  USDT: '10000', // 10,000 USDT
  DAI: '10000',  // 10,000 DAI
  WETH: '10',    // 10 WETH
  WBTC: '1',     // 1 WBTC
  LINK: '100',   // 100 LINK
  UNI: '100',    // 100 UNI
};

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  isNative?: boolean;
}

interface TokenFaucetCardProps {
  token: TokenInfo;
  onMint: (tokenAddress: string, amount: bigint) => void;
  isPending: boolean;
  pendingToken: string | null;
}

function TokenFaucetCard({ token, onMint, isPending, pendingToken }: TokenFaucetCardProps) {
  const { address } = useAccount();
  const isThisTokenPending = isPending && pendingToken === token.symbol;

  // Skip native ETH - can't mint it
  if (token.symbol === 'ETH') return null;

  // Skip tokens with zero address (not deployed yet)
  if (token.address === '0x0000000000000000000000000000000000000000') {
    return (
      <Card className="p-4 opacity-50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-sm font-bold">{token.symbol.slice(0, 2)}</span>
          </div>
          <div>
            <h3 className="font-semibold">{token.symbol}</h3>
            <p className="text-sm text-gray-400">{token.name}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-3">Not deployed yet</p>
        <Button disabled className="w-full" size="sm">
          Coming Soon
        </Button>
      </Card>
    );
  }

  const mintAmount = MINT_AMOUNTS[token.symbol] || '100';
  const amountWithDecimals = parseUnits(mintAmount, token.decimals);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
          <span className="text-sm font-bold">{token.symbol.slice(0, 2)}</span>
        </div>
        <div>
          <h3 className="font-semibold">{token.symbol}</h3>
          <p className="text-sm text-gray-400">{token.name}</p>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-3">
        Mint <span className="text-white font-medium">{mintAmount} {token.symbol}</span> to your wallet
      </p>

      <Button
        onClick={() => onMint(token.address, amountWithDecimals)}
        disabled={isPending || !address}
        className="w-full"
        size="sm"
        icon={isThisTokenPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
      >
        {isThisTokenPending ? 'Minting...' : `Mint ${token.symbol}`}
      </Button>
    </Card>
  );
}

export default function FaucetPage() {
  const { isConnected } = useAccount();
  const { selectedNetwork } = useNetwork();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [lastConfirmedHash, setLastConfirmedHash] = useState<string | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Get tokens for the selected network
  const chainTokens = getTokensForChain(selectedNetwork.id);
  const tokenList = Object.values(chainTokens);

  const handleMint = async (tokenAddress: string, amount: bigint) => {
    const token = tokenList.find(t => t.address === tokenAddress);
    if (!token) return;

    setPendingToken(token.symbol);

    try {
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: MOCK_TOKEN_ABI,
        functionName: 'mint',
        args: [amount],
      });
      toast.success(`Minting ${token.symbol}...`);
    } catch (error) {
      console.error('Mint error:', error);
      toast.error('Failed to mint tokens');
      setPendingToken(null);
    }
  };

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess && hash && hash !== lastConfirmedHash && pendingToken) {
      toast.success(`Successfully minted ${pendingToken}!`);
      setLastConfirmedHash(hash);
      setPendingToken(null);
    }
  }, [isSuccess, hash, lastConfirmedHash, pendingToken]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center py-12">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            Connect your wallet to mint test tokens from the faucet.
          </p>
          <ConnectButton />
        </Card>
      </div>
    );
  }

  // Filter out native ETH from the token list
  const mintableTokens = tokenList.filter(t => !('isNative' in t && t.isNative));

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 mb-6">
            <Droplets className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Test Token <span className="gradient-text">Faucet</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Mint free test tokens to use on the platform. These tokens have no real value
            and are only for testing purposes on testnets.
          </p>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="bg-primary-500/10 border-primary-500/20">
            <div className="flex items-start gap-4 p-4">
              <AlertCircle className="w-6 h-6 text-primary-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary-400 mb-1">Testnet Only</h3>
                <p className="text-sm text-gray-400">
                  These are mock tokens deployed on testnets for development and testing.
                  Make sure you&apos;re connected to a testnet (Base Sepolia, Polygon Amoy, etc.) to use the faucet.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Token Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {mintableTokens.map((token) => (
            <TokenFaucetCard
              key={token.symbol}
              token={token}
              onMint={handleMint}
              isPending={isPending || isConfirming}
              pendingToken={pendingToken}
            />
          ))}
        </motion.div>

        {/* Transaction Status */}
        {hash && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <Card className="p-4">
              <div className="flex items-center gap-3">
                {isConfirming ? (
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
                )}
                <div>
                  <p className="font-medium">
                    {isConfirming ? 'Confirming transaction...' : isSuccess ? 'Transaction confirmed!' : 'Transaction pending...'}
                  </p>
                  <a
                    href={`${selectedNetwork.blockExplorer}/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-400 hover:underline flex items-center gap-1"
                  >
                    View on Explorer
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Get Testnet Gas Tokens */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12"
        >
          <h2 className="text-xl font-bold mb-4">Need Testnet Tokens for Gas?</h2>

          {/* Base Sepolia Faucets */}
          <h3 className="text-sm font-medium text-gray-400 mb-3">Base Sepolia (ETH)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <a
              href="https://www.alchemy.com/faucets/base-sepolia"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card hover className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Alchemy Faucet</h3>
                    <p className="text-sm text-gray-400">Get Base Sepolia ETH</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </div>
              </Card>
            </a>
            <a
              href="https://www.coinbase.com/faucets/base-ethereum-goerli-faucet"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card hover className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Coinbase Faucet</h3>
                    <p className="text-sm text-gray-400">Get Base testnet ETH</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </div>
              </Card>
            </a>
            <a
              href="https://sepoliafaucet.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card hover className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Sepolia Faucet</h3>
                    <p className="text-sm text-gray-400">Get Sepolia ETH</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </div>
              </Card>
            </a>
          </div>

          {/* Polygon Amoy Faucets */}
          <h3 className="text-sm font-medium text-gray-400 mb-3">Polygon Amoy (POL)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <a
              href="https://faucet.polygon.technology/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card hover className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Polygon Faucet</h3>
                    <p className="text-sm text-gray-400">Get Amoy POL (official)</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </div>
              </Card>
            </a>
            <a
              href="https://www.alchemy.com/faucets/polygon-amoy"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card hover className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Alchemy Faucet</h3>
                    <p className="text-sm text-gray-400">Get Polygon Amoy POL</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </div>
              </Card>
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
