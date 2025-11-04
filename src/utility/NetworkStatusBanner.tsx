import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import NetInfo from "@react-native-community/netinfo";

const { width } = Dimensions.get("window");

const NetworkStatusBanner = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected && state.isInternetReachable;

      // Only show banner if connection state changes
      if (isConnected !== connected) {
        setIsConnected(connected);
        setShowBanner(true);

        // Auto-hide the "back online" banner after 3 seconds
        if (connected) {
          setTimeout(() => {
            hideBanner();
          }, 3000);
        }
      }
    });

    return () => unsubscribe();
  }, [isConnected]);

  useEffect(() => {
    if (showBanner) {
      // Slide down animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [showBanner]);

  const hideBanner = () => {
    // Slide up animation
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBanner(false);
    });
  };

  if (!showBanner) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isConnected ? "#4CAF50" : "#FF9800",
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{isConnected ? "✓" : "⚠"}</Text>
        <Text style={styles.text}>
          {isConnected ? "Back online" : "You are offline"}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 12, // No status bar, so minimal top padding
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 20,
    color: "#fff",
    marginRight: 8,
    fontWeight: "bold",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default NetworkStatusBanner;
