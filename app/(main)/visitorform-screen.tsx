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
} from "react-native";
import { useRouter } from "expo-router";
import { TextInput as PaperTextInput } from "react-native-paper";

import Ionicons from "@expo/vector-icons/Ionicons";

export default function VisitorFormScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const responsiveFontSize = 18 / fontScale;
  const scrollViewRef = useRef<ScrollView>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // State for form fields
  const [visitorName, setVisitorName] = useState("");
  const [visitorMobile, setVisitorMobile] = useState("");
  const [visitingCompany, setVisitingCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Sample company data (will be replaced with API data)
  const [companies, setCompanies] = useState([
    { label: "Company A", value: "companyA" },
    { label: "Company B", value: "companyB" },
    { label: "Company C", value: "companyC" },
    { label: "Tech Solutions", value: "techSolutions" },
    { label: "Digital Innovations", value: "digitalInnovations" },
    { label: "Global Systems", value: "globalSystems" },
    { label: "Smart Technologies", value: "smartTech" },
    { label: "Future Enterprises", value: "futureEnterprises" },
    { label: "Innovative Labs", value: "innovativeLabs" },
    { label: "Peak Performance", value: "peakPerformance" },
  ]);

  // Function to handle typing in company field and filter results
  const handleCompanySearch = (text: string) => {
    setVisitingCompany(text);

    // This is where you'd typically call your API
    // For now, we'll simulate API behavior by filtering local data
    setIsLoadingCompanies(true);

    // Simulate network delay
    setTimeout(() => {
      if (text.trim() === "") {
        setFilteredCompanies([]);
      } else {
        const filtered = companies.filter((company) =>
          company.label.toLowerCase().includes(text.toLowerCase())
        );
        setFilteredCompanies(filtered);
      }
      setIsLoadingCompanies(false);
    }, 300);
  };

  // Function to select a company from dropdown
  const selectCompany = (company: { label: string; value: string }) => {
    setVisitingCompany(company.label);
    setShowCompanyDropdown(false);
  };

  // Keyboard listeners to adjust scroll position
  // useEffect(() => {
  //   const keyboardDidShowListener = Keyboard.addListener(
  //     "keyboardDidShow",
  //     () => {
  //       setKeyboardVisible(true);
  //       // Scroll down to make sure dropdown is visible
  //       if (scrollViewRef.current) {
  //         setTimeout(() => {
  //           scrollViewRef.current?.scrollToEnd({ animated: true });
  //         }, 100);
  //       }
  //     }
  //   );
  //   const keyboardDidHideListener = Keyboard.addListener(
  //     "keyboardDidHide",
  //     () => {
  //       setKeyboardVisible(false);
  //     }
  //   );
  //   // Clean up listeners when component unmounts
  //   return () => {
  //     keyboardDidShowListener.remove();
  //     keyboardDidHideListener.remove();
  //   };
  // }, []);
  useEffect(() => {
    StatusBar.setHidden(true, "none");

    // Clean up when component unmounts
    return () => {
      StatusBar.setHidden(false, "none");
    };
  }, []);

  // When company field gets focus, scroll to it
  const handleCompanyFocus = () => {
    setShowCompanyDropdown(true);
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

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
    setFilteredCompanies([]);
  };

  const handleClearName = (): void => {
    setVisitorName("");
  };

  const handleScreenPress = () => {
    Keyboard.dismiss();
    setShowCompanyDropdown(false);
  };

  const handleClearMobile = (): void => {
    setVisitorMobile("");
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    console.log("DEBUG: Canceling and navigating to check-in screen");
    router.replace("/checkin-screen");
    // Add logic for cancellation (e.g., navigate back or clear form)
  };

  const handleCancel = () => {
    setShowCancelModal(true);
    console.log("DEBUG: Canceling and navigating to check-in screen");
  };

  // Function that will later be used to fetch companies from API
  const fetchCompaniesFromAPI = async (searchText: string) => {
    // This is a placeholder for your actual API implementation
    try {
      // Example API call:
      // const response = await fetch(`your-api-endpoint?search=${searchText}`);
      // const data = await response.json();
      // setFilteredCompanies(data.map(item => ({ label: item.name, value: item.id })));

      // For now, we're using the simulated data in handleCompanySearch
      console.log("Will fetch companies with search term:", searchText);
    } catch (error) {
      console.error("Error fetching companies:", error);
      // Handle error appropriately
    }
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
                    onChangeText={setVisitorName}
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
                    value={visitorMobile}
                    onChangeText={setVisitorMobile}
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
                    value={visitingCompany}
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
                      visitingCompany ? (
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
                              onPress={() => selectCompany(item)}
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
                  <View style={{ height: 200 }} />
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
