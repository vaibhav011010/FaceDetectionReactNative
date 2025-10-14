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
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import LinearGradient from "react-native-linear-gradient";

import {
  UniversalDialogProvider,
  useUniversalDialog,
} from "@/src/utility/UniversalDialogProvider";
import { useFonts } from "expo-font";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
import { triggerLoginSync } from "../api/visitorForm";
import { debounce } from "lodash";
import { withTimeout } from "@/src/utility/withTimeout";

interface LoginFormProps {
  onLogin?: (email: string, password: string) => void;
}
type Credentials = {
  email: string;
  password: string;
};

const { width, height } = Dimensions.get("window");

const isTablet = width >= 768; // Common tablet breakpoint

const LoginScreen: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const showDialog = useUniversalDialog();

  const dispatch = useAppDispatch();
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const mobileFontSize = 14;
  const tabletFontSize = 17;

  const responsiveFontSize = isTablet
    ? tabletFontSize / fontScale
    : mobileFontSize / fontScale;

  // Select Redux state
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const emailError = useAppSelector(selectEmailError);
  const passwordError = useAppSelector(selectPasswordError);
  const isEmailValid = useAppSelector(selectIsEmailValid);
  const isPasswordValid = useAppSelector(selectIsPasswordValid);

  // Set status bar to hidden when component mounts
  useEffect(() => {
    const loadStoredCredentials = async () => {
      try {
        const saved = await AsyncStorage.getItem("credentials");
        if (saved) {
          const { email: savedEmail, password: savedPassword } =
            JSON.parse(saved);
          setEmail(savedEmail);
          setPassword(savedPassword);
          console.log("📦 Credentials loaded from storage");
        }
      } catch (error) {
        console.error("❌ Error loading stored credentials:", error);
      }
    };

    loadStoredCredentials();

    StatusBar.setHidden(true, "none");

    // Clean up when component unmounts
    return () => {
      StatusBar.setHidden(false, "none");
    };
  }, []);
  const containsSpace = (value: string) => /\s/.test(value);
  const sanitizeInput = (value: string): string => value.replace(/\s+/g, "");

  const validateEmail = (rawEmail: string): void => {
    const email = sanitizeInput(rawEmail);
    if (!email) {
      dispatch(setEmailError("Email is required"));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      dispatch(setEmailError("Enter a valid email address"));
    } else {
      dispatch(clearEmailError());
    }
  };

  const validatePassword = (rawPassword: string): void => {
    const password = sanitizeInput(rawPassword);
    if (!password) {
      dispatch(setPasswordError("Password is required"));
    } else if (password.length < 6) {
      dispatch(setPasswordError("Password must be at least 6 characters"));
    } else {
      dispatch(clearPasswordError());
    }
  };

  const handleLogin = async (): Promise<void> => {
    console.log("handleLogin called");
    // router.replace("/camera-screen2");

    const trimmedEmail = email.trim();
    validateEmail(trimmedEmail);
    validatePassword(password);
    if (!trimmedEmail || !password) {
      showDialog({
        title: "Error",
        message: "Please fill in both email and password.",
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: () => {}, // closes dialog
          },
        ],
      });
      return;
    }

    try {
      dispatch(loginStart());
      console.log("loginStart dispatched");

      // Online mode with 4s timeout
      const response = await withTimeout(
        (signal) => login(trimmedEmail, password, { signal }),
        4000
      );
      console.log("API response received:", response);

      // ✅ Destructure response values immediately
      const {
        access,
        refresh,
        user_detail,
        corporate_park_detail,
        role_detail,
        permission,
      } = response;

      const needsPasswordChange = user_detail.change_password === false;

      // Determine if this is a first login based on database check
      let isFirstLogin = false;

      await database.write(async () => {
        const userCollection = database.get<User>("users");
        const allUsers = await userCollection.query().fetch();

        for (const existingUser of allUsers) {
          await existingUser.update((user) => {
            user.isLoggedIn = false;
          });
        }

        const existing = await userCollection
          .query(Q.where("user_id", user_detail.id))
          .fetch();

        if (existing.length > 0) {
          // User exists in the database
          //   isFirstLogin = existing[0].isFirstLogin === true; // Get existing value

          await existing[0].update((user) => {
            user.accessToken = access;
            user.refreshToken = refresh;
            user.email = user_detail.email;
            user.corporateParkId = corporate_park_detail.id;
            user.corporateParkName = corporate_park_detail.corporate_park_name;
            user.roleId = role_detail.id;
            user.roleName = role_detail.role_name;
            user.permissions = JSON.stringify(permission);
            user.isLoggedIn = true;
            user.needsPasswordChange = user_detail.change_password === true;
            // We're not changing isFirstLogin here, maintaining its value
          });
        } else {
          // New user in our database, consider this a first login
          //  isFirstLogin = true;

          await userCollection.create((user) => {
            user.userId = user_detail.id;
            user.email = user_detail.email;
            user.corporateParkId = corporate_park_detail.id;
            user.corporateParkName = corporate_park_detail.corporate_park_name;
            user.roleId = role_detail.id;
            user.roleName = role_detail.role_name;
            user.permissions = JSON.stringify(permission);
            user.accessToken = access;
            user.refreshToken = refresh;
            user.isLoggedIn = true;
            user.needsPasswordChange = user_detail.change_password === true; // the value
            //   user.isFirstLogin = true; // Set first login flag for new users
          });
        }
      });

      const user = {
        id: user_detail.id,
        email: user_detail.email,
        corporateParkId: corporate_park_detail.id,
        corporateParkName: corporate_park_detail.corporate_park_name,
        roleId: role_detail.id,
        roleName: role_detail.role_name,
        permissions: permission,
        //  isFirstLogin: isFirstLogin,
        needsPasswordChange: needsPasswordChange, // Add this to your user object
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
      await AsyncStorage.setItem(
        "credentials",
        JSON.stringify({ email: trimmedEmail, password })
      );
      console.log("✅ Credentials saved to AsyncStorage");
      // try {
      //   const syncResult = await triggerLoginSync();
      //   console.log("Login sync completed:", syncResult);
      // } catch (syncError) {
      //   console.error("Login sync error:", syncError);
      //   // Consider if you want to show an alert for sync errors
      //   // You might want to handle this silently since login was successful
      //   console.log(
      //     "🛢Login successful but data sync failed. Some features may not work properly.🛢"
      //   );
      // }
      triggerLoginSync()
        .then((syncResult) => {
          console.log("✅ Background login sync completed:", syncResult);
        })
        .catch((syncError) => {
          console.error("⚠️ Background login sync failed:", syncError);
          // Optionally show a toast notification for sync failure instead of blocking login
          // Toast.show({ type: 'info', text1: 'Sync in progress', text2: 'Some data may take time to load' });
        });

      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay

      // Check if this is a first login and redirect accordingly
      if (needsPasswordChange) {
        console.log("Password change required, redirecting to change password");
        router.replace("/change-password-screen");
      } else {
        console.log("Normal login, redirecting to main app");
        router.replace("/checkin-screen");
      }
      console.log("Navigation complete");
    } catch (error: any) {
      console.error("Login failed:", error.toJSON ? error.toJSON() : error);
      const netState = await NetInfo.fetch();
      const networkIssue =
        !netState.isConnected ||
        netState.isInternetReachable === false ||
        !error?.response;

      // 🔥 ENHANCED: More comprehensive server error detection
      const isServerError =
        // Timeout errors
        error.message?.includes("timeout") ||
        error.code === "ECONNABORTED" ||
        error.message === "Request timeout" ||
        // Network connectivity errors
        error.message?.includes("Network Error") ||
        error.message?.includes("Network request failed") ||
        error.message?.includes("Failed to fetch") ||
        error.code === "NETWORK_ERROR" ||
        // Server HTTP errors (5xx status codes)
        (error.response?.status >= 500 && error.response?.status < 600) ||
        // Specific server errors
        error.response?.status === 502 || // Bad Gateway
        error.response?.status === 503 || // Service Unavailable
        error.response?.status === 504 || // Gateway Timeout
        error.response?.status === 500 || // Internal Server Error
        // Connection refused/server down
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("Connection refused") ||
        error.message?.includes("getaddrinfo ENOTFOUND") ||
        // SSL/TLS errors (server certificate issues)
        error.message?.includes("certificate") ||
        error.message?.includes("SSL") ||
        error.message?.includes("TLS") ||
        networkIssue;

      // 🔥 KEY CHANGE: If it's a server error, silently proceed to offline login
      if (isServerError) {
        console.log(
          "🔄 Server error detected. Silently attempting offline login...",
          {
            errorMessage: error.message,
            statusCode: error.response?.status,
            errorCode: error.code,
          }
        );

        try {
          const storedCredentials = await AsyncStorage.getItem("credentials");

          if (storedCredentials === null) {
            console.log("❌ No stored credentials available for offline login");
            showDialog({
              title: "Login Failed",
              message:
                "Unable to connect to server and no offline credentials available. Please check your connection and try again.",
              actions: [
                {
                  label: "OK",
                  mode: "contained",
                  onPress: () => {},
                },
              ],
            });
            dispatch(loginFailure("No saved credentials available."));
            return;
          }

          const { email: storedEmail, password: storedPassword } =
            JSON.parse(storedCredentials);

          if (trimmedEmail !== storedEmail || password !== storedPassword) {
            console.log("❌ Credentials don't match stored ones");
            showDialog({
              title: "Login Failed",
              message: "Invalid credentials for offline login.",
              actions: [
                {
                  label: "OK",
                  mode: "contained",
                  onPress: () => {},
                },
              ],
            });
            dispatch(loginFailure("Invalid credentials for offline login."));
            return;
          }

          const userCollection = database.get<User>("users");
          const storedUsers = await userCollection
            .query(Q.where("email", trimmedEmail))
            .fetch();

          console.log(
            "Offline query result, storedUsers count:",
            storedUsers.length
          );

          if (storedUsers.length > 0) {
            const storedUser = storedUsers[0];
            console.log("✅ Stored user found, proceeding with offline login");

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
            dispatch(setCorporateParkName(storedUser.corporateParkName));
            console.log("✅ Offline login success - navigating to app");
            router.replace("/checkin-screen");
            return;
          } else {
            console.log("❌ No stored user found for offline login");
            showDialog({
              title: "Login Failed",
              message:
                "This appears to be your first login on this device. Please connect to the internet to authenticate.",
              actions: [
                {
                  label: "OK",
                  mode: "contained",
                  onPress: () => {},
                },
              ],
            });
            dispatch(
              loginFailure("First time login requires internet connection.")
            );
          }
        } catch (offlineError) {
          console.error("💥 Offline login process failed:", offlineError);
          showDialog({
            title: "Login Failed",
            message:
              "Unable to authenticate offline. Please check your connection and try again.",
            actions: [
              {
                label: "OK",
                mode: "contained",
                onPress: () => {},
              },
            ],
          });
          dispatch(loginFailure("Offline login failed."));
        }
      } else {
        // 🔥 ONLY show error dialog for actual user/credential errors (4xx status codes)
        console.log("👤 User credential error detected - showing error dialog");

        const data = error.response?.data;
        let errorMessageToShow = "Invalid email or password. Please try again.";

        if (data && typeof data === "object") {
          if (data.message) {
            errorMessageToShow = data.message;
          } else if (data.submit) {
            errorMessageToShow = data.submit;
          } else {
            // Handle field-level errors like { password: ["Invalid password."] }
            const firstKey = Object.keys(data)[0];
            const firstError = data[firstKey];
            if (Array.isArray(firstError) && firstError.length > 0) {
              errorMessageToShow = firstError[0];
            } else if (typeof firstError === "string") {
              errorMessageToShow = firstError;
            }
          }
        }

        dispatch(loginFailure(errorMessageToShow));
        showDialog({
          title: "Login Failed",
          message: errorMessageToShow,
          actions: [
            {
              label: "OK",
              mode: "contained",
              onPress: () => {},
            },
          ],
        });
      }
    }
  };

  const handleForgotPassword = () => {
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        router.push("/forgot-password");
        console.log("Navigation to forgot password");
      } else {
        showDialog({
          title: "No Internet",
          message: "Please check your internet connection and try again.",
          actions: [
            {
              label: "OK",
              mode: "contained",
              onPress: () => {}, // closes dialog
            },
          ],
        });
      }
    });
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
      <KeyboardAvoidingView behavior={"padding"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleScreenPress}>
          <View style={styles.container}>
            <View style={styles.imageContainer}>
              <Image
                source={require("../../assets/Logo1.png")} // Replace with your image path
                style={styles.logo}
              />
            </View>

            <Text style={styles.welcomeText}>Hi, Welcome Back</Text>
            <Text style={styles.infoText}>Login to your account</Text>

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
                  const cleanedText = text.replace(/\s+/g, "").toLowerCase();
                  setEmail(cleanedText);
                  validateEmail(cleanedText);
                }}
                mode="outlined"
                outlineStyle={{
                  borderWidth: 1,
                  borderRadius: 5,
                  borderColor:
                    isEmailValid && !containsSpace(email) ? "#03045e" : "red",
                }}
                style={[
                  styles.textInput,
                  (!isEmailValid || containsSpace(email)) && {
                    borderColor: "red",
                  },
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
                  const cleanedText = text.replace(/\s+/g, "");
                  setPassword(cleanedText);
                  validatePassword(cleanedText);
                }}
                mode="outlined"
                outlineStyle={{
                  borderWidth: 1,
                  borderRadius: 5,
                  borderColor:
                    isPasswordValid && !containsSpace(password)
                      ? "#03045e"
                      : "red",
                }}
                style={[
                  styles.textInput,
                  (!isPasswordValid || containsSpace(password)) && {
                    borderColor: "red",
                  },
                ]}
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
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password</Text>
            </TouchableOpacity>

            {/* Login Button with Gradient */}
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={handleLogin}
              disabled={isLoading}
              style={[
                styles.signInButton,
                isLoading && styles.signInButtonLoading,
              ]}
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
    backgroundColor: "#EEF2F6",
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
    marginBottom: 23,
  },
  logo: {
    width: isTablet ? 210 : 110,
    height: isTablet ? 210 : 110,
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
    lineHeight: isTablet ? 40 : 25,
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
    marginTop: 5,
    padding: 2,
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
  signInButtonLoading: {
    // Optional: reduce opacity when loading
    opacity: 0.8,
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
  errorText: {
    color: "red",
    fontSize: 12,
    marginLeft: 5,
    marginTop: 4,
    fontFamily: "OpenSans_Condensed-SemiBold",
  },
});

export default LoginScreen;
