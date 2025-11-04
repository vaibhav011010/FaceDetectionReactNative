import React, { useEffect, useRef, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
  Platform,
  Animated,
  InteractionManager,
  Alert,
} from "react-native";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { RootState } from "../store";
import { Svg, Circle, Path, G } from "react-native-svg";
import { LoginContext } from "../context/LoginContext";
import NetInfo from "@react-native-community/netinfo";
import UserProfileIcon from "@/src/utility/UserSvg";
import { SafeAreaView } from "react-native-safe-area-context";
import { logTableData } from "@/src/utility/logTable";
import { logAllVisitors } from "@/src/utility/log";
import { AppLogger } from "@/src/utility/Logger/Logger";
// Custom hook for responsive dimensions

const useResponsiveDimensions = () => {
  const [dimensions, setDimensions] = useState(() => {
    const window = Dimensions.get("window");
    const screen = Dimensions.get("screen");
    return {
      windowWidth: window.width,
      windowHeight: window.height,
      screenHeight: screen.height, // Full screen height
    };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener(
      "change",
      ({ window, screen }) => {
        setDimensions({
          windowWidth: window.width,
          windowHeight: window.height,
          screenHeight: screen.height,
        });
      }
    );

    return () => subscription?.remove();
  }, []);

  return {
    ...dimensions,
    actualHeight: dimensions.screenHeight, // Use this for full height
    isLandscape: dimensions.windowWidth > dimensions.windowHeight,
    isTablet: Math.min(dimensions.windowWidth, dimensions.windowHeight) >= 768,
  };
};
const windowWidth = Dimensions.get("window").width;
const { width, height } = Dimensions.get("window");

export const isTablet = width >= 768;

