import axios, { AxiosError } from "axios";

export const withTimeout = async <T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>, // take a factory so we can pass signal
  timeout: number = 3000
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await promiseFactory(controller.signal);
  } catch (error: any) {
    if (
      (axios.isAxiosError(error) && error.code === "ERR_CANCELED") ||
      error.name === "CanceledError" ||
      error.message === "canceled"
    ) {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
