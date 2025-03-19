import { Slot } from "expo-router";
import { LoginProvider } from "./context/LoginContext";
import { Provider } from "react-redux";
import { store } from "./store";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { syncVisitors } from "./api/visitorForm"; // adjust the path if needed

export default function Layout() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        console.log("Network connected, syncing visitors...");
        syncVisitors();
      }
    });
    return () => {
      unsubscribe();
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