export default function CheckinScreen() {
  // const { handleLogout } = useContext(LoginContext);
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const [transitioning, setTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const responsiveFontSize = 16 / fontScale;
  const { windowWidth, windowHeight, isLandscape, isTablet, screenHeight } =
    useResponsiveDimensions();

  const corporateParkName = useSelector(
    (state: RootState) => state.global.corporateParkName
  );
  const slideAnim = useRef(new Animated.Value(0)).current;
  const nextSlide = useRef(new Animated.Value(windowWidth)).current;
  const currentSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AppLogger.info("User opened visitor screen", {
      corporateParkName,
      module: "VisitorScreen",
    });
  }, [corporateParkName]); // dependency ensures latest corporateParkName is used

  // Set status bar to hidden when component mounts
  useEffect(() => {
    StatusBar.setHidden(true, "none");

    // Clean up when component unmounts
    return () => {
      StatusBar.setHidden(false, "none");
    };
  }, []);

  // Handle button press
  const handleNewVisit = () => {
    setTransitioning(true); // show overlay

    Animated.timing(currentSlide, {
      toValue: -windowWidth,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      InteractionManager.runAfterInteractions(() => {
        try {
          router.replace("/visitorform-screen");
        } catch (e) {
          console.error("Navigation failed:", e);
        } finally {
          // always reset transitioning in case of error
          setTransitioning(false);
        }
      });
    });
  };

  // Load custom fonts
  const [fontsLoaded] = useFonts({
    "OpenSans_Condensed-Bold": require("../../assets/fonts/OpenSans_Condensed-Bold.ttf"),
    "OpenSans_Condensed-Regular": require("../../assets/fonts/OpenSans_Condensed-Regular.ttf"),
    "OpenSans_Condensed-SemiBold": require("../../assets/fonts/OpenSans_Condensed-SemiBold.ttf"),
  });

  // Show loading indicator while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }
  // Create responsive styles
  const responsiveStyles = StyleSheet.create({
    screen: {
      position: "absolute",
      width: windowWidth,
      height: screenHeight,
      backgroundColor: "#EEF2F6",
      justifyContent: "center",
      alignItems: "center",
    },
    borderContainer: {
      width: windowWidth,
      height: windowHeight,
    },
    centeredContent: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: isLandscape ? windowWidth * 0.1 : 20,
      paddingVertical: isLandscape ? 10 : 20,
    },
    welcomeText: {
      fontFamily: "OpenSans_Condensed-Bold",
      fontSize: isTablet ? (isLandscape ? 33 : 36) : isLandscape ? 23 : 26,
      color: "#03045E",
      textAlign: "center",
      marginBottom: isLandscape ? 15 : 20,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: isLandscape ? 30 : 60,
    },
    logo: {
      width: isLandscape ? 120 : 160,
      height: isLandscape ? 120 : 160,
    },
    newVisitButton: {
      height: isLandscape ? 55 : 65,
      width: isLandscape ? 220 : 248,
      flexDirection: "row",
      backgroundColor: "#03045E",
      borderRadius: 5,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#C0C0C0",
      marginTop: isLandscape ? 40 : 89,
    },
    buttonText: {
      fontFamily: "OpenSans_Condensed-Bold",
      fontSize: isTablet ? (isLandscape ? 19 : 21) : isLandscape ? 16 : 19,
      color: "#FAFAFA",
      marginHorizontal: 10,
    },
    // Landscape-specific layout
    landscapeLayout: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      paddingHorizontal: windowWidth * 0.05,
    },
    landscapeLeftSection: {
      flex: 1,
      alignItems: "center",
    },
    landscapeRightSection: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  // // Power Button Component
  // const PowerButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  //   <TouchableOpacity style={styles.powerButton} onPress={onPress}>
  //     <Svg width="30" height="30" viewBox="0 0 24 24">
  //       <G
  //         fill="none"
  //         stroke="#03045E"
  //         strokeWidth="2"
  //         strokeLinecap="round"
  //         strokeLinejoin="round"
  //       >
  //         <Circle cx="12" cy="12" r="10" fill="#03045E" />
  //         <Path d="M12 6v6" stroke="#FFFFFF" />
  //         <Path d="M8 9a5 5 0 1 0 8 0" stroke="#FFFFFF" />
  //       </G>
  //     </Svg>
  //   </TouchableOpacity>
  // );
  // const handlePowerPress = () => {
  //   Alert.alert("Logout", "Are you sure you want to logout?", [
  //     { text: "Cancel", style: "cancel" },
  //     {
  //       text: "Logout",
  //       style: "destructive",
  //       onPress: async () => {
  //         setIsLoading(true);

  //         try {
  //           const result = await handleLogout();

  //           if (result.success) {
  //             // If we’re offline, let them know we’ll sync later
  //             const { isConnected } = await NetInfo.fetch();
  //             if (!isConnected) {
  //               Alert.alert(
  //                 "Offline Logout",
  //                 "You’re offline right now. Your logout has been completed locally and will be propagated to the server once you’re back online."
  //               );
  //             }

  //             // Navigate to login screen regardless
  //             router.replace("/login");
  //           } else {
  //             // Show any logout-specific error returned
  //             Alert.alert(
  //               "Logout Failed",
  //               result.error || "Logout failed. Please try again."
  //             );
  //           }
  //         } catch (error) {
  //           // This should rarely happen, since handleLogout never throws
  //           console.error("Unexpected logout error:", error);
  //           Alert.alert(
  //             "Logout Failed",
  //             "An unexpected error occurred. Please try again."
  //           );
  //         } finally {
  //           setIsLoading(false);
  //         }
  //       },
  //     },
  //   ]);
  // };
  useEffect(() => {
    // Log visitors table every time screen mounts
    logAllVisitors();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EEF2F6" }} edges={[]}>
      <View style={styles.wrapper}>
        <Animated.View
          style={[
            responsiveStyles.screen,
            { transform: [{ translateX: currentSlide }] },
          ]}
        >
          <View style={styles.container}>
            <View style={responsiveStyles.borderContainer}>
              <View style={styles.contentContainer}>
                {isLandscape ? (
                  // Landscape Layout
                  <View style={responsiveStyles.landscapeLayout}>
                    <View style={responsiveStyles.landscapeLeftSection}>
                      <Text style={responsiveStyles.welcomeText}>
                        WELCOME TO {corporateParkName.toUpperCase()}
                      </Text>
                      <View style={responsiveStyles.logoContainer}>
                        <Image
                          source={require("../../assets/Logo1.png")}
                          style={responsiveStyles.logo}
                        />
                      </View>
                    </View>
                    <View style={responsiveStyles.landscapeRightSection}>
                      <TouchableOpacity
                        style={responsiveStyles.newVisitButton}
                        activeOpacity={0.8}
                        onPress={handleNewVisit}
                      >
                        <UserProfileIcon />
                        <Text style={responsiveStyles.buttonText}>
                          Check In
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // Portrait Layout
                  <View style={responsiveStyles.centeredContent}>
                    <Text style={responsiveStyles.welcomeText}>
                      WELCOME TO {corporateParkName.toUpperCase()}
                    </Text>
                    <View style={responsiveStyles.logoContainer}>
                      <Image
                        source={require("../../assets/Logo1.png")}
                        style={responsiveStyles.logo}
                      />
                    </View>
                    <TouchableOpacity
                      style={responsiveStyles.newVisitButton}
                      activeOpacity={0.8}
                      onPress={handleNewVisit}
                    >
                      <UserProfileIcon />
                      <Text style={responsiveStyles.buttonText}>Check In</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Full-screen loading overlay */}
        {isLoading && (
          <View style={styles.fullScreenLoader}>
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#03045E" />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: "100%",
    height: "auto",
    backgroundColor: "#EEF2F6",
  },
  screen: {
    position: "absolute",
    width: windowWidth,
    height: "100%",
    backgroundColor: "#03045E",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 24,
    marginBottom: 20,
  },
  // Add the power button style
  powerButton: {
    position: "absolute",
    top: 50,
    right: 35,
    zIndex: 10,
  },
  newScreen: {
    // This new screen is styled similarly; you can modify as needed
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF2F6",
  },
  borderContainer: {
    // borderWidth: 14,
    // borderColor: "#03045E", // Sky blue color
    // borderRadius: 2,
    // overflow: "hidden",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "#EEF2F6",
    justifyContent: "center",
    alignItems: "center",
  },
  centeredContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  welcomeText: {
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: isTablet ? 35 : 25,
    color: "#03045E",
    textAlign: "center",

    marginBottom: 20,
  },
  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  logoCircle: {
    width: isTablet ? 200 : 120,
    height: isTablet ? 200 : 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#C0C0C0", // Silver border
    backgroundColor: "#0a1442", // Same as background
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: 40,
    color: "#FFD700", // Gold/yellow color
  },
  newVisitButton: {
    height: 65,
    width: 248,
    flexDirection: "row",
    backgroundColor: "#03045E",

    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C0C0C0", // Silver border
    marginTop: 89,
  },
  buttonText: {
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: isTablet ? 20 : 18,
    color: "#FAFAFA",
    marginHorizontal: 10,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  logo: {
    width: 160,
    height: 160,
  },
  buttonImage: {
    width: isTablet ? 28 : 22,
    height: isTablet ? 28 : 22,
    resizeMode: "contain",
  },
  // Add these new styles for the full-screen loader
  fullScreenLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent navy blue
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999, // Ensure it's above everything else
  },
  loaderContainer: {
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
