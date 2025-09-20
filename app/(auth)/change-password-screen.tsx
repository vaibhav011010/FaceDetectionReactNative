import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  useWindowDimensions,
  StatusBar,
  TouchableWithoutFeedback,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import LinearGradient from "react-native-linear-gradient";
import { changePassword } from "../api/auth";
import { useAppDispatch } from "../store/hooks";
import { logout } from "../store/slices/authSlice";
import database from "../database";
import User from "../database/models/User";
import { Q } from "@nozbe/watermelondb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  UniversalDialogProvider,
  useUniversalDialog,
} from "@/src/utility/UniversalDialogProvider";

const { width, height } = Dimensions.get("window");

const isTablet = width >= 768;
const ChangePasswordScreen = () => {
  const [oldPassword, setOldPassword] = useState("");
  const [OldPasswordError, setOldPasswordError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const showDialog = useUniversalDialog();

  const [isOldPasswordValid, setIsOldPasswordValid] = useState<boolean>(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(true);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);
  const [isConfirmPasswordValid, setIsConfirmPasswordValid] =
    useState<boolean>(true);
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const dispatch = useAppDispatch();
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

  const handlePasswordChange = async () => {
    // Basic validation
    if (!oldPassword || !newPassword || !confirmPassword) {
      showDialog({
        title: "Error",
        message: "All fields are required.",
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

    if (newPassword !== confirmPassword) {
      showDialog({
        title: "Error",
        message: "New password and confirm password do not match",
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

    if (newPassword.length < 8) {
      showDialog({
        title: "Error",
        message: "New password must be at least 8 characters long",
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
      setIsLoading(true);

      // Call the API to change password
      await changePassword(oldPassword, newPassword, confirmPassword);

      // Update the isFirstLogin flag in the database
      await database.write(async () => {
        const userCollection = database.get<User>("users");
        const loggedInUsers = await userCollection
          .query(Q.where("is_logged_in", true))
          .fetch();

        if (loggedInUsers.length > 0) {
          await loggedInUsers[0].update((user) => {
            user.isFirstLogin = false;
          });
        }
      });

      showDialog({
        title: "Success",
        message: "Password changed successfully. You will be logged out.",
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: async () => {
              try {
                const saved = await AsyncStorage.getItem("credentials");
                if (saved) {
                  const { email } = JSON.parse(saved);

                  // Overwrite the stored credentials with the new password
                  await AsyncStorage.setItem(
                    "credentials",
                    JSON.stringify({ email, password: newPassword })
                  );
                  console.log(
                    "🔐 Password updated in AsyncStorage after change"
                  );
                }
              } catch (err) {
                console.error("❌ Failed to update password in storage:", err);
              }

              dispatch(logout());
              router.replace("/");
            },
          },
        ],
      });
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        "Failed to change password. Please try again.";
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
  const validateOldPassword = (password: string): void => {
    console.log("Validating password:", password); // Add this for debugging

    // More permissive regex that accepts common special characters
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

    if (!password) {
      console.log("Password empty");
      setOldPasswordError("Current Password is required");
      setIsOldPasswordValid(false);
      return;
    }

    const isValid = passwordRegex.test(password);
    console.log("Password valid?", isValid); // Add this for debugging

    if (isValid) {
      console.log("Setting valid state");
      setOldPasswordError(null);
      setIsOldPasswordValid(true);
    } else {
      console.log("Setting invalid state");
      setOldPasswordError(
        "Password must be at least 8 characters long, with one uppercase letter, one lowercase letter, one number, and one special character."
      );
      setIsOldPasswordValid(false);
    }
  };

  const toggleConfirmPasswordVisibility = (): void => {
    setShowConfirmPassword(!showConfirmPassword);
  };
  const togglePasswordVisibility = (): void => {
    setShowNewPassword(!showNewPassword);
  };
  const toggleOldPasswordVisibility = (): void => {
    setShowOldPassword(!showOldPassword);
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

            <Text style={styles.welcomeText}>Change Password</Text>

            {/* Old Password Input */}
            {/* <View style={styles.inputContainer}>
              <PaperTextInput
                label="Current Password"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry={!showOldPassword}
                style={styles.input}
                right={
                  <PaperTextInput.Icon
                    icon={showOldPassword ? "eye-off" : "eye"}
                    onPress={() => setShowOldPassword(!showOldPassword)}
                  />
                }
              />
            </View> */}

            <View
              style={[
                styles.inputContainer,
                OldPasswordError ? { marginBottom: 30 } : null, // Add extra margin when error is shown
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
                    current Password
                  </Text>
                }
                textColor="#03045E"
                value={oldPassword}
                onBlur={() => validateOldPassword(oldPassword)}
                secureTextEntry={!showOldPassword}
                onChangeText={(text) => {
                  setOldPassword(text);
                  validateOldPassword(text);
                }}
                mode="outlined"
                outlineStyle={{
                  borderWidth: 1,
                  borderRadius: 5,
                  borderColor: isOldPasswordValid ? "#03045e" : "red",
                }}
                style={[
                  styles.textInput,
                  !isOldPasswordValid && { borderColor: "red" },
                ]}
                contentStyle={{
                  paddingTop: 8, // Increased top padding for floating label
                  paddingBottom: 8,
                }}
                theme={{
                  colors: {
                    primary: isOldPasswordValid ? "#03045E" : "red",
                    text: "#03045E",
                    background: "#EEF2F6",
                  },
                }}
                right={
                  <PaperTextInput.Icon
                    icon={showOldPassword ? "eye-outline" : "eye-off-outline"}
                    onPress={toggleOldPasswordVisibility}
                    color="#000"
                    size={20}
                  />
                }
                selectionColor="#03045E"
              />
              {OldPasswordError ? (
                <Text
                  style={{
                    color: "red",
                    fontSize: responsiveFontSize - 2,
                    marginLeft: 5,
                    marginBottom: 15,
                    fontFamily: "OpenSans_Condensed-Regular",
                  }}
                >
                  {OldPasswordError}
                </Text>
              ) : null}
            </View>

            {/* New Password Input */}
            {/* <View style={styles.inputContainer}>
              <PaperTextInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                style={styles.input}
                right={
                  <PaperTextInput.Icon
                    icon={showNewPassword ? "eye-off" : "eye"}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  />
                }
              />
            </View> */}
            <View
              style={[
                styles.inputContainer,
                passwordError ? { marginBottom: 30 } : null, // Add extra margin when error is shown
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
                    New Password
                  </Text>
                }
                textColor="#03045E"
                value={newPassword}
                onBlur={() => validatePassword(newPassword)}
                secureTextEntry={!showNewPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
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
                    icon={showNewPassword ? "eye-outline" : "eye-off-outline"}
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

            {/* Confirm Password Input */}
            {/* <View style={styles.inputContainer}>
              <PaperTextInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                style={styles.input}
                right={
                  <PaperTextInput.Icon
                    icon={showConfirmPassword ? "eye-off" : "eye"}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
              />
            </View> */}

            <View style={[styles.inputContainer, { marginBottom: 30 }]}>
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
                  validateConfirmPassword(confirmPassword, newPassword)
                }
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  validateConfirmPassword(text, newPassword);
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

            {/* Submit Button */}
            {/* <TouchableOpacity
              style={styles.button}
              onPress={handlePasswordChange}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Change Password</Text>
              )}
            </TouchableOpacity> */}
            <TouchableOpacity
              activeOpacity={0.5}
              onPress={handlePasswordChange}
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
                  <Text style={styles.signInButtonText}>Change</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
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
});

export default ChangePasswordScreen;
