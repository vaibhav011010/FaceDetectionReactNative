// app/index.tsx
import React, { useEffect, useContext } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { LoginContext } from "./context/LoginContext";

export default function SplashScreen() {
  const router = useRouter();
  const { isLoggedIn } = useContext(LoginContext);

  useEffect(() => {
    // Add a slight delay to ensure the root layout is mounted
    const timeout = setTimeout(() => {
      if (isLoggedIn) {
        // If already logged in, go to the main flow (checkin screen)
        router.replace("/checkin-screen");
      } else {
        // Otherwise, go to the login screen
        router.replace("/login");
      }
    }, 100); // Adjust the delay if needed

    return () => clearTimeout(timeout); // Cleanup
  }, [isLoggedIn]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Loading...</Text>
      <ActivityIndicator size="large" color="#03045E" />
    </View>
  );
}
