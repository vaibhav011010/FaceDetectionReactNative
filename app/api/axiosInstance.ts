// axiosInstance.ts
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import NetInfo from "@react-native-community/netinfo";
import {
  getTokensForUser,
  refreshAccessTokenForUser,
  getCurrentUserId,
} from "./auth";

const API_BASE_URL = "https://quikcheckapi.site/";

//const API_BASE_URL = "https://webapptest3.online";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // 20 sec timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Variables to manage concurrent refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

// Process queued requests after refresh
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

// Extend InternalAxiosRequestConfig to include optional metadata and _retry
interface AuthRequestConfig extends InternalAxiosRequestConfig {
  metadata?: { userId?: number };
  _retry?: boolean;
}

// Request interceptor: attach correct token per user
axiosInstance.interceptors.request.use(
  async (configOrig: InternalAxiosRequestConfig) => {
    const config = configOrig as AuthRequestConfig;
    const netState = await NetInfo.fetch();

    // Determine which userId to use: metadata.userId or current
    let userId = config.metadata?.userId;
    if (userId == null) {
      userId = await getCurrentUserId();
    }

    // Fetch stored tokens for that user
    let { accessToken } = await getTokensForUser(userId);

    // If online, attempt to refresh that user’s token
    if (netState.isConnected) {
      try {
        const newAccess = await refreshAccessTokenForUser(userId);
        if (newAccess) accessToken = newAccess;
      } catch {
        // swallow refresh errors, use existing token
      }
    }

    // Ensure headers object
    config.headers = config.headers ?? {};
    (
      config.headers as Record<string, string>
    ).Authorization = `JWT ${accessToken}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: if a 401 occurs, refresh the token for that user and retry
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AuthRequestConfig;
    const status = error.response?.status;

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Determine userId for this request
      let userId = originalRequest.metadata?.userId;
      if (userId == null) {
        userId = await getCurrentUserId();
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            (
              originalRequest.headers as Record<string, string>
            ).Authorization = `JWT ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;
      return new Promise(async (resolve, reject) => {
        try {
          const newToken = await refreshAccessTokenForUser(userId!);
          processQueue(null, newToken);
          (
            originalRequest.headers as Record<string, string>
          ).Authorization = `JWT ${newToken}`;
          resolve(axiosInstance(originalRequest));
        } catch (err) {
          processQueue(err, null);
          reject(err);
        } finally {
          isRefreshing = false;
        }
      });
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
