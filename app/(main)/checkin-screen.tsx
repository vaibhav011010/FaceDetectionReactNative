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
  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;
  const corporateParkName = useSelector(
    (state: RootState) => state.global.corporateParkName
  );
  const slideAnim = useRef(new Animated.Value(0)).current;
  const nextSlide = useRef(new Animated.Value(windowWidth)).current;
  const currentSlide = useRef(new Animated.Value(0)).current;

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
    setTransitioning(true);
    Animated.parallel([
      Animated.timing(currentSlide, {
        toValue: -windowWidth,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate and reset animations as needed
      router.replace("/visitorform-screen");
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
  return (
    <View style={styles.wrapper}>
      {/* Power Button positioned at top right */}
      {/* <PowerButton onPress={handlePowerPress} /> */}
      <Animated.View
        style={[styles.screen, { transform: [{ translateX: currentSlide }] }]}
      >
        <View style={styles.container}>
          <View
            style={[
              styles.borderContainer,
              { width: windowWidth, height: windowHeight },
            ]}
          >
            <View style={styles.contentContainer}>
              <View style={styles.centeredContent}>
                {/* Welcome Header */}
                <Text style={styles.welcomeText}>
                  WELCOME TO {corporateParkName.toUpperCase()}
                </Text>

                {/* Company Logo */}
                {/* <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>Anpr</Text>
              </View>
            </View> */}
                <View style={styles.imageContainer}>
                  <Image
                    source={require("../../assets/Logo1.png")} // Replace with your image path
                    style={styles.logo}
                  />
                </View>

                {/* New Visit Button */}
                <TouchableOpacity
                  style={styles.newVisitButton}
                  activeOpacity={0.8}
                  onPress={handleNewVisit}
                >
                  <UserProfileIcon />
                  <Text style={styles.buttonText}>Check In</Text>
                </TouchableOpacity>
              </View>
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
      {/* {transitioning && (
        <Animated.View
          style={[styles.newScreen, { transform: [{ translateX: nextSlide }] }]}
        >
          <ActivityIndicator size="large" color="#03045E" />
        </Animated.View>
      )} */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
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
    backgroundColor: "#000",
  },
  borderContainer: {
    // borderWidth: 14,
    // borderColor: "#03045E", // Sky blue color
    // borderRadius: 2,
    // overflow: "hidden",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF2F6",
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
    marginTop: 60,
  },
  buttonText: {
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: isTablet ? 20 : 18,
    color: "#FAFAFA",
    marginHorizontal: 10,
  },
  imageContainer: {
    alignItems: "center",
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
