import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  Dimensions,
  ToastAndroid,
  Platform,
  Alert,
  StatusBar,
  Animated,
  Modal,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  PhotoFile,
  CameraPermissionStatus,
} from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";
import {
  useFaceDetector,
  Face,
} from "react-native-vision-camera-face-detector";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname, useSegments } from "expo-router";
import {
  clearVisitingCompany,
  clearVisitorMobile,
  clearVisitorName,
  resetForm,
} from "../store/slices/visitorSlice";
import { AppDispatch, RootState } from "../store";
import { useDispatch, useSelector } from "react-redux";
import { convertPhotoToBase64 } from "@/src/utility/photoConvertor";
import { submitVisitor } from "../api/visitorForm";
import NextSvg from "@/src/utility/nextSvg";
import StarIcon from "@/src/utility/starIcon";
import CameraIcon from "@/src/utility/CameraSvg";
import ThankYou from "@/src/utility/ThankyouIcon";

const { width, height } = Dimensions.get("window");
const isTablet = width >= 768;
const FaceDetectionCamera: React.FC = () => {
  // States
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const {
    visitorName: visitorNameRedux,
    visitorMobile: visitorMobileRedux,
    visitingCompany: visitingCompanyRedux,
  } = useSelector((state: RootState) => state.visitor);

  const [countdown, setCountdown] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(false);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState<string | null>(
    null
  );
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTakingPicture, setIsTakingPicture] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const [isProcessingFrame, setIsProcessingFrame] = useState<boolean>(false);

  const [showCaptureIndicator, setShowCaptureIndicator] =
    useState<boolean>(false);

  // Refs
  const cameraRef = useRef<Camera | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTakenPhotoRef = useRef<boolean>(false);
  const photoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingLock = useRef<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const steadyFaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCaptureAgainDisabled, setIsCaptureAgainDisabled] = useState(false);

  const { detectFaces } = useFaceDetector({
    performanceMode: "fast",
    landmarkMode: "all",
  });
  const animateCountdown = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.5,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Camera setup
  const device = useCameraDevice("front");

  // Hide status bar
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  // Notify user about successful capture
  const notifyCapture = useCallback(() => {
    if (Platform.OS === "android") {
      ToastAndroid.show("Photo captured!", ToastAndroid.SHORT);
    } else {
      // For iOS, use in-app notification since there's no Toast
      setShowCaptureIndicator(true);
      setTimeout(() => setShowCaptureIndicator(false), 1500);
    }
  }, []);

  // Face detection callback - simplified and more reliable
  const onFaceDetected = useCallback(
    (faces: Face[]) => {
      if (hasTakenPhotoRef.current || isTakingPicture) return;

      // Debug: Log the first face structure if available
      if (faces.length > 0) {
        console.log(
          "Face detected, data:",
          JSON.stringify({
            hasLeftEye: !!faces[0].landmarks?.LEFT_EYE,
            hasRightEye: !!faces[0].landmarks?.RIGHT_EYE,
            leftEyeOpen: faces[0].leftEyeOpenProbability,
            rightEyeOpen: faces[0].rightEyeOpenProbability,
            bounds: faces[0].bounds,
            width: width,
            height: height,
          })
        );
      }

      // Simplify validation - just check if we have a face with reasonable size
      const validFace =
        faces.length > 0 &&
        faces.some((face) => {
          const faceWidth = face.bounds.width;
          const faceHeight = face.bounds.height;

          // Calculate the visible camera frame area
          const visibleHeight = height * 0.55; // 55% of screen height
          const visibleMinY = (height - visibleHeight) / 2; // Assuming centered
          const visibleMaxY = visibleMinY + visibleHeight;

          // Check if face is mostly within the visible frame
          const faceY = face.bounds.y;
          const faceBottomY = faceY + faceHeight;
          const faceInView =
            faceBottomY > visibleMinY &&
            faceY < visibleMaxY &&
            // At least 70% of face height should be in visible area
            Math.min(faceBottomY, visibleMaxY) - Math.max(faceY, visibleMinY) >
              faceHeight * 0.7;

          // Face should be at least 15% of visible area width/height for better validation
          const minFaceSize = Math.min(width, visibleHeight) * 0.15;

          return (
            faceWidth > minFaceSize && faceHeight > minFaceSize && faceInView
          );
        });
      // Update state only if detection status changed
      if (validFace !== isFaceDetected) {
        setIsFaceDetected(validFace);
        console.log(
          validFace ? "Face properly detected!" : "No valid face detected"
        );
      }

      // Handle photo capture with debounce
      if (validFace && !photoTimeoutRef.current) {
        photoTimeoutRef.current = setTimeout(() => {
          if (!hasTakenPhotoRef.current && !isTakingPicture) {
            takePicture();
          }
          photoTimeoutRef.current = null;
        }, 200); // Slightly shorter delay
      } else if (!validFace && photoTimeoutRef.current) {
        clearTimeout(photoTimeoutRef.current);
        photoTimeoutRef.current = null;
      }
    },
    [isFaceDetected, isTakingPicture]
  );

  // Create worklet functions
  const onFaceDetectedJS = Worklets.createRunOnJS(onFaceDetected);

  // Improved frame processor with better locking mechanism
  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";

    // Use ref-based lock instead of state to avoid race conditions
    if (processingLock.current) return;

    processingLock.current = true;

    try {
      const faces = detectFaces(frame);
      // This makes face disappearance detection much faster
      if (faces.length === 0) {
        onFaceDetectedJS([]);
      } else {
        onFaceDetectedJS(faces);
      }
    } catch (e) {
      // Silent catch to prevent crashes
      onFaceDetectedJS([]);
    } finally {
      processingLock.current = false;
    }
  }, []);

  // Request camera permissions
  useEffect(() => {
    const requestPermissions = async (): Promise<void> => {
      const cameraPermission: CameraPermissionStatus =
        await Camera.requestCameraPermission();
      setHasPermission(cameraPermission === "granted");
    };

    requestPermissions();

    return () => {
      // Clean up all timeouts
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (photoTimeoutRef.current) clearTimeout(photoTimeoutRef.current);
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    };
  }, []);

  // Handle the countdown separately
  useEffect(() => {
    if (countdown > 0) {
      timeoutRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
        animateCountdown(); // Trigger animation every time the countdown changes
      }, 1000);
    } else if (countdown === 0) {
      setShowCamera(true);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [countdown]);

  // Ensure proper cleanup of camera when unmounting
  useEffect(() => {
    return () => {
      // Explicitly release camera resources
      cameraRef.current = null;
      setShowCamera(false);

      // Clear all refs and timeouts
      hasTakenPhotoRef.current = false;
      processingLock.current = false;

      if (photoTimeoutRef.current) {
        clearTimeout(photoTimeoutRef.current);
        photoTimeoutRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
        captureTimeoutRef.current = null;
      }
    };
  }, []);

  // Take picture function with proper error handling
  const takePicture = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || isTakingPicture || hasTakenPhotoRef.current) {
      return;
    }

    try {
      // Lock state updates
      hasTakenPhotoRef.current = true;
      setIsTakingPicture(true);

      // Add flash effect
      setShowCaptureIndicator(true);

      // Short delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 50));

      const photo: PhotoFile = await cameraRef.current.takePhoto({
        flash: "off",
        enableShutterSound: false,
      });

      setCapturedPhoto(`file://${photo.path}`);
      console.log("captured pic", photo.path);
      notifyCapture();

      // Hide flash effect with slight delay
      setTimeout(() => setShowCaptureIndicator(false), 50);
    } catch (error) {
      console.error("Error taking picture:", error);
      hasTakenPhotoRef.current = false;

      if (Platform.OS === "android") {
        ToastAndroid.show("Failed to capture photo", ToastAndroid.SHORT);
      } else {
        Alert.alert("Error", "Failed to capture photo");
      }
    } finally {
      setIsTakingPicture(false);
    }
  }, [isTakingPicture, notifyCapture]);

  // Safely reset to capture again - improved for reliability
  const captureAgain = useCallback((): void => {
    if (isCaptureAgainDisabled) return;
    // Reset state in the correct order
    setCapturedPhoto(null);

    setIsCaptureAgainDisabled(true);

    // Small delay to ensure clean state before reactivating detection
    setTimeout(() => {
      hasTakenPhotoRef.current = false;
      setIsFaceDetected(false);
      setIsCaptureAgainDisabled(false); // Re-enable the button after delay
      processingLock.current = false;
    }, 300);
  }, []);

  const convertAndSubmit = async () => {
    setIsLoading(true);
    if (!capturedPhoto) {
      Alert.alert("Error", "No photo to submit");
      return;
    }

    try {
      setShowConfirmModal(false);

      // Prepare base64
      let base64String = capturedPhotoBase64;
      if (!base64String) {
        const result = await convertPhotoToBase64(capturedPhoto);
        base64String =
          typeof result === "string" ? result : result.image_base64;
      }

      const result = await submitVisitor(
        visitorNameRedux,
        visitorMobileRedux,
        Number(visitingCompanyRedux),
        base64String
      );

      // Reset the form state no matter what
      resetStates(true); // always reset UI inputs

      // Detect “offline stored” and treat it as success
      const offlineStored =
        !result.success && result.error?.includes("stored locally");

      if (result.success || offlineStored) {
        // Show thank you (even offline)
        setShowThankYouModal(true);
        setCapturedPhoto(null);

        setTimeout(() => {
          setShowThankYouModal(false);
          router.replace("/checkin-screen");
        }, 2000);
      } else {
        // A genuine failure—just navigate back so they can try again
        router.replace("/checkin-screen");
      }
    } catch (error) {
      Alert.alert(
        "Submit Failed",
        "Visitor check-in submission failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const resetStates = (clearRedux = false) => {
    setCapturedPhotoBase64(null);

    if (clearRedux) {
      dispatch(resetForm());
      dispatch(clearVisitorName());
      dispatch(clearVisitorMobile());
      dispatch(clearVisitingCompany());
    }
  };
  const confirmCancel = () => {
    setShowCancelModal(false);
    setShowThankYouModal(false);
    setShowConfirmModal(false);
    resetStates(true);
    setCapturedPhoto(null);
    setIsTakingPicture(false);
    setIsFaceDetected(false);
    setShowCamera(false);
    setCountdown(3);
    hasTakenPhotoRef.current = false;
    processingLock.current = false;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (photoTimeoutRef.current) clearTimeout(photoTimeoutRef.current);
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);

    timeoutRef.current = null;
    photoTimeoutRef.current = null;
    captureTimeoutRef.current = null;
    router.replace("/checkin-screen");
  };
  const handleConfirmSubmit = () => {
    convertAndSubmit();
  };

  // Loading or permission state
  if (hasPermission === null || countdown > 0) {
    return (
      <View style={styles.container}>
        {hasPermission === null ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownTitle}>Getting Ready</Text>
            <Text style={styles.countdownInstructions}>
              Please prepare to position your face
            </Text>
            <Animated.Text
              style={[
                styles.initialCountdownText,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              {countdown}
            </Animated.Text>
          </View>
        )}
      </View>
    );
  }

  // No permission state
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === "granted");
          }}
        >
          <Text style={styles.buttonText}>Request Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No device state
  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No camera device found</Text>
      </View>
    );
  }
  const getResponsiveSize = (baseSize: number) => {
    const scaleFactor = width / 375; // Standard iPhone width as base
    return baseSize * scaleFactor;
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EEF2F6" }}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {showCamera ? (
          <View style={styles.contentContainer}>
            {/* Camera Container */}
            <View style={styles.cameraContainer}>
              {!capturedPhoto ? (
                /* Camera View */
                <View style={styles.cameraFrameContainer}>
                  <View style={styles.cameraFrame}>
                    <Camera
                      ref={cameraRef}
                      style={styles.camera}
                      device={device}
                      photoQualityBalance="speed"
                      preview={true}
                      isActive={!capturedPhoto && showCamera}
                      pixelFormat="yuv"
                      photo={true}
                      frameProcessor={
                        !capturedPhoto ? frameProcessor : undefined
                      }
                    />

                    {/* Face detection overlay */}
                    {isFaceDetected ? (
                      // <View style={styles.holdSteadyContainer}>
                      <View
                        style={[
                          styles.holdSteadyBanner,
                          {
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0,0,0,0.5)", // Semi-transparent overlay
                          },
                        ]}
                      >
                        <Text style={styles.holdSteadyText}>Hold Steady</Text>
                      </View>
                    ) : (
                      // </View>
                      <View style={styles.noFaceDetectedBanner}>
                        <Text style={styles.noFaceDetectedText}>
                          No Face Detected
                        </Text>
                      </View>
                    )}

                    {/* Camera flash effect overlay */}
                    {/* {showCaptureIndicator && (
                      <View style={styles.captureFlash} />
                    )} */}

                    {/* Taking photo indicator */}
                    {/* {isTakingPicture && (
                      <View style={styles.takingPhotoIndicator}>
                        <ActivityIndicator size="large" color="#fafafa" />
                        <Text style={styles.savingText}>Saving photo...</Text>
                      </View>
                    )} */}
                  </View>
                </View>
              ) : (
                /* Preview image with capture banner */
                <View style={styles.cameraFrameContainer}>
                  <View style={styles.cameraFrame}>
                    <Image
                      source={{ uri: capturedPhoto }}
                      style={styles.preview}
                      resizeMode="cover"
                    />
                    <View style={styles.photoCaptureOverlay}>
                      <Text style={styles.photoCaptureText}>
                        Photo Captured!
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Controls and instructions section */}
            <View style={styles.controlsContainer}>
              {capturedPhoto ? (
                <>
                  {/* Submit/Cancel buttons */}
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.cancelButton,
                        {
                          width: "50%",
                          height: getResponsiveSize(40),
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                        },
                      ]}
                      onPress={handleCancel}
                    >
                      {/* <View style={styles.buttonContent}>  */}
                      {/* <Ionicons name="close-circle" size={22} color="#03045E" /> */}
                      <StarIcon />
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                      {/* </View> */}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        {
                          width: "50%",
                          height: getResponsiveSize(40),
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                        },
                      ]}
                      onPress={() => setShowConfirmModal(true)}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#fafafa" />
                      ) : (
                        //   <View style={styles.buttonContent}>
                        <>
                          <Text style={styles.submitButtonText}>Submit</Text>
                          {/* <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color="#fafafa"
                          /> */}
                          <NextSvg />
                        </>
                        //   </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Capture Again button */}
                  <View style={styles.footerContainer}>
                    <TouchableOpacity
                      style={styles.captureAgainButton}
                      onPress={captureAgain}
                      disabled={isCaptureAgainDisabled}
                    >
                      <View style={styles.captureAgainContent}>
                        {/* <Ionicons name="camera" size={22} color="#fafafa" /> */}
                        <CameraIcon />
                        <Text style={styles.captureAgainText}>
                          Capture Again
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* Instruction text */
                <View style={styles.instructionsContainer}>
                  <Text style={styles.instructionText}>
                    {isFaceDetected
                      ? "Hold still while we capture your photo"
                      : "Center your face in the frame"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.container}>
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        )}

        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Submission</Text>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalText}>
                  Are you sure you want to submit this photo?
                </Text>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleConfirmSubmit}
                >
                  <Text style={styles.modalConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showCancelModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeaderCancel}>
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
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={confirmCancel}
                >
                  <Text style={styles.modalConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={showThankYouModal}
          transparent={false} // Full screen modal, no transparency
          animationType="slide" // Slide in animation
        >
          <View style={styles.fullScreenModal}>
            {/* <Image
              source={require("../../assets/thankyou.png")} // Replace with your image source
              style={styles.fullScreenImage}
              resizeMode="cover"
            /> */}
            <ThankYou />
          </View>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEF2F6",
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#EEF2F6",
  },
  cameraContainer: {
    height: "55%",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  cameraFrameContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: 250,
    height: 250,
  },
  cameraFrame: {
    width: "80%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "#30345E",
    borderRadius: 20,
    elevation: 3,
    overflow: "hidden",
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  controlsContainer: {
    flex: 1,
    paddingHorizontal: 40,
    backgroundColor: "transparent",
    paddingBottom: 30,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    flexDirection: "column",
    justifyContent: "space-between",
    shadowRadius: 1.41,
  },
  holdSteadyContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF2F6",
    zIndex: 2,
  },
  holdSteadyBanner: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",

    zIndex: 2,
  },
  holdSteadyText: {
    color: "white",
    fontSize: 15,
    fontFamily: "OpenSans_Condensed-SemiBold",
    backgroundColor: "rgba(0,100,0,0.4)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 15,
    marginBottom: 15,
    overflow: "hidden",
  },
  savingText: {
    color: "white",
    fontSize: 15,
    fontFamily: "OpenSans_Condensed-SemiBold",

    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 15,
    marginBottom: 15,
    overflow: "hidden",
  },
  photoCaptureOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  photoCaptureBar: {},
  photoCaptureText: {
    color: "#fafafa",
    fontSize: 18,
    fontFamily: "OpenSans_Condensed-Bold",
    backgroundColor: "rgba(0,150,0,0.3)",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 15,
    overflow: "hidden",
  },
  takingPhotoIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 3,
  },
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FAFAFA",
    opacity: 0.5,
    zIndex: 3,
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center", // Center buttons horizontally
    alignItems: "center", // Align buttons vertically
    width: "100%",
    gap: 20,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderColor: "#03045E",
    borderWidth: 2,
    padding: 7,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  cancelButtonText: {
    color: "#03045E",
    fontSize: isTablet ? 20 : 14,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  submitButton: {
    backgroundColor: "#03045E",
    padding: 8,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  footerContainer: {
    width: "100%",
    marginTop: "auto",
  },
  submitButtonText: {
    color: "white",
    fontSize: isTablet ? 20 : 14,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  captureAgainButton: {
    backgroundColor: "#03045E",
    borderRadius: 10,
    width: "100%",
    height: 40,
    alignItems: "center",
    marginTop: "auto",
    justifyContent: "center",
  },
  captureAgainContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  captureAgainText: {
    color: "#FAFAFA",
    fontFamily: "OpenSans_Condensed-SemiBold",
    fontSize: 14,
    marginLeft: 10,
  },
  countdownText: {
    fontSize: 60,
    fontWeight: "bold",
    color: "#2196F3",
  },
  text: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  instructionsContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    color: "#001973", // Dark blue
  },
  button: {
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
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
    backgroundColor: "#03045E",
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  modalHeaderCancel: {
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
  modalText: {
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
  thankYouModalBody: {
    padding: 30,
    alignItems: "center",
  },
  thankYouTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_Condensed-Bold",
    color: "#03045E",
    marginVertical: 15,
  },
  thankYouText: {
    fontSize: 16,
    color: "#03045E",
    textAlign: "center",
    fontFamily: "OpenSans_Condensed-Regular",
  },
  modalTextCancel: {
    fontSize: 16,
    color: "#03045E",
    textAlign: "center",
    fontFamily: "OpenSans_Condensed-Regular",
  },
  countdownOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF2F6",
  },
  countdownTitle: {
    fontSize: 30,
    fontFamily: "OpenSans_Condensed-Bold",
    color: "#03045E",
    marginBottom: 10,
  },
  countdownInstructions: {
    fontSize: 18,
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  initialCountdownText: {
    fontSize: 80,
    fontFamily: "OpenSans_Condensed-Bold",
    color: "#03045E",
  },
  captureCountdownText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 10,
  },
  noFaceDetectedBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 0, 0, 0.3)", // Semi-transparent red overlay
    justifyContent: "center",
    alignItems: "center",
  },
  noFaceDetectedText: {
    color: "white",
    fontSize: 15,
    fontFamily: "OpenSans_Condensed-Bold",
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
});

export default FaceDetectionCamera;
