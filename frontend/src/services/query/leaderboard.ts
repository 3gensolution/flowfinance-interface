import { getApiClient } from '@/lib/api-clients';
import { resolveRoute, ROUTES } from '@/lib/routes';
import { AxiosResponse } from 'axios';

export type ActiveSeasonResponse = {
  success: boolean;
  data: {
    id: number;
    seasonKey: string;
    startsAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'ENDED' | 'FINALIZED';
  };
};

export type LeaderboardItem = {
  rank: number;
  userId: string;
  walletAddress: string;
  seasonXp: string;
  displayName: string;
};

export type LeaderboardResponse = {
  success: boolean;
  data: {
    seasonId: number;
    page: number;
    limit: number;
    total: number;
    items: LeaderboardItem[];
  };
};

export type LeaderboardMeResponse = {
  success: boolean;
  data: {
    userId?: string;
    displayName?: string;
    walletAddress: string;
    season: { id: number; seasonKey: string; startsAt: string; endsAt: string };
    seasonXp: string;
    lifetimeXp: string;
    rank: number | null;
    isLinked?: boolean;
  };
};

export async function fetchActiveLeaderboardSeason() {
  return await getApiClient().get<ActiveSeasonResponse, AxiosResponse<ActiveSeasonResponse>>(
    `${resolveRoute(ROUTES.leaderboardActiveSeason)}?_ts=${Date.now()}`,
  );
}

export async function fetchLeaderboard(params?: { seasonId?: number; page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.seasonId) search.set('seasonId', String(params.seasonId));
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));

  const path = resolveRoute(ROUTES.leaderboard);
  search.set('_ts', String(Date.now()));
  const url = `${path}?${search.toString()}`;

  return await getApiClient().get<LeaderboardResponse, AxiosResponse<LeaderboardResponse>>(url);
}

export async function fetchLeaderboardMe(walletAddress: string) {
  const search = new URLSearchParams({ walletAddress });
  search.set('_ts', String(Date.now()));
  const path = resolveRoute(ROUTES.leaderboardMe);
  return await getApiClient().get<LeaderboardMeResponse, AxiosResponse<LeaderboardMeResponse>>(
    `${path}?${search.toString()}`,
  );
}
