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
  StatusBar,
  Alert,
  Button,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { LoginContext } from "../context/LoginContext"; // Make sure this path matches your project structure
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";

import { setCorporateParkName } from "../store/slices/globalSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  loginStart,
  loginSuccess,
  setEmailError,
  setPasswordError,
  clearEmailError,
  clearPasswordError,
  selectAuthLoading,
  selectAuthError,
  selectEmailError,
  selectPasswordError,
  selectIsEmailValid,
  selectIsPasswordValid,
  loginFailure,
} from "../store/slices/authSlice";
import { login } from "../api/auth";
import User from "../database/models/User";
import database from "../database";
import { Q } from "@nozbe/watermelondb";

interface LoginFormProps {
  onLogin?: (email: string, password: string) => void;
}

const LoginScreen: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const responsiveFontSize = 16 / fontScale;

  // Select Redux state
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const emailError = useAppSelector(selectEmailError);
  const passwordError = useAppSelector(selectPasswordError);
  const isEmailValid = useAppSelector(selectIsEmailValid);
  const isPasswordValid = useAppSelector(selectIsPasswordValid);

  // Set status bar to hidden when component mounts
  useEffect(() => {
    StatusBar.setHidden(true, "none");

    // Clean up when component unmounts
    return () => {
      StatusBar.setHidden(false, "none");
    };
  }, []);

  const validateEmail = (email: string): void => {
    // Simple validation for now
    if (!email) {
      dispatch(setEmailError("Email is required"));
    } else {
      dispatch(clearEmailError());
    }
  };

  const validatePassword = (password: string): void => {
    // Simple validation for now
    if (!password) {
      dispatch(setPasswordError("Password is required"));
    } else {
      dispatch(clearPasswordError());
    }
  };

  const handleLogin = async (): Promise<void> => {
    console.log("handleLogin called");

    // Always trim the email to remove unwanted spaces
    const trimmedEmail = email.trim();
    // Use the trimmed email in validations and API call
    validateEmail(trimmedEmail);
    validatePassword(password);

    // Only proceed if both inputs are valid
    if (!trimmedEmail || !password) {
      console.log("Missing email or password. Aborting login.");
      Alert.alert("Error", "Please fill in both email and password.");
      return;
    }

    try {
      dispatch(loginStart());
      console.log("loginStart dispatched");

      // Call the login API using trimmedEmail
      const response = await login(trimmedEmail, password);
      console.log("API response received:", response);

      // Destructure the response values
      const {
        access,
        refresh,
        user_detail,
        corporate_park_detail,
        role_detail,
        permission,
      } = response;

      console.log("Extracted values:", {
        access,
        refresh,
        user_detail,
        corporate_park_detail,
        role_detail,
        permission,
      });

      // Build the user object according to our Redux state interface
      const user = {
        id: user_detail.id,
        email: user_detail.email,
        corporateParkId: corporate_park_detail.id,
        corporateParkName: corporate_park_detail.corporate_park_name,
        roleId: role_detail.id,
        roleName: role_detail.role_name,
        permissions: permission, // Expected to be an object (Record<string, string[]>)
      };

      console.log("Constructed user object:", user);

      // Dispatch loginSuccess with the user and token details
      dispatch(
        loginSuccess({
          user,
          accessToken: access,
          refreshToken: refresh,
        })
      );
      dispatch(setCorporateParkName(corporate_park_detail.corporate_park_name));
      console.log("Corporate park name dispatched to global store");
      console.log("loginSuccess dispatched");

      // Navigate to the checkin screen after successful login
      router.replace("/checkin-screen");
      console.log("Navigation to checkin-screen complete");
    } catch (error: any) {
      // Log the detailed error for debugging purposes
      console.error("Login failed:", error.toJSON ? error.toJSON() : error);

      // If the error has a response with a detailed message, use it
      const detailedError =
        error.response && error.response.data && error.response.data.message
          ? error.response.data.message
          : error.message || "Invalid email or password. Please try again.";

      // If the error indicates a network error, attempt offline login
      if (error.message && error.message.includes("Network Error")) {
        console.log("Network error detected. Attempting offline login...");
        try {
          const userCollection = database.get<User>("users");
          const storedUsers = await userCollection
            .query(
              // Query for a stored user with the same email
              Q.where("email", trimmedEmail)
            )
            .fetch();
          console.log(
            "Offline query result, storedUsers count:",
            storedUsers.length
          );
          if (storedUsers.length > 0) {
            const storedUser = storedUsers[0];
            console.log("Stored user found:", storedUser);
            dispatch(
              loginSuccess({
                user: {
                  id: Number(storedUser.userId),
                  email: storedUser.email,
                  corporateParkId: storedUser.corporateParkId,
                  corporateParkName: storedUser.corporateParkName,
                  roleId: storedUser.roleId,
                  roleName: storedUser.roleName,
                  permissions: storedUser.permissions
                    ? JSON.parse(storedUser.permissions)
                    : {},
                },
                accessToken: storedUser.accessToken,
                refreshToken: storedUser.refreshToken,
              })
            );
            console.log("Offline login success dispatched");
            router.replace("/checkin-screen");
            console.log("Offline navigation to checkin-screen complete");
            return;
          } else {
            Alert.alert(
              "Login Failed",
              "No offline credentials found for this email."
            );
          }
        } catch (offlineError) {
          console.error("Offline login error:", offlineError);
          Alert.alert(
            "Login Failed",
            "Offline login failed. Please try again later."
          );
        }
      } else {
        // Display the detailed error message from the response if available
        Alert.alert("Login Failed", detailedError);
      }
      dispatch(loginFailure(detailedError));
    }
  };

  const handleForgotPassword = () => {
    // Will implement later
  };

  const handleSignup = () => {
    // Will implement later
  };

  const handleClearEmail = (): void => {
    setEmail("");
    dispatch(clearEmailError());
  };

  const handleClearPassword = (): void => {
    setPassword("");
    dispatch(clearPasswordError());
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword);
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
  const debugFetchUser = async () => {
    const userCollection = database.get<User>("users");
    const storedUsers = await userCollection.query().fetch();
    console.log("Stored Users:", storedUsers);
    alert(`Stored Users: ${storedUsers.length}`);
  };

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleScreenPress}>
          <View style={styles.container}>
            <View style={styles.imageContainer}>
              <Image
                source={require("../../assets/ANPRLOGO.png")} // Replace with your image path
                style={styles.logo}
              />
            </View>

            <Text style={styles.welcomeText}>Hi, Welcome Back</Text>
            <Text style={styles.infoText}>Login to your account</Text>

            <Button title="Debug: Fetch Stored User" onPress={debugFetchUser} />

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
                  setEmail(text);
                  validateEmail(text);
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
                theme={{
                  colors: {
                    primary: isEmailValid ? "#03045E" : "red",
                    text: "#03045E",
                  },
                }}
                right={
                  email ? (
                    <PaperTextInput.Icon
                      icon="close-circle-outline"
                      onPress={handleClearEmail}
                      color="#000"
                      size={22}
                    />
                  ) : null
                }
                selectionColor="#03045E"
                onFocus={() => clearPasswordError()}
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

            {/* Password Input */}
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
                theme={{
                  colors: {
                    primary: isPasswordValid ? "#03045E" : "red",
                    text: "#03045E",
                  },
                }}
                right={
                  <PaperTextInput.Icon
                    icon={showPassword ? "eye-outline" : "eye-off-outline"}
                    onPress={togglePasswordVisibility}
                    color="#000"
                    size={22}
                  />
                }
                selectionColor="#03045E"
                onFocus={() => clearPasswordError()}
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

            {/* Forgot Password Link */}
            {/* <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity> */}

            {/* Login Button with Gradient */}
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={handleLogin}
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
                  <Text style={styles.signInButtonText}>Log In</Text>
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
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
    height: "auto",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  touchableContainer: {},
});

export default LoginScreen;
