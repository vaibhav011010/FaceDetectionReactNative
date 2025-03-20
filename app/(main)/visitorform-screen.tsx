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
} from "react-native";
import { useRouter } from "expo-router";
import { TextInput as PaperTextInput } from "react-native-paper";

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
  selectShowCompanyDropdown,
} from "../store/slices/visitorSlice";
import { AppDispatch, RootState } from "../store";

let searchTimeout: NodeJS.Timeout | null = null;

export default function VisitorFormScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const responsiveFontSize = 18 / fontScale;
  const scrollViewRef = useRef<ScrollView>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
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

  // Handle company search
  const handleCompanySearch = (text: string) => {
    setDisplayCompanyName(text); // Update display text
    dispatch(setVisitingCompany(text as any));

    // Clear any previous timer
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set a new timer to call API after a delay (300ms)
    const timeout = setTimeout(() => {
      dispatch(fetchCompanies(text));
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
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };
  // Validate form fields
  // Validate form fields
  const validateFields = (): boolean => {
    if (!visitorName.trim()) {
      Alert.alert("Validation Error", "Please enter visitor name");
      return false;
    }
    if (!visitorMobile.trim()) {
      Alert.alert("Validation Error", "Please enter mobile number");
      return false;
    }

    // Modified company validation to handle both string and number values
    if (
      visitingCompany === null ||
      visitingCompany === undefined ||
      (typeof visitingCompany === "string" && visitingCompany.trim() === "") ||
      visitingCompany === 0 // In case it's storing 0 as a falsy value
    ) {
      Alert.alert("Validation Error", "Please select a company");
      return false;
    }
    return true;
  };

  // Handle Next button press
  const handleNext = () => {
    if (!validateFields()) return;
    // Do not insert into the database here.
    // The form data is stored in Redux and will be used in the camera screen.
    router.replace("/camera-screen");
  };
  // Make sure this function is being called when a company is selected from the dropdown
  const handleSelectCompany = (company: { label: string; value: any }) => {
    console.log("Selected company:", company);
    Keyboard.dismiss();
    setDisplayCompanyName(company.label);
    dispatch(
      selectCompany({
        label: company.label,
        value: String(company.value), // Ensure it's a string
      })
    );
    // Hide the dropdown immediately
    dispatch(setCompanyDropdownVisible(false));
  };

  const handleClearCompany = () => {
    setDisplayCompanyName(""); // Clear display text
    dispatch(clearVisitingCompany());
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
    router.replace("/checkin-screen");
  };

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={handleScreenPress}>
        <View
          style={[
            styles.borderContainer,
            { width: windowWidth, height: windowHeight + 52 },
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
                        <Text style={styles.modalTitle}>Confirm Cancel</Text>
                      </View>
                      <View style={styles.modalBody}>
                        <Text style={styles.modalTextCancel}>
                          Are you sure you want to cancel?
                        </Text>
                      </View>
                      <View style={styles.modalFooter}>
                        <TouchableOpacity
                          style={[styles.modalButton, styles.modalCancelButton]}
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
                        size={25}
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
                        Visitor Name*
                      </Text>
                    }
                    textColor="#03045E"
                    value={visitorName}
                    onChangeText={(text) => dispatch(setVisitorName(text))}
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
                          color="#03045E"
                          size={25}
                        />
                      ) : null
                    }
                    selectionColor="#03045E"
                  />
                </View>

                {/* Visitor Mobile Input */}
                <View style={styles.inputContainer}>
                  <PaperTextInput
                    left={
                      <PaperTextInput.Icon
                        icon="phone"
                        color="#03045E"
                        size={25}
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
                        Visitor Mobile*
                      </Text>
                    }
                    textColor="#03045E"
                    maxLength={10}
                    value={visitorMobile}
                    onChangeText={(text) => dispatch(setVisitorMobile(text))}
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
                          color="#03045E"
                          size={25}
                        />
                      ) : null
                    }
                    selectionColor="#03045E"
                  />
                </View>

                {/* Visiting Company Input with Dropdown */}
                <View style={styles.inputContainer}>
                  <PaperTextInput
                    left={
                      <PaperTextInput.Icon
                        icon="domain"
                        color="#03045E"
                        size={25}
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
                        Visiting Company Name*
                      </Text>
                    }
                    textColor="#03045E"
                    value={displayCompanyName}
                    onChangeText={handleCompanySearch}
                    onFocus={handleCompanyFocus}
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

                  {/* Company Dropdown */}
                  {showCompanyDropdown && filteredCompanies.length > 0 && (
                    <View style={styles.dropdownContainer}>
                      {isLoadingCompanies ? (
                        <View style={styles.loadingDropdown}>
                          <ActivityIndicator size="small" color="#03045E" />
                        </View>
                      ) : (
                        <FlatList
                          data={filteredCompanies}
                          keyExtractor={(item) => item.value}
                          keyboardShouldPersistTaps="handled"
                          style={styles.dropdownList}
                          nestedScrollEnabled={true}
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
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "white",
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

  headerText: {
    fontSize: 24,
    fontFamily: "OpenSans_Condensed-Bold",
    color: "#03045E",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "#FBFBFB",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "white",
    borderRadius: 10,
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
    borderWidth: 14,
    borderColor: "#03045E", // Sky blue color
    borderRadius: 10,
    overflow: "hidden",
  },
  inputContainer: {
    width: "96%",
    marginVertical: 12,
    position: "relative",
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 54,
    justifyContent: "space-between",
    width: "100%",
  },
  cancelButton: {
    backgroundColor: "transparent",
    paddingVertical: 5,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginLeft: 40,
  },
  submitButton: {
    backgroundColor: "transparent",
    paddingVertical: 5,
    paddingHorizontal: 5,
    marginRight: 40,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
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
    marginLeft: 15,
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
});
