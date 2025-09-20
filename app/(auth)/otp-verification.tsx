import React, { useState, useContext, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { LoginContext } from "../context/LoginContext"; // Make sure this path matches your project structure
import LinearGradient from "react-native-linear-gradient";
import { useFonts } from "expo-font";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { AxiosError } from "axios";
import axiosInstance from "../api/axiosInstance";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  UniversalDialogProvider,
  useUniversalDialog,
} from "@/src/utility/UniversalDialogProvider";

const { width, height } = Dimensions.get("window");

const isTablet = width >= 768;
type Props = {};

const otpVerification = (props: Props) => {
  const { email } = useLocalSearchParams(); // Retrieve email param
  const showDialog = useUniversalDialog();
  const [otp, setOTP] = useState<string>("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isOTPValid, setIsOTPValid] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState<number>(120);

  //password
  const [password, setPassword] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  //confirm Password
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [isConfirmPasswordValid, setIsConfirmPasswordValid] =
    useState<boolean>(true);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const dispatch = useAppDispatch();
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

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else if (resendTimer === 0 && interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Format time into MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const validateOTP = (value: string) => {
    // Example: Require OTP to be exactly 6 digits
    if (!value.trim()) {
      setOtpError("OTP is required");
      setIsOTPValid(false);
    } else if (!/^\d{6}$/.test(value)) {
      setOtpError("OTP must be 6 digits");
      setIsOTPValid(false);
    } else {
      setOtpError(null);
      setIsOTPValid(true);
    }
  };
  const validatePassword = (password: string): void => {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!password) {
      setPasswordError("Password is required");
      setIsPasswordValid(false);
    } else if (!passwordRegex.test(password)) {
      setPasswordError(
        "Password must be at least 8 characters long, with one uppercase letter, one lowercase letter, one number, and one special character."
      );
      setIsPasswordValid(false);
    } else {
      setPasswordError(null);
      setIsPasswordValid(true);
    }
  };

  const validateConfirmPassword = (
    confirmPassword: string,
    password: string
  ): void => {
    if (!confirmPassword) {
      setConfirmPasswordError("Confirm Password is required");
      setIsConfirmPasswordValid(false);
    } else if (confirmPassword !== password) {
      setConfirmPasswordError("Passwords do not match");
      setIsConfirmPasswordValid(false);
    } else {
      setConfirmPasswordError(null);
      setIsConfirmPasswordValid(true);
    }
  };

  const handleSubmitOtp = async (): Promise<void> => {
    Keyboard.dismiss();

    // Validate OTP and passwords
    validateOTP(otp);
    validatePassword(password);
    validateConfirmPassword(confirmPassword, password);

    if (!isOTPValid || !isPasswordValid || !isConfirmPasswordValid) return;

    try {
      setIsLoading(true);

      const response = await axiosInstance.post(
        `/accounts/password-reset-confirm/${otp}/`,
        {
          email,
          otp,
          password,
          confirm_password: confirmPassword,
        }
      );

      console.log("OTP Verified Successfully:", response.data);

      showDialog({
        title: "Success",
        message: "Your password has been reset!",
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: async () => {
              try {
                await AsyncStorage.setItem(
                  "credentials",
                  JSON.stringify({ email, password })
                );
                console.log(
                  "🔐 New password saved to AsyncStorage after reset"
                );
              } catch (e) {
                console.error("❌ Failed to store new password:", e);
              }

              router.replace("/login");
            },
          },
        ],
      });
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ submit?: string }>;

      console.log("Full Error Response:", axiosError.response); // Debugging full response

      let errorMessage = "Something went wrong. Please try again.";

      if (axiosError.response) {
        console.log("Error Status Code:", axiosError.response.status); // Log HTTP status code

        if (axiosError.response.status === 400) {
          // Handle 400 Bad Request
          if (axiosError.response.data.submit) {
            errorMessage = axiosError.response.data.submit; // Extract "submit" message
          } else {
            errorMessage = "Invalid request. Please check your input.";
          }
        } else if (axiosError.response.status >= 500) {
          // Handle Server Errors (500+)
          errorMessage = "Server error. Please try again later.";
        }
      }

      console.error("OTP Verification Failed:", errorMessage);
      showDialog({
        title: "Error",
        message: errorMessage,
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: () => {}, // closes the dialog
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleClearOTP = () => {
    setOTP("");
    setOtpError(null);
    setIsOTPValid(true);
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
  const handleResendOtp = async (): Promise<void> => {
    if (resendTimer > 0) return; // Prevent resending before the timer expires

    try {
      setIsLoading(true);

      console.log("Resending OTP for:", email);

      const response = await axiosInstance.post("/accounts/password-reset/", {
        email,
      });

      console.log("OTP Resent Successfully:", response.data);

      showDialog({
        title: "Success",
        message: "A new OTP has been sent to your email.",
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: () => {}, // closes the dialog
          },
        ],
      });

      // Reset the resend timer
      setResendTimer(120); // 2 minutes
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ submit?: string }>;

      console.log("Full Error Response:", axiosError.response);

      let errorMessage = "Something went wrong. Please try again.";

      if (axiosError.response) {
        console.log("Error Status Code:", axiosError.response.status);

        if (
          axiosError.response.status === 400 &&
          axiosError.response.data.submit
        ) {
          errorMessage = axiosError.response.data.submit;
        } else if (axiosError.response.status === 500) {
          errorMessage = "Server error. Please try again later.";
        }
      }

      console.error("Resend OTP Failed:", errorMessage);
      showDialog({
        title: "Error",
        message: errorMessage,
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: () => {}, // closes the dialog
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword);
  };
  const toggleConfirmPasswordVisibility = (): void => {
    setShowConfirmPassword(!showConfirmPassword);
  };
  return (
    <KeyboardAvoidingView
      behavior={"padding"}
      style={{ flex: 1, backgroundColor: "#EEF2F6" }}
    >
      <TouchableWithoutFeedback style={{ flex: 1, backgroundColor: "#EEF2F6" }}>
        <ScrollView
          keyboardDismissMode="on-drag"
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
                    OTP*
                  </Text>
                }
                keyboardType="numeric"
                maxLength={6}
                textColor="#03045E"
                value={otp}
                onBlur={() => validateOTP(otp)}
                onChangeText={(text) => {
                  // Filter out any non-numeric characters
                  const filteredText = text.replace(/[^0-9]/g, "");
                  setOTP(filteredText);
                  validateOTP(filteredText);
                }}
                mode="outlined"
                outlineStyle={{
                  borderWidth: 1,
                  borderRadius: 5,
                  borderColor: isOTPValid ? "#03045e" : "red",
                }}
                style={[
                  styles.textInput,
                  !isOTPValid && { borderColor: "red" },
                ]}
                contentStyle={{
                  paddingTop: 8, // Increased top padding for floating label
                  paddingBottom: 8,
                }}
                theme={{
                  colors: {
                    primary: isOTPValid ? "#03045E" : "red",
                    text: "#03045E",
                    background: "#EEF2F6",
                  },
                }}
                right={
                  otp ? (
                    <PaperTextInput.Icon
                      icon="close-circle-outline"
                      onPress={handleClearOTP}
                      color="#000"
                      size={20}
                    />
                  ) : null
                }
                selectionColor="#03045E"
              />
              {otpError ? (
                <Text
                  style={{
                    color: "red",
                    fontSize: responsiveFontSize - 2,
                    marginLeft: 5,
                    fontFamily: "OpenSans_Condensed-Regular",
                  }}
                >
                  {otpError}
                </Text>
              ) : null}
            </View>

            {/* password */}
            <View
              style={[
                styles.inputContainer,
                !isPasswordValid && { marginBottom: 40 },
              ]}
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
                    Password*
                  </Text>
                }
                textColor="#03045E"
                value={password}
                onBlur={() => validatePassword(password)}
                secureTextEntry={!showPassword}
                onChangeText={(text) => {
                  setPassword(text);
                  validatePassword(text);
                }}
                mode="outlined"
                outlineStyle={{
                  borderWidth: 1,
                  borderRadius: 5,
                  borderColor: isPasswordValid ? "#03045e" : "red",
                }}
                style={[
                  styles.textInput,
                  !isPasswordValid && { borderColor: "red" },
                ]}
                contentStyle={{
                  paddingTop: 8, // Increased top padding for floating label
                  paddingBottom: 8,
                }}
                theme={{
                  colors: {
                    primary: isPasswordValid ? "#03045E" : "red",
                    text: "#03045E",
                    background: "#EEF2F6",
                  },
                }}
                right={
                  <PaperTextInput.Icon
                    icon={showPassword ? "eye-outline" : "eye-off-outline"}
                    onPress={togglePasswordVisibility}
                    color="#000"
                    size={20}
                  />
                }
                selectionColor="#03045E"
              />
              {passwordError ? (
                <Text
                  style={{
                    color: "red",
                    fontSize: responsiveFontSize - 2,
                    marginLeft: 5,
                    fontFamily: "OpenSans_Condensed-Regular",
                  }}
                >
                  {passwordError}
                </Text>
              ) : null}
            </View>

            {/* Confirm password */}
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
                    Confirm Password*
                  </Text>
                }
                secureTextEntry={!showConfirmPassword}
                textColor="#03045E"
                value={confirmPassword}
                onBlur={() =>
                  validateConfirmPassword(confirmPassword, password)
                }
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  validateConfirmPassword(text, password);
                }}
                mode="outlined"
                outlineStyle={{
                  borderWidth: 1,
                  borderRadius: 5,
                  borderColor: isConfirmPasswordValid ? "#03045e" : "red",
                }}
                style={[
                  styles.textInput,
                  !isConfirmPasswordValid && { borderColor: "red" },
                ]}
                contentStyle={{
                  paddingTop: 8, // Increased top padding for floating label
                  paddingBottom: 8,
                }}
                theme={{
                  colors: {
                    primary: isConfirmPasswordValid ? "#03045E" : "red",
                    text: "#03045E",
                    background: "#EEF2F6",
                  },
                }}
                right={
                  <PaperTextInput.Icon
                    icon={
                      showConfirmPassword ? "eye-outline" : "eye-off-outline"
                    }
                    onPress={toggleConfirmPasswordVisibility}
                    color="#000"
                    size={20}
                  />
                }
                selectionColor="#03045E"
              />
              {confirmPasswordError ? (
                <Text
                  style={{
                    color: "red",
                    fontSize: responsiveFontSize - 2,
                    marginLeft: 5,
                    fontFamily: "OpenSans_Condensed-Regular",
                  }}
                >
                  {confirmPasswordError}
                </Text>
              ) : null}
            </View>
            {/* Login Button with Gradient */}
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={handleSubmitOtp}
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
                  <Text style={styles.signInButtonText}>Submit</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
            {/* Resend OTP Touchable Text */}
            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={resendTimer > 0}
              style={{ marginTop: 26, alignItems: "center" }}
            >
              <Text
                style={{
                  color: resendTimer > 0 ? "grey" : "#03045E",
                  textDecorationLine: resendTimer > 0 ? "none" : "underline",
                  fontFamily: "OpenSans_Condensed-bold",

                  fontSize: 13, // Adjust as needed
                }}
              >
                Resend OTP ({formatTime(resendTimer)})
              </Text>
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
    fontSize: isTablet ? 32 : 20,
    marginBottom: 5,
    lineHeight: isTablet ? 38 : 25,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  infoText: {
    color: "#03045E",
    fontFamily: "OpenSans_Condensed-Bold",
    fontSize: isTablet ? 22 : 15,
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
    fontSize: isTablet ? 18 : 15,

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
export default otpVerification;
