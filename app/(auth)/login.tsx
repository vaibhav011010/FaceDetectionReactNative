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
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { LoginContext } from "../context/LoginContext"; // Make sure this path matches your project structure
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";

interface LoginFormProps {
  onLogin?: (email: string, password: string) => void;
}

const LoginScreen: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isEmailValid, setIsEmailValid] = useState<boolean>(true);
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { setIsLoggedIn } = useContext(LoginContext);
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const responsiveFontSize = 16 / fontScale;

  // Set status bar to hidden when component mounts
  useEffect(() => {
    StatusBar.setHidden(true, "none");

    // Clean up when component unmounts
    return () => {
      StatusBar.setHidden(false, "none");
    };
  }, []);

  const handleLogin = () => {
    // Validate inputs before proceeding
    validateEmail(email);
    validatePassword(password);

    // Only proceed if both inputs are valid
    if (email && password) {
      setIsLoading(true);
      // Simulate a short delay to show loading state
      setTimeout(() => {
        setIsLoggedIn(true);
        router.replace("/checkin-screen");
        setIsLoading(false);
      }, 1000);
    }
  };

  const handleForgotPassword = () => {
    // Will implement later
  };

  const handleSignup = () => {
    // Will implement later
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
  const validateEmail = (email: string): void => {
    // Simple validation for now
    if (!email) {
      setIsEmailValid(false);
      setEmailError("Email is required");
    } else {
      setIsEmailValid(true);
      setEmailError(null);
    }
  };

  const validatePassword = (password: string): void => {
    // Simple validation for now
    if (!password) {
      setIsPasswordValid(false);
      setPasswordError("Password is required");
    } else {
      setIsPasswordValid(true);
      setPasswordError(null);
    }
  };

  const handleClearEmail = (): void => {
    setEmail("");
    setEmailError(null);
    setIsEmailValid(true);
  };

  const handleClearPassword = (): void => {
    setPassword("");
    setPasswordError(null);
    setIsPasswordValid(true);
  };

  const clearEmailError = (): void => {
    setEmailError(null);
    setIsEmailValid(true);
  };

  const clearPasswordError = (): void => {
    setPasswordError(null);
    setIsPasswordValid(true);
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword);
  };
  const handleScreenPress = () => {
    Keyboard.dismiss();
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
                onFocus={clearEmailError}
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
                onFocus={clearPasswordError}
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
