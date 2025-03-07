// app/main/visitorform-screen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { TextInput as PaperTextInput } from "react-native-paper";
import LinearGradient from "react-native-linear-gradient";
import { useFonts } from "expo-font";

export default function VisitorFormScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const responsiveFontSize = 16 / fontScale;

  // State for form fields
  const [visitorName, setVisitorName] = useState("");
  const [visitorMobile, setVisitorMobile] = useState("");
  const [visitingCompany, setVisitingCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Handle Next button press
  const handleNext = () => {
    setIsLoading(true);
    // Simulate an API call or validation
    setTimeout(() => {
      setIsLoading(false);
      router.replace("/camera-screen");
    }, 2000);
  };
  const handleClearCompany = (): void => {
    setVisitingCompany("");
  };

  const handleClearName = (): void => {
    setVisitorName("");
  };

  const handleClearMobile = (): void => {
    setVisitorMobile("");
  };
  const [fontsLoaded] = useFonts({
    "OpenSans_Condensed-Bold": require("../../assets/fonts/OpenSans_Condensed-Bold.ttf"),
    "OpenSans_Condensed-Regular": require("../../assets/fonts/OpenSans_Condensed-Regular.ttf"),
    "OpenSans_Condensed-SemiBold": require("../../assets/fonts/OpenSans_Condensed-SemiBold.ttf"),
  });
  if (!fontsLoaded) {
    return <ActivityIndicator size="large" color="#03045E" />;
  }
  return (
    <View style={styles.container}>
      {/* Visitor Name Input */}
      <View style={styles.inputContainer}>
        <PaperTextInput
          label={
            <Text
              style={{
                color: "#03045E",
                fontFamily: "OpenSans_Condensed-Regular",
                fontSize: responsiveFontSize,
              }}
            >
              Form 1*
            </Text>
          }
          textColor="#03045E"
          value={visitorName}
          onChangeText={setVisitorName}
          mode="outlined"
          outlineStyle={{
            borderWidth: 1,
            borderRadius: 5,
            borderColor: "#03045e",
          }}
          style={styles.textInput}
          theme={{
            colors: {
              primary: "#03045E",
              text: "#03045E",
            },
          }}
          right={
            visitorName ? (
              <PaperTextInput.Icon
                icon="close-circle-outline"
                onPress={handleClearName}
                color="#000"
                size={22}
              />
            ) : null
          }
          selectionColor="#03045E"
        />
      </View>

      {/* Visitor Mobile Input */}
      <View style={styles.inputContainer}>
        <PaperTextInput
          label={
            <Text
              style={{
                color: "#03045E",
                fontFamily: "OpenSans_Condensed-Regular",
                fontSize: responsiveFontSize,
              }}
            >
              Form 2*
            </Text>
          }
          textColor="#03045E"
          value={visitorMobile}
          onChangeText={setVisitorMobile}
          mode="outlined"
          outlineStyle={{
            borderWidth: 1,
            borderRadius: 5,
            borderColor: "#03045e",
          }}
          style={styles.textInput}
          theme={{
            colors: {
              primary: "#03045E",
              text: "#03045E",
            },
          }}
          keyboardType="phone-pad"
          right={
            visitorMobile ? (
              <PaperTextInput.Icon
                icon="close-circle-outline"
                onPress={handleClearMobile}
                color="#000"
                size={22}
              />
            ) : null
          }
          selectionColor="#03045E"
        />
      </View>

      {/* Visiting Company Input */}
      <View style={styles.inputContainer}>
        <PaperTextInput
          label={
            <Text
              style={{
                color: "#03045E",
                fontFamily: "OpenSans_Condensed-Regular",
                fontSize: responsiveFontSize,
              }}
            >
              Form 3*
            </Text>
          }
          textColor="#03045E"
          value={visitingCompany}
          onChangeText={setVisitingCompany}
          mode="outlined"
          outlineStyle={{
            borderWidth: 1,
            borderRadius: 5,
            borderColor: "#03045e",
          }}
          style={styles.textInput}
          theme={{
            colors: {
              primary: "#03045E",
              text: "#03045E",
            },
          }}
          right={
            visitingCompany ? (
              <PaperTextInput.Icon
                icon="close-circle-outline"
                onPress={handleClearCompany}
                color="#000"
                size={22}
              />
            ) : null
          }
          selectionColor="#03045E"
        />
      </View>

      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => {
          // Add logic for photo upload here
          console.log("Photo upload clicked");
        }}
      >
        <PaperTextInput
          label={
            <Text
              style={{
                color: "#03045E",
                fontFamily: "OpenSans_Condensed-Regular",
                fontSize: responsiveFontSize,
              }}
            >
              Form 4*
            </Text>
          }
          textColor="#03045E"
          value="" // No value since input is disabled
          mode="outlined"
          outlineStyle={{
            borderWidth: 1,
            borderRadius: 5,
            borderColor: "#03045e",
          }}
          style={styles.textInput}
          theme={{
            colors: {
              primary: "#03045E",
              text: "#03045E",
            },
          }}
          editable={false} // Disable input
          right={
            <PaperTextInput.Icon
              icon="camera"
              color="#03045E"
              size={22}
              onPress={() => {
                // Add logic for photo upload here
                console.log("Photo upload clicked");
              }}
            />
          }
        />
      </TouchableOpacity>

      {/* Next Button with Gradient */}
      <TouchableOpacity
        activeOpacity={0.5}
        onPress={handleNext}
        disabled={isLoading}
        style={styles.signInButton}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#03045E" />
        ) : (
          <LinearGradient
            colors={["#02023C", "#64DFDF"]}
            start={{ x: 0.8, y: 2 }}
            end={{ x: -0.2, y: 2 }}
            style={styles.linearGradient}
          >
            <Text style={styles.signInButtonText}>Next</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 100,
    height: 100,
  },
  inputContainer: {
    width: "85%",
    height: 50,
    marginVertical: 11,
  },
  welcomeText: {
    color: "#03045E",
    fontSize: 30,
    marginBottom: 5,
    lineHeight: 30,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  infoText: {
    color: "#03045E",
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: 20,
    lineHeight: 18 * 1.5,
    marginBottom: 15,
  },
  textInput: {
    backgroundColor: "white",
    fontSize: 16,
    fontFamily: "OpenSans-VariableFont_wdth,wght",
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    alignItems: "center",
    marginTop: 3,
    marginRight: "8%",
  },
  forgotPasswordText: {
    color: "#03045E",
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: 16,
  },
  signInButton: {
    width: "85%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
  linearGradient: {
    width: "100%",
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#4E4E4E",

    padding: 0,
  },
  signInButtonText: {
    color: "#FFFAFA",
    fontSize: 18,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  linkContainer: {
    marginTop: 25,
    alignItems: "center",
    flexDirection: "row",
  },
  accountText: {
    fontSize: 18,
    fontFamily: "OpenSans_Condensed-Bold",
    color: "#03045E",
  },
  touchableText: {
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: 18,
    color: "#4C7EFF",
  },
  touchableContainer: {},
});
