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
import { LoginContext } from "../context/LoginContext"; // Make sure this path matches your project structure
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import NetInfo from "@react-native-community/netinfo";

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

interface LoginFormProps {
  onLogin?: (email: string, password: string) => void;
}

const { width, height } = Dimensions.get("window");

const isTablet = width >= 768; // Common tablet breakpoint

const LoginScreen: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

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
    // router.replace("/camera-screen2");

    const trimmedEmail = email.trim();
    validateEmail(trimmedEmail);
    validatePassword(password);

    if (!trimmedEmail || !password) {
      Alert.alert("Error", "Please fill in both email and password.");
      return;
    }

    try {
      dispatch(loginStart());
      console.log("loginStart dispatched");

      const response = await login(trimmedEmail, password);
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
      try {
        const syncResult = await triggerLoginSync();
        console.log("Login sync completed:", syncResult);
      } catch (syncError) {
        console.error("Login sync error:", syncError);
        // Consider if you want to show an alert for sync errors
        // You might want to handle this silently since login was successful
        console.log(
          "🛢Login successful but data sync failed. Some features may not work properly.🛢"
        );
      }

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

  // // Start sync process
  // console.log('Triggering sync after login');
  // triggerLoginSync()
  //   .then(result => {
  //     console.log('Login sync completed:', result);
  //   })
  //   .catch(error => {
  //     console.error('Login sync error:', error);
  //   });

  // const handleLogin = async (): Promise<void> => {
  //   console.log("handleLogin called");
  //   // router.replace("/camera-screen2");

  //   const trimmedEmail = email.trim();
  //   validateEmail(trimmedEmail);
  //   validatePassword(password);

  //   if (!trimmedEmail || !password) {
  //     Alert.alert("Error", "Please fill in both email and password.");
  //     return;
  //   }

  //   try {
  //     dispatch(loginStart());
  //     console.log("loginStart dispatched");

  //     const response = await login(trimmedEmail, password);
  //     console.log("API response received:", response);

  //     // ✅ Destructure response values immediately
  //     const {
  //       access,
  //       refresh,
  //       user_detail,
  //       corporate_park_detail,
  //       role_detail,
  //       permission,
  //     } = response;

  //     await database.write(async () => {
  //       const userCollection = database.get<User>("users");
  //       const allUsers = await userCollection.query().fetch();
  //       for (const existingUser of allUsers) {
  //         await existingUser.update((user) => {
  //           user.isLoggedIn = false;
  //         });
  //       }

  //       const existing = await userCollection
  //         .query(Q.where("user_id", user_detail.id))
  //         .fetch();

  //       if (existing.length > 0) {
  //         await existing[0].update((user) => {
  //           user.accessToken = access;
  //           user.refreshToken = refresh;
  //           user.email = user_detail.email;
  //           user.corporateParkId = corporate_park_detail.id;
  //           user.corporateParkName = corporate_park_detail.corporate_park_name;
  //           user.roleId = role_detail.id;
  //           user.roleName = role_detail.role_name;
  //           user.permissions = JSON.stringify(permission);
  //           user.isLoggedIn = true;
  //         });
  //       } else {
  //         await userCollection.create((user) => {
  //           user.userId = user_detail.id;
  //           user.email = user_detail.email;
  //           user.corporateParkId = corporate_park_detail.id;
  //           user.corporateParkName = corporate_park_detail.corporate_park_name;
  //           user.roleId = role_detail.id;
  //           user.roleName = role_detail.role_name;
  //           user.permissions = JSON.stringify(permission);
  //           user.accessToken = access;
  //           user.refreshToken = refresh;
  //           user.isLoggedIn = true;
  //         });
  //       }
  //     });

  //     const user = {
  //       id: user_detail.id,
  //       email: user_detail.email,
  //       corporateParkId: corporate_park_detail.id,
  //       corporateParkName: corporate_park_detail.corporate_park_name,
  //       roleId: role_detail.id,
  //       roleName: role_detail.role_name,
  //       permissions: permission,
  //     };

  //     console.log("Constructed user object:", user);

  //     // Dispatch loginSuccess with the user and token details
  //     dispatch(
  //       loginSuccess({
  //         user,
  //         accessToken: access,
  //         refreshToken: refresh,
  //       })
  //     );
  //     dispatch(setCorporateParkName(corporate_park_detail.corporate_park_name));
  //     console.log("Corporate park name dispatched to global store");
  //     console.log("loginSuccess dispatched");

  //     // Start session monitoring after successful login
  //     startSessionMonitoring();

  //     await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
  //     // Navigate to the checkin screen after successful login
  //     router.replace("/checkin-screen");
  //     console.log("Navigation to checkin-screen complete");
  //   } catch (error: any) {
  //     // Log the detailed error for debugging purposes
  //     console.error("Login failed:", error.toJSON ? error.toJSON() : error);

  //     // Check for specific error types from our modified login function
  //     if (error.message === "ALREADY_LOGGED_IN") {
  //       Alert.alert(
  //         "Login Failed",
  //         "You are already logged in on another device. Please log out from the other device first."
  //       );
  //       dispatch(loginFailure("Already logged in on another device"));
  //       return;
  //     }

  //     if (error.message === "PLAN_EXPIRED") {
  //       Alert.alert(
  //         "Login Failed",
  //         "Your plan has expired. Please contact your administrator."
  //       );
  //       dispatch(loginFailure("Plan expired"));
  //       return;
  //     }

  //     // If the error has a response with a detailed message, use it
  //     const detailedError =
  //       error.response && error.response.data && error.response.data.message
  //         ? error.response.data.message
  //         : error.message || "Invalid email or password. Please try again.";

  //     // If the error indicates a network error, attempt offline login
  //     if (error.message && error.message.includes("Network Error")) {
  //       console.log("Network error detected. Attempting offline login...");
  //       try {
  //         const userCollection = database.get<User>("users");
  //         const storedUsers = await userCollection
  //           .query(
  //             // Query for a stored user with the same email
  //             Q.where("email", trimmedEmail)
  //           )
  //           .fetch();
  //         console.log(
  //           "Offline query result, storedUsers count:",
  //           storedUsers.length
  //         );
  //         if (storedUsers.length > 0) {
  //           const storedUser = storedUsers[0];
  //           console.log("Stored user found:", storedUser);
  //           dispatch(
  //             loginSuccess({
  //               user: {
  //                 id: Number(storedUser.userId),
  //                 email: storedUser.email,
  //                 corporateParkId: storedUser.corporateParkId,
  //                 corporateParkName: storedUser.corporateParkName,
  //                 roleId: storedUser.roleId,
  //                 roleName: storedUser.roleName,
  //                 permissions: storedUser.permissions
  //                   ? JSON.parse(storedUser.permissions)
  //                   : {},
  //               },
  //               accessToken: storedUser.accessToken,
  //               refreshToken: storedUser.refreshToken,
  //             })
  //           );

  //           // Start session monitoring after successful offline login
  //           startSessionMonitoring();

  //           console.log("Offline login success dispatched");
  //           router.replace("/checkin-screen");
  //           console.log("Offline navigation to checkin-screen complete");
  //           return;
  //         } else {
  //           Alert.alert(
  //             "Login Failed",
  //             "No offline credentials found for this email."
  //           );
  //         }
  //       } catch (offlineError) {
  //         console.error("Offline login error:", offlineError);
  //         Alert.alert(
  //           "Login Failed",
  //           "Offline login failed. Please try again later."
  //         );
  //       }
  //     } else {
  //       // Display the detailed error message from the response if available
  //       Alert.alert("Login Failed", detailedError);
  //     }
  //     dispatch(loginFailure(detailedError));
  //   }
  // };
  const handleForgotPassword = () => {
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        router.push("/forgot-password");
        console.log("Navigation to forgot password");
      } else {
        Alert.alert(
          "No Internet",
          "Please check your internet connection and try again."
        );
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

export default LoginScreen;
