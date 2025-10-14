import React, { useState, useContext, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Dimensions,
  StatusBar,
  Alert,
  Button,
  ScrollView,
  Platform,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { LoginContext } from "../context/LoginContext"; // Make sure this path matches your project structure
import LinearGradient from "react-native-linear-gradient";
import { useFonts } from "expo-font";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setForgotPasswordEmail,
  setForgotPasswordEmailError,
  clearForgotPasswordEmailError,
  selectForgotPasswordEmail,
  selectForgotPasswordEmailError,
  selectIsForgotPasswordEmailValid,
  selectAuthLoading,
} from "../store/slices/authSlice";
import axiosInstance from "../api/axiosInstance";
import {
  UniversalDialogProvider,
  useUniversalDialog,
} from "@/src/utility/UniversalDialogProvider";

import { setIsLoading } from "../store/slices/visitorSlice";
import axiosBase from "../api/axiosBase";
import { useFocusEffect } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

const isTablet = width >= 768;
type Props = {};

const forgotPassword = (props: Props) => {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const isEmailValid = useAppSelector(selectIsForgotPasswordEmailValid);
  const emailError = useAppSelector(selectForgotPasswordEmailError);
  const dispatch = useAppDispatch();
  const showDialog = useUniversalDialog();
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const mobileFontSize = 14;
  const tabletFontSize = 17;

  const responsiveFontSize = isTablet
    ? tabletFontSize / fontScale
    : mobileFontSize / fontScale;
  useEffect(() => {
    StatusBar.setHidden(true, "none");

    // Clean up when component unmounts
    return () => {
      StatusBar.setHidden(false, "none");
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      // Clear email error and reset validation state whenever the screen is focused
      dispatch(setForgotPasswordEmailError(null));
    }, [dispatch])
  );
  const validateEmail = (email: string): void => {
    // Simple validation for now
    if (!email) {
      dispatch(setForgotPasswordEmailError("Email is required"));
    } else {
      dispatch(clearForgotPasswordEmailError());
    }
  };

  const handleSubmitEmail = async (): Promise<void> => {
    Keyboard.dismiss();

    // --- Run local validation synchronously first ---
    const trimmedEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailOk = emailPattern.test(trimmedEmail);

    // Update validation UI
    validateEmail(trimmedEmail);

    // --- If email invalid, stop immediately ---
    if (!isEmailOk) {
      console.log("❌ Email validation failed. Not calling API.");
      return;
    }

    try {
      // Dispatch loading state if you're using Redux
      setIsLoading(true);

      // Make API call to generate OTP
      const response = await axiosBase.post("/accounts/password-reset/", {
        email: email,
      });

      // Check if the API call was successful
      if (response.status === 200 || response.status === 201) {
        // You might want to store the email for the next screen
        dispatch(setForgotPasswordEmail(email));
        // Navigate to the OTP verification screen
        router.push({
          pathname: "/otp-verification",
          params: { email: email },
        });
      }
    } catch (error: any) {
      // Handle error
      console.error("Password reset request failed:", error);

      // Check if it's a response error from the API
      if (error.response) {
        // Handle 400 errors specifically
        if (error.response.status === 400) {
          // Check if there's an email-specific error
          if (error.response.data && error.response.data.email) {
            showDialog({
              title: "Error",
              message:
                error?.response?.data?.email || "An unknown error occurred.",
              actions: [
                {
                  label: "OK",
                  mode: "contained",
                  onPress: () => {}, // closes dialog
                },
              ],
            });

            dispatch(setForgotPasswordEmailError(error.response.data.email));
          } else {
            // General API error message
            const errorMessage =
              error.response.data.message || "Invalid email. Please try again.";
            showDialog({
              title: "Error",
              message: errorMessage,
              actions: [
                {
                  label: "OK",
                  mode: "contained",
                  onPress: () => {}, // closes dialog
                },
              ],
            });

            dispatch(setForgotPasswordEmailError(errorMessage));
          }
        } else {
          // Handle other HTTP errors
          showDialog({
            title: "Error",
            message: "Server error. Please try again later.",
            actions: [
              {
                label: "OK",
                mode: "contained",
                onPress: () => {}, // closes dialog
              },
            ],
          });

          dispatch(
            setForgotPasswordEmailError("Server error. Please try again later.")
          );
        }
      } else if (error.request) {
        // Handle network errors (request made but no response)
        showDialog({
          title: "Network Error",
          message: "Please check your internet connection and try again.",
          actions: [
            {
              label: "OK",
              mode: "contained",
              onPress: () => {}, // closes dialog
            },
          ],
        });
        dispatch(
          setForgotPasswordEmailError("Network error. Please try again.")
        );
      } else {
        // Handle other errors
        showDialog({
          title: "Error",
          message: "An unexpected error occurred. Please try again.",
          actions: [
            {
              label: "OK",
              mode: "contained",
              onPress: () => {}, // closes dialog
            },
          ],
        });

        dispatch(setForgotPasswordEmailError("An unexpected error occurred."));
      }
    } finally {
      // Turn off loading state
      setIsLoading(false);
    }
  };

  const handleClearEmail = (): void => {
    setEmail("");
    dispatch(clearForgotPasswordEmailError());
  };
  const handleScreenPress = () => {
    Keyboard.dismiss();
  };

  const [fontsLoaded] = useFonts({
    "OpenSans_Condensed-Bold": require("../../assets/fonts/OpenSans_Condensed-Bold.ttf"),
    "OpenSans_Condensed-Regular": require("../../assets/fonts/OpenSans_Condensed-Regular.ttf"),
    "OpenSans_Condensed-SemiBold": require("../../assets/fonts/OpenSans_Condensed-SemiBold.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#03045E" />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView
      behavior={"padding"}
      style={{ flex: 1, backgroundColor: "#EEF2F6" }}
    >
      <TouchableWithoutFeedback
        onPress={handleScreenPress}
        style={{ flex: 1, backgroundColor: "#EEF2F6" }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, backgroundColor: "#EEF2F6" }}
          style={{ backgroundColor: "#EEF2F6" }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.imageContainer}>
              <Image
                source={require("../../assets/Logo1.png")} // Replace with your image path
                style={styles.logo}
              />
            </View>

            <Text style={styles.welcomeText}>Forgot Password</Text>
            <Text style={styles.infoText}>Enter your email to continue</Text>

            {/* <Button title="Debug: Fetch Stored User" onPress={debugFetchUser} /> */}

            {/* Email Input */}
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
                    Email*
                  </Text>
                }
                textColor="#03045E"
                value={email}
                onBlur={() => validateEmail(email)}
                keyboardType="email-address"
                onChangeText={(text) => {
                  const lowercasedText = text.toLowerCase(); // Convert input to lowercase
                  setEmail(lowercasedText);
                  validateEmail(lowercasedText);
                }}
                mode="outlined"
                outlineStyle={{
                  borderWidth: 1,
                  borderRadius: 5,
                  borderColor: isEmailValid ? "#03045e" : "red",
                }}
                style={[
                  styles.textInput,
                  !isEmailValid && { borderColor: "red" },
                ]}
                contentStyle={{
                  paddingTop: 8, // Increased top padding for floating label
                  paddingBottom: 8,
                }}
                theme={{
                  colors: {
                    primary: isEmailValid ? "#03045E" : "red",
                    text: "#03045E",
                    background: "#EEF2F6",
                  },
                }}
                right={
                  email ? (
                    <PaperTextInput.Icon
                      icon="close-circle-outline"
                      onPress={handleClearEmail}
                      color="#000"
                      size={20}
                    />
                  ) : null
                }
                selectionColor="#03045E"
              />
              {emailError ? (
                <Text
                  style={{
                    color: "red",
                    fontSize: responsiveFontSize - 2,
                    marginLeft: 5,
                    fontFamily: "OpenSans_Condensed-Regular",
                  }}
                >
                  {emailError}
                </Text>
              ) : null}
            </View>

            {/* Login Button with Gradient */}
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={handleSubmitEmail}
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
                  <Text style={styles.signInButtonText}>Reset Password</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            {/* <View style={styles.linkContainer}>
                  <Text style={styles.accountText}>
                    Don't have an account?{"  "}
                  </Text>
                  <TouchableOpacity
                    style={styles.touchableContainer}
                    onPress={handleSignup}
                  >
                    <Text style={styles.touchableText}>Sign Up</Text>
                  </TouchableOpacity>
                </View> */}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF2F6",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "auto",
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: isTablet ? 200 : 100,
    height: isTablet ? 200 : 100,
  },
  inputContainer: {
    width: "85%",
    height: isTablet ? 55 : 50,

    marginVertical: 11,
  },
  welcomeText: {
    color: "#03045E",
    fontSize: isTablet ? 34 : 22,
    marginBottom: 5,
    lineHeight: isTablet ? 38 : 25,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  infoText: {
    color: "#03045E",
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: isTablet ? 23 : 16,
    lineHeight: isTablet ? 33 : 22.5,
    marginBottom: 40,
  },
  textInput: {
    backgroundColor: "transparent",
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
    marginTop: 55,
  },
  linearGradient: {
    width: "100%",
    height: isTablet ? 55 : 45,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,

    backgroundColor: "#4E4E4E",

    padding: 0,
  },
  signInButtonText: {
    color: "#FFFAFA",
    fontSize: isTablet ? 20 : 16,

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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  touchableContainer: {},
});
export default forgotPassword;
