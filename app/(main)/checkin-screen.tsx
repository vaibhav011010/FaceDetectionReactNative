import React, { useEffect, useRef, useState } from "react";
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
} from "react-native";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { RootState } from "../store";
const windowWidth = Dimensions.get("window").width;
const { width, height } = Dimensions.get("window");

export const isTablet = width >= 768;

export default function CheckinScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const [transitioning, setTransitioning] = useState(false);

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

  return (
    <View style={styles.wrapper}>
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
                  <Image
                    source={require("../../assets/addUser.png")} // Update with your image path
                    style={styles.buttonImage}
                  />
                  <Text style={styles.buttonText}>Check In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
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
    backgroundColor: "#000",
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
    backgroundColor: "white", // Deep navy blue
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
});
