export async function withTimeoutSubmit<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);

    // Check if the result indicates a server/network error that should be treated as offline
    if (
      result &&
      typeof result === "object" &&
      "success" in result &&
      !result.success
    ) {
      const error = (result as any).error || "";
      const isServerError =
        error.includes("Request failed") ||
        error.includes("Network Error") ||
        error.includes("502") ||
        error.includes("503") ||
        error.includes("500") ||
        error.includes("504") ||
        error.includes("ECONNREFUSED") ||
        error.includes("ENOTFOUND") ||
        error.includes("ENETUNREACH");

      if (isServerError) {
        console.log(
          "🔄 Server error detected, treating as offline scenario:",
          error
        );
        // Throw an error to trigger the offline handling in the catch block
        throw new Error("Server unavailable - storing offline");
      }
    }

    return result;
  } catch (error: any) {
    // If it's our custom offline error or a network/timeout error,
    // let the calling function handle it as offline
    if (
      error.message?.includes("storing offline") ||
      error.message?.includes("timed out") ||
      error.message?.includes("Network Error") ||
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND"
    ) {
      throw error; // Re-throw to be caught in convertAndSubmit
    }

    // For other errors, also treat as offline scenario
    throw new Error("Connection failed - storing offline");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
