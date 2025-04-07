// axiosInstance.ts
import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import { refreshAccessToken, getAccessToken } from "./auth";

const API_BASE_URL = "https://webapptest1.site/";

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

// Helper to process queued requests after refresh
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: attach token before sending the request.
axiosInstance.interceptors.request.use(
  async (config) => {
    const netState = await NetInfo.fetch();
    let token = await getAccessToken();

    // When online, attempt a token refresh.
    // (You might improve this by checking if the token is about to expire.)
    if (netState.isConnected) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        token = refreshedToken;
      }
    }

    if (token) {
      config.headers.Authorization = `JWT ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: if a 401 occurs, refresh the token and retry.
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // Queue the request if a refresh is already in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `JWT ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise(async (resolve, reject) => {
        try {
          const newToken = await refreshAccessToken();
          if (!newToken) {
            reject(error);
            return;
          }
          originalRequest.headers.Authorization = `JWT ${newToken}`;
          processQueue(null, newToken);
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
