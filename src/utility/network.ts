import axiosInstance from "../../app/api/axiosInstance";
import NetInfo from "@react-native-community/netinfo";

export async function safePost(
  url: string,
  data: any,
  options: any = {},
  timeout = 4000
) {
  const netInfo = await NetInfo.fetch();

  // 🚫 No internet
  if (!netInfo.isConnected) {
    throw new Error("No internet connection");
  }

  // ⏳ Timeout wrapper
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await axiosInstance.post(url, data, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
