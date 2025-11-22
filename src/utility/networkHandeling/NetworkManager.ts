// NetworkManager.ts - Simplified: online OR offline only
import NetInfo from "@react-native-community/netinfo";
import { AppState, AppStateStatus } from "react-native";

type ConnectionStatus = "online" | "offline";
type NetworkListener = (status: ConnectionStatus) => void;

class NetworkManager {
  private static instance: NetworkManager;
  private listeners = new Set<NetworkListener>();
  private currentStatus: ConnectionStatus = "online";
  private consecutiveFailures = 0;
  private lastCheckTime = 0;
  private isAppActive = true;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private periodicCheckId: ReturnType<typeof setInterval> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private isChecking = false;
  private activeAbortControllers = new Set<AbortController>();

  private readonly RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000];
  private readonly MIN_CHECK_INTERVAL = 1000;
  private readonly MAX_RETRIES = 10;
  private readonly PING_TIMEOUT = 4000;
  private readonly PERIODIC_CHECK_INTERVAL = 30000;

  private readonly CONNECTIVITY_ENDPOINTS = [
    "https://www.google.com/generate_204",
    "https://www.gstatic.com/generate_204",
    "https://captive.apple.com/hotspot-detect.html",
    "https://dns.google/resolve?name=google.com&type=A",
  ];

  private constructor() {
    this.initializeListeners();
    this.startPeriodicChecks();
  }

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private initializeListeners() {
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      console.log(`📡 NetInfo update:`, {
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });

      // No network connection at all
      if (!state.isConnected) {
        console.log("❌ No network connection");
        this.consecutiveFailures = 5;
        this.updateStatus("offline");
        this.startRetryWithBackoff();
        return;
      }

      // Connected but no internet
      if (state.isConnected && state.isInternetReachable === false) {
        console.log("⚠️ Connected but NO INTERNET");
        this.updateStatus("offline");
        this.startRetryWithBackoff();
        return;
      }

      // Internet is reachable
      if (state.isConnected && state.isInternetReachable === true) {
        console.log("✅ Internet reachable");
        this.consecutiveFailures = 0;
        this.updateStatus("online");
        this.clearRetryTimeout();
        return;
      }

      // Unknown status - verify with ping
      if (state.isConnected && state.isInternetReachable === null) {
        console.log("🔍 Internet status UNKNOWN - verifying...");
        this.checkConnectionQuality();
        return;
      }
    });

    this.appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        const wasActive = this.isAppActive;
        this.isAppActive = nextAppState === "active";

        if (this.isAppActive && !wasActive) {
          console.log("📱 App came to foreground - checking connection");
          this.checkConnectionQuality();
        }

        if (!this.isAppActive) {
          this.cancelActiveChecks();
        }
      }
    );
  }

  private startPeriodicChecks() {
    this.periodicCheckId = setInterval(() => {
      if (this.isAppActive && this.currentStatus === "online") {
        console.log("⏰ Periodic connectivity check");
        this.checkConnectionQuality();
      }
    }, this.PERIODIC_CHECK_INTERVAL);
  }

  reportRequestResult(success: boolean, responseTime?: number) {
    const now = Date.now();

    if (now - this.lastCheckTime < this.MIN_CHECK_INTERVAL) {
      return;
    }

    this.lastCheckTime = now;

    if (success) {
      this.consecutiveFailures = 0;
      this.updateStatus("online");
      this.clearRetryTimeout();
    } else {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= 2) {
        this.updateStatus("offline");
      }

      this.startRetryWithBackoff();
    }
  }

  private startRetryWithBackoff() {
    this.clearRetryTimeout();

    if (!this.isAppActive || this.consecutiveFailures >= this.MAX_RETRIES) {
      if (this.consecutiveFailures >= this.MAX_RETRIES) {
        console.log(`🛑 Max retries reached`);
      }
      return;
    }

    const delayIndex = Math.min(
      this.consecutiveFailures,
      this.RETRY_DELAYS.length - 1
    );
    const delay = this.RETRY_DELAYS[delayIndex];

    console.log(
      `🔄 Retry in ${delay}ms (${this.consecutiveFailures}/${this.MAX_RETRIES})`
    );

    this.retryTimeoutId = setTimeout(() => {
      this.checkConnectionQuality();
    }, delay);
  }

  private clearRetryTimeout() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private cancelActiveChecks() {
    this.activeAbortControllers.forEach((controller) => {
      controller.abort();
    });
    this.activeAbortControllers.clear();
    this.isChecking = false;
  }

  private async checkConnectionQuality() {
    if (this.isChecking) {
      console.log("⏭️ Check in progress, skipping");
      return;
    }

    this.isChecking = true;

    try {
      const checkPromises = this.CONNECTIVITY_ENDPOINTS.map((url) =>
        this.pingEndpoint(url)
      );

      const results = await Promise.allSettled(checkPromises);

      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      );

      const anySuccess = successful.length > 0;

      if (anySuccess) {
        console.log(
          `✅ Connection OK (${successful.length}/${results.length} endpoints)`
        );
        this.reportRequestResult(true);
      } else {
        console.log(`❌ All endpoints failed`);
        this.reportRequestResult(false);
      }
    } catch (error) {
      console.log(`❌ Check error:`, error);
      this.reportRequestResult(false);
    } finally {
      this.isChecking = false;
    }
  }

  private async pingEndpoint(
    url: string
  ): Promise<{ success: boolean; latency: number }> {
    const controller = new AbortController();
    this.activeAbortControllers.add(controller);
    const startTime = Date.now();

    try {
      const timeoutId = setTimeout(() => controller.abort(), this.PING_TIMEOUT);

      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      const success = response.ok || response.status === 204;
      return { success, latency };
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.log(`⚠️ ${url} failed:`, error.message);
      }
      return { success: false, latency: 0 };
    } finally {
      this.activeAbortControllers.delete(controller);
    }
  }

  private updateStatus(status: ConnectionStatus) {
    if (this.currentStatus !== status) {
      console.log(`📡 Status: ${this.currentStatus} → ${status}`);
      this.currentStatus = status;
      this.notifyListeners(status);
    }
  }

  private notifyListeners(status: ConnectionStatus) {
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error("Listener error:", error);
      }
    });
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  getCurrentStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  forceCheck() {
    if (!this.isChecking) {
      console.log("🔄 Force check triggered");
      this.checkConnectionQuality();
    }
  }

  cleanup() {
    this.cancelActiveChecks();

    if (this.periodicCheckId) {
      clearInterval(this.periodicCheckId);
      this.periodicCheckId = null;
    }

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.clearRetryTimeout();
    this.listeners.clear();
  }
}

export default NetworkManager.getInstance();
