import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
  SafeAreaView,
  Platform,
  Modal,
  Alert,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { TextInput as PaperTextInput } from "react-native-paper";
import { selectUser } from "../store/slices/authSlice";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useDispatch, useSelector } from "react-redux";
import {
  setVisitorName,
  setVisitorMobile,
  setVisitingCompany,
  clearVisitorName,
  clearVisitorMobile,
  clearVisitingCompany,
  fetchCompanies,
  selectCompany,
  setCompanyDropdownVisible,
  submitVisitorForm,
  selectVisitorName,
  selectVisitorMobile,
  selectVisitingCompany,
  selectIsLoading,
  selectIsLoadingCompanies,
  setIsLoadingCompanies,
  selectFilteredCompanies,
  selectMobileError,
  selectIsMobileValid,
  setMobileError,
  setIsMobileValid,
  selectShowCompanyDropdown,
  setVisitorNameError,
  setCompanyError,
  selectVisitorNameError,
  selectCompanyError,
  loadInitialCompanies,
} from "../store/slices/visitorSlice";
import { AppDispatch, RootState } from "../store";

const { width, height } = Dimensions.get("window");
export const isTablet = width >= 768;

export default function VisitorFormScreen() {
  const router = useRouter();
  const user = useSelector(selectUser);

  const { fontScale } = useWindowDimensions();
  const mobileFontSize = 14;
  const tabletFontSize = 17;

  const responsiveFontSize = isTablet
    ? tabletFontSize / fontScale
    : mobileFontSize / fontScale;

  const visitorNameError = useSelector(selectVisitorNameError);
  const companyError = useSelector(selectCompanyError);
  const mobileError = useSelector(selectMobileError);
  const isMobileValid = useSelector(selectIsMobileValid);
  const scrollViewRef = useRef<ScrollView>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const currentSlide = useRef(new Animated.Value(0)).current;

  const [isReady, setIsReady] = useState(false);
  // Add this to your component's state
  const [isCompanySelected, setIsCompanySelected] = useState(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const {
    filteredCompanies,
    isLoadingCompanies,
    visitingCompany,
    showCompanyDropdown,
  } = useSelector((state: RootState) => state.visitor);
  // Redux hooks
  const dispatch = useDispatch<AppDispatch>();
  const [displayCompanyName, setDisplayCompanyName] = useState("");
  // Get state from Redux store
  const visitorName = useSelector(selectVisitorName);
  const visitorMobile = useSelector(selectVisitorMobile);
  // const visitingCompany = useSelector(selectVisitingCompany);
  const isLoading = useSelector(selectIsLoading);

  // const isLoadingCompanies = useSelector(selectIsLoadingCompanies);
  //const filteredCompanies = useSelector(selectFilteredCompanies);
  // const showCompanyDropdown = useSelector(selectShowCompanyDropdown);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  // Add this at the top of your VisitorFormScreen component
  useEffect(() => {
    // Make sure user exists before trying to access its properties
    if (user) {
      // Convert to string because your functions expect userId as string
      const userIdString = user.id.toString();
      dispatch(loadInitialCompanies(userIdString));
    }
  }, [user, dispatch]);
  // Handle company search
  const handleCompanySearch = (text: string) => {
    if (text.trim().length > 0) {
      dispatch(setCompanyError(null));
    }
    setDisplayCompanyName(text); // Update display text
    dispatch(setVisitingCompany(text as any));
    setIsCompanySelected(false);

    // Clear any previous timer
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set a new timer to call API after a delay (300ms)
    const timeout = setTimeout(() => {
      if (user) {
        const userIdString = user.id.toString();
        dispatch(fetchCompanies(text, userIdString));
      }
      // Optionally, show dropdown when results come in
      dispatch(setCompanyDropdownVisible(true));
    }, 300);
    setSearchTimeout(timeout);
  };

  // Add this effect to your component
  useEffect(() => {
    // When filtered companies change and there are results, show the dropdown
    if (
      filteredCompanies.length > 0 &&
      typeof visitingCompany === "string" &&
      visitingCompany.trim() !== ""
    ) {
      dispatch(setCompanyDropdownVisible(true));
    }
  }, [filteredCompanies, visitingCompany]);

  // Keyboard listeners to adjust scroll position
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
        // Scroll down to make sure dropdown is visible
        if (scrollViewRef.current) {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    StatusBar.setHidden(true, "none");
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );
    // Clean up listeners when component unmounts
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      StatusBar.setHidden(false, "none");
    };
  }, []);

  // When company field gets focus, scroll to it
  const handleCompanyFocus = () => {
    dispatch(setCompanyDropdownVisible(true));
    if (!displayCompanyName.trim()) {
      console.log("Company field focused, loading initial companies");
      if (user) {
        // Convert to string because your functions expect userId as string
        const userIdString = user.id.toString();
        dispatch(loadInitialCompanies(userIdString));
      }
    } else if (displayCompanyName.trim()) {
      // If there's already text, trigger a search
      console.log("Company field focused with text, triggering search");
      if (user) {
        console.log(`Searching companies for user ID: ${user.id}`, {
          searchTerm: displayCompanyName,
          user: user,
        });

        const userIdString = user.id.toString();
        dispatch(fetchCompanies(displayCompanyName, userIdString));
      } else {
        console.warn("Cannot search companies: No user found in state");
      }
    }

    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };
  // Validate form fields
  const validateFields = (): boolean => {
    let isValid = true;

    // Clear previous errors
    dispatch(setVisitorNameError(null));
    dispatch(setMobileError(null));
    dispatch(setCompanyError(null));
    dispatch(setIsMobileValid(true));

    // Validate Visitor Name
    if (!visitorName.trim()) {
      dispatch(setVisitorNameError("Please enter visitor name"));
      isValid = false;
    }

    // Validate Mobile Number
    if (!visitorMobile.trim()) {
      dispatch(setMobileError("Please enter mobile number"));
      dispatch(setIsMobileValid(false));
      isValid = false;
    } else if (visitorMobile.length !== 10) {
      dispatch(setMobileError("Mobile number must be exactly 10 digits"));
      dispatch(setIsMobileValid(false));
      isValid = false;
    }

    // Validate Visiting Company
    // Validate Visiting Company
    if (!isCompanySelected) {
      dispatch(setCompanyError("Please select a company from the dropdown"));
      isValid = false;
    } else if (
      visitingCompany === null ||
      visitingCompany === undefined ||
      (typeof visitingCompany === "string" && visitingCompany.trim() === "") ||
      visitingCompany === 0
    ) {
      dispatch(setCompanyError("Please select a valid company"));
      isValid = false;
    }
    return isValid;
  };

  // Handle Next button press
  const handleNext = () => {
    // Assume validateFields returns true if fields are valid
    if (!validateFields()) return;
    Animated.parallel([
      Animated.timing(currentSlide, {
        toValue: -width,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.replace("/camera-screen2");
    });
  };

  // Make sure this function is being called when a company is selected from the dropdown
  const handleSelectCompany = (company: { label: string; value: any }) => {
    console.log("Selected company:", company);
    Keyboard.dismiss();
    setDisplayCompanyName(company.label);
    setIsCompanySelected(true);
    dispatch(
      selectCompany({
        label: company.label,
        value: company.value, // Ensure it's a string
      })
    );
    // Hide the dropdown immediately
    dispatch(setCompanyDropdownVisible(false));
  };

  const handleClearCompany = () => {
    setDisplayCompanyName(""); // Clear display text
    dispatch(clearVisitingCompany());
    setIsCompanySelected(false);
  };
  const handleClearName = () => {
    dispatch(clearVisitorName());
  };

  const handleScreenPress = () => {
    Keyboard.dismiss();
    dispatch(setCompanyDropdownVisible(false));
  };

  const handleClearMobile = () => {
    dispatch(clearVisitorMobile());
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    // Reset visitor form state by dispatching the resetForm or clear actions
    dispatch(clearVisitorName());
    dispatch(clearVisitorMobile());
    dispatch(clearVisitingCompany());
    dispatch(setCompanyDropdownVisible(false));
    router.replace("/checkin-screen");
  };

  const handleCancel = () => {
    setShowCancelModal(true);
  };
  useEffect(() => {
    // Simulate asset loading or do your async preloading here
    // e.g., Promise.all([loadAssets(), loadData()]).then(() => setIsReady(true));
    setTimeout(() => setIsReady(true), 500); // temporary example delay
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer1}>
        <ActivityIndicator size="large" color="#03045E" />
      </View>
    );
  }
  const getResponsiveSize = (baseSize: number) => {
    const scaleFactor = width / 375; // Standard iPhone width as base
    return baseSize * scaleFactor;
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView} // important: flex: 1
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={handleScreenPress}>
        <View style={styles.wrapper}>
          <Animated.View
            style={[
              styles.screen,
              { transform: [{ translateX: currentSlide }] },
            ]}
          >
            <View style={styles.container2}>
              <View
                style={[
                  styles.borderContainer,
                  { width: width, height: height },
                ]}
              >
                <View style={styles.container}>
                  <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.formContainer}>
                      <Modal
                        visible={showCancelModal}
                        transparent={true}
                        animationType="fade"
                      >
                        <View style={styles.modalOverlay}>
                          <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                              <Text style={styles.modalTitle}>
                                Confirm Cancel
                              </Text>
                            </View>
                            <View style={styles.modalBody}>
                              <Text style={styles.modalTextCancel}>
                                Are you sure you want to cancel?
                              </Text>
                            </View>
                            <View style={styles.modalFooter}>
                              <TouchableOpacity
                                style={[
                                  styles.modalButton,
                                  styles.modalCancelButton,
                                ]}
                                onPress={() => setShowCancelModal(false)}
                              >
                                <Text style={styles.modalCancelButtonText}>
                                  Cancel
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.modalButton,
                                  styles.modalConfirmButton,
                                ]}
                                onPress={confirmCancel}
                              >
                                <Text style={styles.modalConfirmButtonText}>
                                  Confirm
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </Modal>

                      {/* Visitor Name Input */}
                      <View style={styles.inputContainer}>
                        <PaperTextInput
                          left={
                            <PaperTextInput.Icon
                              icon="account"
                              color="#03045E"
                              size={22}
                            />
                          }
                          label={
                            <Text
                              style={{
                                color: "#03045E",
                                fontFamily: "OpenSans_Condensed-Regular",
                                fontSize: responsiveFontSize,
                              }}
                            >
                              Visitor Name
                            </Text>
                          }
                          textColor="#03045E"
                          maxLength={50}
                          value={visitorName}
                          onChangeText={(text) => {
                            const filteredText = text.replace(
                              /[^a-zA-Z\s]/g,
                              ""
                            );
                            dispatch(setVisitorName(filteredText));
                            // Clear error when user starts typing a non-empty value
                            if (filteredText.trim().length > 0) {
                              dispatch(setVisitorNameError(null));
                            }
                          }}
                          mode="outlined"
                          outlineStyle={{
                            borderWidth: 1,
                            borderRadius: 5,
                            borderColor: visitorNameError ? "red" : "#03045E",
                          }}
                          contentStyle={{
                            paddingTop: 8, // Increased top padding for floating label
                            paddingBottom: 8,
                          }}
                          style={[
                            styles.textInput,
                            visitorNameError && { borderColor: "red" },
                          ]}
                          theme={{
                            colors: {
                              primary: "#03045E",
                              text: "#03045E",
                              background: "#EEF2F6",
                            },
                          }}
                          right={
                            visitorName ? (
                              <PaperTextInput.Icon
                                icon="close-circle-outline"
                                onPress={handleClearName}
                                color="#03045E"
                                size={20}
                              />
                            ) : null
                          }
                          selectionColor="#03045E"
                        />
                        {visitorNameError ? (
                          <Text
                            style={{
                              color: "red",
                              fontSize: responsiveFontSize - 2,
                              marginLeft: 5,
                              fontFamily: "OpenSans_Condensed-Regular",
                            }}
                          >
                            {visitorNameError}
                          </Text>
                        ) : null}
                      </View>

                      {/* Visitor Mobile Input */}
                      <View style={styles.inputContainer}>
                        <PaperTextInput
                          left={
                            <PaperTextInput.Icon
                              icon="phone"
                              color="#03045E"
                              size={22}
                            />
                          }
                          label={
                            <Text
                              style={{
                                color: "#03045E",
                                fontFamily: "OpenSans_Condensed-Regular",
                                fontSize: responsiveFontSize,
                              }}
                            >
                              Visitor Mobile
                            </Text>
                          }
                          mode="outlined"
                          textColor="#03045E"
                          maxLength={10}
                          value={visitorMobile}
                          onChangeText={(text) => {
                            const filteredText = text.replace(/[^0-9]/g, "");
                            dispatch(setVisitorMobile(filteredText));
                            // Clear mobile error when user types and input becomes non-empty
                            if (
                              filteredText.trim().length > 0 &&
                              filteredText.length === 10
                            ) {
                              dispatch(setMobileError(null));
                              dispatch(setIsMobileValid(true));
                            }
                          }}
                          outlineStyle={{
                            borderWidth: 1,
                            borderRadius: 5,
                            borderColor: isMobileValid ? "#03045e" : "red",
                          }}
                          style={[
                            styles.textInput,
                            !isMobileValid && { borderColor: "red" },
                          ]}
                          theme={{
                            colors: {
                              primary: "#03045E",
                              text: "#03045E",
                              background: "#EEF2F6",
                            },
                          }}
                          contentStyle={{
                            paddingTop: 8, // Increased top padding for floating label
                            paddingBottom: 8,
                          }}
                          keyboardType="phone-pad"
                          right={
                            visitorMobile ? (
                              <PaperTextInput.Icon
                                icon="close-circle-outline"
                                onPress={handleClearMobile}
                                color="#03045E"
                                size={25}
                              />
                            ) : null
                          }
                          selectionColor="#03045E"
                        />
                        {mobileError ? (
                          <Text
                            style={{
                              color: "red",
                              fontSize: responsiveFontSize - 2,
                              marginLeft: 5,
                              fontFamily: "OpenSans_Condensed-Regular",
                            }}
                          >
                            {mobileError}
                          </Text>
                        ) : null}
                      </View>

                      {/* Visiting Company Input with Dropdown */}
                      <View style={styles.inputContainer}>
                        <PaperTextInput
                          left={
                            <PaperTextInput.Icon
                              icon="office-building"
                              color="#03045E"
                              size={22}
                            />
                          }
                          label={
                            <Text
                              style={{
                                color: "#03045E",
                                fontFamily: "OpenSans_Condensed-Regular",
                                fontSize: responsiveFontSize,
                              }}
                            >
                              Visiting Company
                            </Text>
                          }
                          textColor="#03045E"
                          value={displayCompanyName}
                          onChangeText={handleCompanySearch}
                          onFocus={handleCompanyFocus}
                          mode="outlined"
                          outlineStyle={{
                            borderWidth: 1,
                            borderRadius: 5,
                            borderColor: companyError ? "red" : "#03045E",
                          }}
                          style={[
                            styles.textInput,
                            companyError && { borderColor: "red" },
                          ]}
                          theme={{
                            colors: {
                              primary: "#03045E",
                              text: "#03045E",
                              background: "#EEF2F6",
                            },
                          }}
                          contentStyle={{
                            paddingTop: 8, // Increased top padding for floating label
                            paddingBottom: 8,
                          }}
                          right={
                            displayCompanyName ? (
                              <PaperTextInput.Icon
                                icon="close-circle-outline"
                                onPress={handleClearCompany}
                                color="#03045E"
                                size={25}
                              />
                            ) : null
                          }
                          selectionColor="#03045E"
                        />
                        {companyError ? (
                          <Text
                            style={{
                              color: "red",
                              fontSize: responsiveFontSize - 2,
                              marginLeft: 5,
                              fontFamily: "OpenSans_Condensed-Regular",
                            }}
                          >
                            {companyError}
                          </Text>
                        ) : null}
                        {/* Company Dropdown */}
                        {showCompanyDropdown &&
                          filteredCompanies.length > 0 && (
                            <View
                              style={[
                                styles.dropdownContainer,
                                { maxHeight: 200 },
                              ]}
                            >
                              {isLoadingCompanies ? (
                                <View style={styles.loadingDropdown}>
                                  <ActivityIndicator
                                    size="small"
                                    color="#03045E"
                                  />
                                </View>
                              ) : (
                                <FlatList
                                  data={filteredCompanies}
                                  keyExtractor={(item) => item.value}
                                  keyboardShouldPersistTaps="handled"
                                  style={styles.dropdownList}
                                  nestedScrollEnabled={true}
                                  showsVerticalScrollIndicator={true}
                                  renderItem={({ item }) => (
                                    <TouchableOpacity
                                      style={styles.dropdownItem}
                                      onPress={() => handleSelectCompany(item)}
                                    >
                                      <Text style={styles.dropdownText}>
                                        {item.label}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                />
                              )}
                            </View>
                          )}
                      </View>

                      {/* Add empty space to ensure scrolling works well */}
                      {showCompanyDropdown && filteredCompanies.length > 0 && (
                        <View style={{ height: 160 }} />
                      )}
                      {/* 
                      <View style={styles.buttonContainer}>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={handleCancel}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={40}
                            color="red"
                          />
                          <Text style={styles.buttonTextCancel}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.submitButton}
                          onPress={handleNext}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={40}
                            color="#03045E"
                          />
                          <Text style={styles.buttonTextNext}>Next</Text>
                        </TouchableOpacity>
                      </View> */}

                      <View style={styles.modalButtons}>
                        <TouchableOpacity
                          style={[
                            styles.cancelButton,
                            {
                              width: "40%",
                              height: getResponsiveSize(40),
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 10,
                            },
                          ]}
                          onPress={handleCancel}
                        >
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color="#03045E"
                          />
                          <Text style={styles.canceltext}>Cancel</Text>
                        </TouchableOpacity>
                        <View style={{ width: "15%" }} />
                        <TouchableOpacity
                          style={[
                            styles.submitButton,
                            {
                              width: "40%",
                              height: getResponsiveSize(40),
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 10,
                            },
                          ]}
                          onPress={handleNext}
                        >
                          <Text style={styles.buttonText}>Next</Text>
                          <Ionicons
                            name="chevron-forward-outline"
                            size={22}
                            color="white"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {isLoading && (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#03045E" />
                      </View>
                    )}
                  </ScrollView>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 30,
  },
  formContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 50,
  },
  screen: {
    flex: 1,
    width: width,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    fontSize: 24,
    fontFamily: "OpenSans_Condensed-Bold",
    color: "#03045E",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "#EEF2F6",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "#EEF2F6",
    borderRadius: 10,
  },
  container2: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },

  imageContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 100,
    height: 100,
  },
  borderContainer: {
    padding: 15,
    backgroundColor: "#EEF2F6",
    // borderWidth: 14,
    // borderColor: "#03045E", // Sky blue color
    // borderRadius: 2,
    // overflow: "hidden",
  },
  inputContainer: {
    width: "95%",
    marginVertical: 12,
    position: "relative",
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 54,
    justifyContent: "center", // Center buttons horizontally
    alignItems: "center", // Align items vertically
    width: "100%",
    gap: 20, // Add space between buttons
  },
  // cancelButton: {
  //   flexDirection: "row",
  //   alignItems: "center",
  //   justifyContent: "center",
  //   backgroundColor: "transparent",
  //   paddingVertical: 12,
  //   paddingHorizontal: 20,
  //   borderRadius: 8,
  //   flex: 1, // Make buttons take equal space
  // },
  // submitButton: {
  //   flexDirection: "row",
  //   alignItems: "center",
  //   justifyContent: "center",
  //   backgroundColor: "transparent",
  //   paddingVertical: 12,
  //   paddingHorizontal: 20,
  //   borderRadius: 8,
  //   flex: 1, // Make buttons take equal space
  // },
  buttonTextCancel: {
    color: "red",
    fontSize: 17,
    fontFamily: "OpenSans_Condensed-Bold",
    marginLeft: 8,
  },
  buttonTextNext: {
    color: "#03045E",
    fontSize: 17,
    fontFamily: "OpenSans_Condensed-Bold",
    marginLeft: 8,
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
    backgroundColor: "#EEF2F6",
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
    width: "90%",
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
    ...StyleSheet.absoluteFillObject, // Fills the entire screen
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Optional: Slight background dimming
  },
  loadingContainer1: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  // Dropdown styles
  dropdownContainer: {
    width: "100%",
    position: "absolute",
    top: "100%",
    left: 0,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#03045E",
    borderRadius: 5,
    zIndex: 1000,
    elevation: 5,
    marginTop: 2,
    maxHeight: 200,
  },
  dropdownList: {
    width: "100%",
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownText: {
    color: "#03045E",
    fontFamily: "OpenSans_Condensed-Regular",
    fontSize: 16,
  },
  loadingDropdown: {
    padding: 15,
    alignItems: "center",
  },
  touchableContainer: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    width: "90%",
    maxWidth: 400,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    backgroundColor: "red",
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  modalBody: {
    padding: 20,
    alignItems: "center",
  },
  modalIcon: {
    marginBottom: 15,
  },
  modalTextCancel: {
    fontSize: 16,
    color: "#03045E",
    textAlign: "center",
    fontFamily: "OpenSans_Condensed-Regular",
  },
  modalFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButton: {
    borderRightWidth: 1,
    borderRightColor: "#EEEEEE",
  },
  modalCancelButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontFamily: "OpenSans_Condensed-SemiBold",
  },
  modalConfirmButton: {
    backgroundColor: "#FFFFFF",
  },
  modalConfirmButtonText: {
    color: "#03045E",
    fontSize: 16,
    fontFamily: "OpenSans_Condensed-SemiBold",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderColor: "#03045E",
    borderWidth: 2,
    padding: 7,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 40,
  },
  canceltext: {
    color: "#02023C",
    fontSize: isTablet ? 20 : 14,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  submitButton: {
    backgroundColor: "#03045E",
    padding: 8,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  buttonText: {
    color: "white",
    fontSize: isTablet ? 20 : 14,
    fontFamily: "OpenSans_Condensed-Bold",
  },
});
