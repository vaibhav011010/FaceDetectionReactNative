import { Slot } from "expo-router";
import { LoginProvider } from "./context/LoginContext";
import { Provider } from "react-redux";
import { store } from "./store";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { syncVisitors } from "./api/visitorForm";
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
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSyncTime = useRef<number>(0);

  // Network connectivity handler
  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      if (state.isConnected) {
        const now = Date.now();
        if (now - lastSyncTime.current > 30000) {
          InteractionManager.runAfterInteractions(() => {
            syncVisitors()
              .then(() => (lastSyncTime.current = Date.now()))
              .catch(console.error);
          });
        }
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    return () => unsubscribe();
  }, []);

  // Memory and app state handlers
  useEffect(() => {
    const handleMemoryWarning = () => {
      if (PERF_LOGGING_ENABLED) {
        console.warn(`${LOG_PREFIX} Memory warning received`);
      }
    };

    const handleAppStateChange = (state: AppStateStatus) => {
      console.log(`App state: ${state}`);
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
    };
  }, []);

  return (
    <Provider store={store}>
      <LoginProvider>
        <Slot />
      </LoginProvider>
    </Provider>
  );
}
