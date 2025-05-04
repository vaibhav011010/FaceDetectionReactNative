import { Slot } from "expo-router";
import { LoginProvider } from "./context/LoginContext";
import { Provider } from "react-redux";
import { store } from "./store";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import {
  syncVisitors,
  startPeriodicSync,
  stopPeriodicSync,
} from "./api/visitorForm";
import { PermissionProvider } from "../src/utility/permissionContext";
import {
  LogBox,
  InteractionManager,
  AppState,
  AppStateStatus,
} from "react-native";

const PERF_LOGGING_ENABLED = __DEV__;
const LOG_PREFIX = "[ENTRY_PERF]";

if (!__DEV__) {
  LogBox.ignoreAllLogs();
}

export default function Layout() {
  const lastSyncTime = useRef<number>(0);

  // Network connectivity handler - triggers sync when network becomes available
  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      if (state.isConnected) {
        const now = Date.now();
        if (now - lastSyncTime.current > 30000) {
          // Throttle to prevent too many syncs
          InteractionManager.runAfterInteractions(() => {
            console.log("Network connected, triggering sync");
            syncVisitors()
              .then((result) => {
                lastSyncTime.current = Date.now();
                console.log("Network reconnect sync result:", result);
              })
              .catch((error) => {
                console.error("Network reconnect sync error:", error);
              });
          });
        }
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Initial network check and possible sync
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        console.log("Initial network check: Connected");
        // Start periodic sync on initial load if connected
        startPeriodicSync();
      } else {
        console.log("Initial network check: Not connected");
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle app state changes for memory warnings and logging
  useEffect(() => {
    const handleMemoryWarning = () => {
      if (PERF_LOGGING_ENABLED) {
        console.warn(`${LOG_PREFIX} Memory warning received`);
      }
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      console.log(`App state: ${state}`);

      // When app comes to foreground, check for pending syncs
      if (state === "active") {
        NetInfo.fetch().then((netState) => {
          if (netState.isConnected) {
            // App has come to foreground with network connection
            // Only sync if it's been a while
            const now = Date.now();
            if (now - lastSyncTime.current > 30000) {
              InteractionManager.runAfterInteractions(() => {
                syncVisitors()
                  .then((result) => {
                    lastSyncTime.current = Date.now();
                    console.log("Foreground sync result:", result);
                  })
                  .catch(console.error);
              });
            }
          }
        });
      }
    };

    const memorySub = AppState.addEventListener(
      "memoryWarning",
      handleMemoryWarning
    );
    const appStateSub = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      memorySub.remove();
      appStateSub.remove();
      stopPeriodicSync();
    };
  }, []);

  return (
    <Provider store={store}>
      <LoginProvider>
        <PermissionProvider>
          <Slot />
        </PermissionProvider>
      </LoginProvider>
    </Provider>
  );
}
