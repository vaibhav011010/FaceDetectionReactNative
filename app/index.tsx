// app/index.tsx
import React, { useEffect, useContext } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  InteractionManager,
} from "react-native";
import { useRouter } from "expo-router";
import { LoginContext } from "./context/LoginContext";

export default function SplashScreen() {
  const router = useRouter();
  const { isLoggedIn } = useContext(LoginContext);

  useEffect(() => {
    // Add a slight delay to ensure the root layout is mounted
    const navigationTask = InteractionManager.runAfterInteractions(() => {
      if (isLoggedIn) {
        router.replace("/checkin-screen");
      } else {
        router.replace("/login");
      }
    });

    return () => navigationTask.cancel();
  }, [isLoggedIn]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
      }}
    ></View>
  );
}
