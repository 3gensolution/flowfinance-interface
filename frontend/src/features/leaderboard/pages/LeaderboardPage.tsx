'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveLeaderboardSeason, fetchLeaderboard, fetchLeaderboardMe } from '@/services/query/leaderboard';
import { cn } from '@/lib/utils';
import { useAccount } from 'wagmi';

function formatIntString(value: string): string {
  const v = value ?? '0';
  const negative = v.startsWith('-');
  const digits = negative ? v.slice(1) : v;
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return negative ? `-${formatted}` : formatted;
}

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [page, setPage] = useState(1);
  const limit = 25;

  const activeSeasonQuery = useQuery({
    queryKey: ['leaderboard', 'activeSeason'],
    queryFn: async () => (await fetchActiveLeaderboardSeason()).data.data,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });

  const seasonId = activeSeasonQuery.data?.id;

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', 'season', seasonId, page, limit],
    queryFn: async () => (await fetchLeaderboard({ seasonId, page, limit })).data.data,
    enabled: !!seasonId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });

  const items = leaderboardQuery.data?.items ?? [];
  const total = leaderboardQuery.data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const meQuery = useQuery({
    queryKey: ['leaderboard', 'me', address],
    queryFn: async () => (await fetchLeaderboardMe(address!)).data.data,
    enabled: !!address,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });

  return (
    <main className="min-h-screen bg-black text-white pt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-gray-400">
            Season XP ranks reset each season. KYC XP is lifetime-only.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Active season</div>
                <div className="font-medium">
                  {activeSeasonQuery.isLoading ? 'Loading…' : activeSeasonQuery.data?.seasonKey ?? '—'}
                </div>
              </div>
              <div className="text-sm text-gray-400">
                {leaderboardQuery.isFetching ? 'Updating…' : `${total.toLocaleString()} players`}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-white/10">
                    <th className="text-left px-5 py-3 w-16">#</th>
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-right px-5 py-3 w-40">Season XP</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardQuery.isLoading ? (
                    <tr>
                      <td className="px-5 py-6 text-gray-400" colSpan={3}>
                        Loading leaderboard…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-gray-400" colSpan={3}>
                        No rankings yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr key={`${row.userId}-${row.rank}`} className="border-b border-white/5">
                        <td className="px-5 py-3 text-gray-300">{row.rank}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium">{row.displayName}</div>
                          <div className="text-xs text-gray-500">{row.walletAddress}</div>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold">
                          {formatIntString(row.seasonXp)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Page {page} / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={cn(
                    'px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm',
                    page <= 1 && 'opacity-50 pointer-events-none',
                  )}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  className={cn(
                    'px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm',
                    page >= totalPages && 'opacity-50 pointer-events-none',
                  )}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-6">
            <div>
              <div className="text-sm text-gray-400">You</div>
              {!address ? (
                <div className="mt-2 text-sm text-gray-400">Connect wallet to see your stats.</div>
              ) : meQuery.isLoading ? (
                <div className="mt-2 text-sm text-gray-400">Loading…</div>
              ) : (
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Season XP</span>
                    <span className="font-semibold">{formatIntString(meQuery.data?.seasonXp ?? '0')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Lifetime XP</span>
                    <span className="font-semibold">{formatIntString(meQuery.data?.lifetimeXp ?? '0')}</span>
                  </div>
                  {meQuery.data?.isLinked === false && (
                    <div className="text-xs text-amber-300/90">
                      Wallet-first scoring is enabled. Complete KYC to unlock the extra 5000 lifetime XP bonus.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="text-sm text-gray-400">XP priorities</div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>KYC verified (lifetime)</span>
                <span className="font-semibold">5000</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Cross-chain lending</span>
                <span className="font-semibold">2000</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Fiat transactions</span>
                <span className="font-semibold">1000</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Lending</span>
                <span className="font-semibold">500</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Borrowing</span>
                <span className="font-semibold">250</span>
              </li>
            </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
