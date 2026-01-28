import { getApiClient } from "@/lib/api-clients";
import { resolveRoute, ROUTES } from "@/lib/routes";
import { AxiosResponse } from "axios";

type GenerateLinkPayload = {
  walletAddress: string;
};

export type GenerateLinkResponse = {
  success: boolean;
  data: {
    code: string;
    url: string;
    expiresAt: string;
  };
};

export const generateLink = async (payload: GenerateLinkPayload) => {
  return await getApiClient().post<
    GenerateLinkResponse,
    AxiosResponse<GenerateLinkResponse>,
    GenerateLinkPayload
  >(resolveRoute(ROUTES.generateLink), payload);
};
