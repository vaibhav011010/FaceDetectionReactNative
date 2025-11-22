import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import NetworkManager from "./NetworkManager";

type ConnectionStatus = "online" | "offline";

const NetworkStatusBanner = () => {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("online");
  const [showBanner, setShowBanner] = useState(false);

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const AUTO_HIDE_DELAY_ONLINE = 3000;

  const clearAutoHideTimeout = useCallback(() => {
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }
  }, []);

  const hideBanner = useCallback(() => {
    clearAutoHideTimeout();

    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBanner(false);
    });
  }, [slideAnim, clearAutoHideTimeout]);

  useEffect(() => {
    const unsubscribe = NetworkManager.subscribe((status) => {
      console.log(`📡 Network status update: ${status}`);

      setConnectionStatus((prev) => {
        if (prev === status) return prev;
        return status;
      });

      clearAutoHideTimeout();

      if (status === "online") {
        // Connection restored - show briefly then auto-hide
        setShowBanner(true);
        console.log(
          `✅ Connection restored! Auto-hiding in ${AUTO_HIDE_DELAY_ONLINE}ms`
        );

        autoHideTimeoutRef.current = setTimeout(() => {
          console.log("✅ Hiding 'online' banner");
          hideBanner();
        }, AUTO_HIDE_DELAY_ONLINE);
      } else {
        // Offline - show banner indefinitely
        setShowBanner(true);
        console.log(`⚠️ No internet connection - Banner stays visible`);
      }
    });

    return () => {
      console.log("🛑 NetworkStatusBanner unmounting");
      unsubscribe();
      clearAutoHideTimeout();
    };
  }, [clearAutoHideTimeout, hideBanner]);

  useEffect(() => {
    if (showBanner) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [showBanner, slideAnim]);

  const getStatusConfig = () => {
    if (connectionStatus === "online") {
      return {
        backgroundColor: "#4CAF50",
        icon: "✓",
        text: "Back online!",
      };
    } else {
      return {
        backgroundColor: "#F44336",
        icon: "✕",
        text: "No internet connection",
      };
    }
  };

  if (!showBanner) return null;

  const config = getStatusConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={styles.text}>{config.text}</Text>
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
    paddingTop: 15,
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
