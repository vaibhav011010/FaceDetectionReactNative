import React, { useEffect } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";

export default function CheckinScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const responsiveFontSize = 16 / fontScale;
  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;

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
    router.replace("/visitorform-screen");
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
              WELCOME TO SAGAR TECH PLAZA B
            </Text>

            {/* Company Logo */}
            {/* <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>Anpr</Text>
              </View>
            </View> */}
            <View style={styles.imageContainer}>
              <Image
                source={require("../../assets/ANPRLOGO.png")} // Replace with your image path
                style={styles.logo}
              />
            </View>

            {/* New Visit Button */}
            <TouchableOpacity
              style={styles.newVisitButton}
              activeOpacity={0.8}
              onPress={handleNewVisit}
            >
              <Ionicons name="person-add" size={26} color="white" />
              <Text style={styles.buttonText}>CHECK IN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 14,
    borderColor: "#03045E", // Sky blue color
    borderRadius: 10,
    overflow: "hidden",
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
    fontSize: 26,
    color: "#03045E",
    textAlign: "center",
    marginBottom: 60,
  },
  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 35,
  },
  logoCircle: {
    width: 120,
    height: 120,
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
    flexDirection: "row",
    backgroundColor: "#03045E",
    paddingVertical: 18,
    paddingHorizontal: 39,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C0C0C0", // Silver border
  },
  buttonText: {
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: 22,
    color: "white", // Gold/yellow color
    marginLeft: 10,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  logo: {
    width: 120,
    height: 120,
  },
});
