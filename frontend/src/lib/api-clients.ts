import axios, { AxiosInstance } from "axios";

let apiClient: AxiosInstance | null = null;

export const getApiClient = () => {
  if (apiClient) {
    return apiClient;
  }

  const baseURL = process.env["NEXT_PUBLIC_API_URL"];

  if (!baseURL) {
    throw new Error("NEXT_PUBLIC_API_URL is not defined in environment variables");
  }

  apiClient = axios.create({
    baseURL,
    timeout: 60000,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    validateStatus: (status) => status >= 200 && status !== 401 && status !== 403,
  });

  apiClient.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  return apiClient;
};
