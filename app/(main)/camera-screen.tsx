import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Modal,
  Alert,
  Dimensions,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  PhotoFile,
} from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { convertPhotoToBase64 } from "@/src/utility/photoConvertor";
import { useSelector, useDispatch } from "react-redux";
import {
  selectVisitorName,
  selectVisitorMobile,
  selectVisitingCompany,
  resetForm,
  clearVisitorName,
  clearVisitorMobile,
  clearVisitingCompany,
} from "../store/slices/visitorSlice";
import { submitVisitor } from "../api/visitorForm";
import { AppDispatch, RootState } from "../store";

interface Face {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pitchAngle: number;
  rollAngle: number;
  yawAngle: number;
}

type Props = {};

const CameraScreen = (props: Props) => {
  const router = useRouter();
  const {
    visitorName: visitorNameRedux,
    visitorMobile: visitorMobileRedux,
    visitingCompany: visitingCompanyRedux,
  } = useSelector((state: RootState) => state.visitor);
  const dispatch = useDispatch<AppDispatch>();

  // Camera refs and states
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice("front");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraKey, setCameraKey] = useState<number>(0);

  // Performance optimized state
  const [faces, setFaces] = useState<Face[]>([]);
  const [previewDimensions, setPreviewDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Flow states
  const [showInitialCountdown, setShowInitialCountdown] = useState(true);
  const [initialCountdown, setInitialCountdown] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState<string | null>(
    null
  );
  const [cameraActive, setCameraActive] = useState(false);

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Refs for performance optimization
  const countdownInProgressRef = useRef<boolean>(false);
  const frameProcessorEnabledRef = useRef<boolean>(true);
  const faceCaptureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const faceDetectedRef = useRef<boolean>(false);
  const lastProcessedTimestamp = useRef<number>(0);
  const FRAME_PROCESS_INTERVAL = 1000; // Only process frames every 500ms

  // Request camera permissions on mount and start initial countdown
  useEffect(() => {
    const requestPermission = async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === "granted");
    };

    requestPermission();

    // Start the initial countdown to prepare the user
    const initialCountdownInterval = setInterval(() => {
      setInitialCountdown((prev) => {
        const newCount = prev - 1;

        // When countdown reaches 0, show camera view
        if (newCount <= 0) {
          clearInterval(initialCountdownInterval);
          setShowInitialCountdown(false);
          setCameraActive(true);
          setIsReady(true);
          return 0;
        }

        return newCount;
      });

      // Animate countdown number
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
    }, 1000);

    StatusBar.setHidden(true, "none");
    return () => {
      StatusBar.setHidden(false, "none");
      clearInterval(initialCountdownInterval);
      if (faceCaptureTimerRef.current) {
        clearTimeout(faceCaptureTimerRef.current);
      }
      // Clean up any resources
      frameProcessorEnabledRef.current = false;
    };
  }, []);

  // Face detection handler with throttling
  const { detectFaces } = useFaceDetector();

  const handleDetectedFaces = Worklets.createRunOnJS((newFaces: Face[]) => {
    // Skip if already processing or photo captured
    if (isProcessing || capturedPhotoUri || !frameProcessorEnabledRef.current)
      return;

    setFaces(newFaces || []);

    // If face is detected and no capture is in progress yet
    if (
      newFaces.length > 0 &&
      !faceDetectedRef.current &&
      !countdownInProgressRef.current
    ) {
      faceDetectedRef.current = true;

      // Wait 2 seconds before capturing photo
      if (!faceCaptureTimerRef.current) {
        faceCaptureTimerRef.current = setTimeout(() => {
          takePhoto();
          faceCaptureTimerRef.current = null;
        }, 1000);
      }
    } else if (newFaces.length === 0) {
      // Reset face detection state if face disappears
      faceDetectedRef.current = false;
      if (faceCaptureTimerRef.current) {
        clearTimeout(faceCaptureTimerRef.current);
        faceCaptureTimerRef.current = null;
      }
    }
  });

  // Memoize face boxes to prevent unnecessary re-renders
  const renderFaceBoxes = useMemo(() => {
    return faces.map((face, index) => (
      <View
        key={index}
        style={[
          styles.faceBox,
          {
            left: face.bounds.x,
            top: face.bounds.y,
            width: face.bounds.width,
            height: face.bounds.height,
          },
        ]}
      />
    ));
  }, [faces]);

  // Optimized frame processor with throttling
  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      // Early return with simpler condition check
      if (!frameProcessorEnabledRef.current || !cameraActive) return;

      // Throttle processing more efficiently
      const now = Date.now();
      if (now - lastProcessedTimestamp.current < FRAME_PROCESS_INTERVAL) return;
      lastProcessedTimestamp.current = now;

      try {
        const detectedFaces = detectFaces(frame);

        // Only process if we have valid dimensions and faces
        if (
          detectedFaces?.length &&
          previewDimensions.width > 0 &&
          previewDimensions.height > 0
        ) {
          // Scale faces more efficiently
          const scaledFaces = detectedFaces.map((face) => ({
            bounds: {
              x: face.bounds.x * previewDimensions.width,
              y: face.bounds.y * previewDimensions.height,
              width: face.bounds.width * previewDimensions.width,
              height: face.bounds.height * previewDimensions.height,
            },
            // Only include angles if they're actually used elsewhere
            pitchAngle: face.pitchAngle,
            rollAngle: face.rollAngle,
            yawAngle: face.yawAngle,
          }));

          handleDetectedFaces(scaledFaces);
        } else if (detectedFaces?.length === 0) {
          // Clear faces if none detected
          handleDetectedFaces([]);
        }
      } catch (error) {
        // Silent catch to prevent crashes
      }
    },
    [
      detectFaces,
      previewDimensions.width,
      previewDimensions.height,
      cameraActive,
    ]
  );

  // Optimized photo capture
  // In your takePhoto function, add an extra check:
  // Improve takePhoto function with better error handling and state management
  const takePhoto = async () => {
    // Prevent multiple capture attempts
    if (isProcessing || capturedPhotoUri) {
      console.log("Already processing or photo already captured");
      return;
    }

    // Disable further frame processing
    frameProcessorEnabledRef.current = false;
    setIsProcessing(true);

    try {
      // More robust camera reference check
      if (!cameraRef.current || !cameraActive) {
        throw new Error("Camera is not ready");
      }

      // Give the camera time to stabilize if a face was just detected
      await new Promise((resolve) => setTimeout(resolve, 500));

      const photo = await cameraRef.current.takePhoto({
        flash: "off",
      });

      if (!photo || !photo.path) {
        throw new Error("Photo path is undefined");
      }

      const fileUri = photo.path.startsWith("file://")
        ? photo.path
        : `file://${photo.path}`;

      setCapturedPhotoUri(fileUri);
    } catch (error: any) {
      console.error("Photo capture error:", error);
      Alert.alert(
        "Photo Error",
        `Failed to capture photo: ${error.message || "Unknown error"}`,
        [{ text: "Try Again", onPress: resetCamera }]
      );
      resetCamera();
    } finally {
      setIsProcessing(false);

      // Clear any pending face detection timers
      if (faceCaptureTimerRef.current) {
        clearTimeout(faceCaptureTimerRef.current);
        faceCaptureTimerRef.current = null;
      }
    }
  };

  // Reset camera capture state
  const resetCaptureState = () => {
    faceDetectedRef.current = false;
    countdownInProgressRef.current = false;
    frameProcessorEnabledRef.current = true;
    setIsProcessing(false);
    if (faceCaptureTimerRef.current) {
      clearTimeout(faceCaptureTimerRef.current);
      faceCaptureTimerRef.current = null;
    }
  };

  // Convert photo to base64 only when needed (at submission time)
  // Modify your convertAndSubmit function with the correct navigation syntax
  const convertAndSubmit = async () => {
    // Prevent any pending takePhoto calls
    if (faceCaptureTimerRef.current) {
      clearTimeout(faceCaptureTimerRef.current);
      faceCaptureTimerRef.current = null;
    }
    frameProcessorEnabledRef.current = false;
    setIsProcessing(true);

    try {
      if (!capturedPhotoUri) {
        Alert.alert("No Photo", "Please capture a photo before submitting.");
        setIsProcessing(false);
        return;
      }

      setShowConfirmModal(false);

      let base64String = capturedPhotoBase64;
      if (!base64String) {
        const result = await convertPhotoToBase64(capturedPhotoUri);
        base64String =
          typeof result === "string" ? result : result.image_base64;
      }

      const result = await submitVisitor(
        visitorNameRedux,
        visitorMobileRedux,
        Number(visitingCompanyRedux),
        base64String
      );

      // Important: Reset states BEFORE navigation
      resetStates(result.success);

      if (result.success) {
        // Show thank you modal
        setShowThankYouModal(true);

        // Clear camera-related states
        setCameraActive(false);
        setCapturedPhotoUri(null);

        // Navigate after a delay, but ensure we don't process anything else
        setTimeout(() => {
          setShowThankYouModal(false);
          // For React Navigation, use the correct syntax
          router.replace("/checkin-screen");
        }, 2000);
      } else {
        // Immediate navigation on failure
        router.replace("/checkin-screen");
      }
    } catch (error) {
      Alert.alert(
        "Submit Failed",
        "Visitor check-in submission failed. Please try again."
      );
      setIsProcessing(false);
    }
  };

  // Reset camera for retaking photo
  const resetCamera = () => {
    setCapturedPhotoUri(null);
    setCapturedPhotoBase64(null);
    setCountdown(null);
    resetCaptureState();

    // Force camera component to re-mount
    setCameraKey((prev) => prev + 1);

    // Short delay before re-enabling camera
    setTimeout(() => {
      setCameraActive(true);
      frameProcessorEnabledRef.current = true;
    }, 500);
  };

  // Reset all states (used after successful submission)
  const resetStates = (clearRedux = false) => {
    setIsProcessing(false);
    setCapturedPhotoUri(null);
    setCapturedPhotoBase64(null);
    setCountdown(null);
    setCameraActive(false); // Ensure camera is turned off
    frameProcessorEnabledRef.current = false; // Prevent frame processing

    // Clear detection states
    faceDetectedRef.current = false;
    countdownInProgressRef.current = false;

    // Clean up timers
    if (faceCaptureTimerRef.current) {
      clearTimeout(faceCaptureTimerRef.current);
      faceCaptureTimerRef.current = null;
    }

    if (clearRedux) {
      dispatch(resetForm());
      dispatch(clearVisitorName());
      dispatch(clearVisitorMobile());
      dispatch(clearVisitingCompany());
    }
  };

  // Also update your useEffect cleanup to ensure it handles all resources
  useEffect(() => {
    // ... existing setup code ...

    return () => {
      StatusBar.setHidden(false, "none");
      // Clear all timers
      if (faceCaptureTimerRef.current) {
        clearTimeout(faceCaptureTimerRef.current);
        faceCaptureTimerRef.current = null;
      }

      // Disable processing
      frameProcessorEnabledRef.current = false;

      // Reset camera state
      setCameraActive(false);
    };
  }, []);

  // Handle cancel button press
  const handleCancel = () => {
    setShowCancelModal(true);
  };

  // Confirm cancellation and navigate away
  const confirmCancel = () => {
    setShowCancelModal(false);
    resetStates(true);
    router.replace("/checkin-screen");
  };

  // Handle confirm submission button press
  const handleConfirmSubmit = () => {
    convertAndSubmit();
  };

  // Loading and error states
  if (hasPermission === null) {
    return (
      <View style={styles.loadingContainer1}>
        <ActivityIndicator size="large" color="#03045E" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.instructionText}>
          Camera permission is required to use this feature.
        </Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.instructionText}>No camera device found</Text>
      </View>
    );
  }

  // Initial countdown screen
  if (showInitialCountdown) {
    return (
      <View style={styles.container}>
        <View style={styles.countdownContainer}>
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
            {initialCountdown}
          </Animated.Text>
        </View>
      </View>
    );
  }

  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.borderContainer,
          { width: windowWidth, height: windowHeight + 52 },
        ]}
      >
        {/* Header with retry button when photo is captured */}
        {capturedPhotoUri && (
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.retryButton} onPress={resetCamera}>
              <Ionicons name="refresh-outline" size={22} color="#03045E" />
              <Text style={styles.retryText}>Capture Again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={styles.cameraWrapper}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewDimensions({ width, height });
          }}
        >
          {!capturedPhotoUri ? (
            <Animated.View
              style={{ opacity: fadeAnim, width: "100%", height: "100%" }}
            >
              <Camera
                key={cameraKey}
                ref={cameraRef}
                style={styles.camera}
                photoQualityBalance="speed"
                pixelFormat="yuv"
                device={device}
                isActive={cameraActive && !capturedPhotoUri}
                frameProcessor={
                  cameraActive &&
                  !capturedPhotoUri &&
                  frameProcessorEnabledRef.current
                    ? frameProcessor
                    : undefined
                }
                photo={true}
              />

              {/* Face boxes - only render when needed */}
              {!isProcessing &&
                !capturedPhotoUri &&
                frameProcessorEnabledRef.current &&
                renderFaceBoxes}

              {/* Face detection status messages */}
              {faces.length === 0 && !isProcessing && !capturedPhotoUri ? (
                <View style={styles.noFaceDetected}>
                  <Text style={styles.noFaceText}>No Face Detected</Text>
                  <Text style={styles.instructionText}>
                    Please position your face in the frame
                  </Text>
                </View>
              ) : faces.length > 0 &&
                faceDetectedRef.current &&
                !isProcessing &&
                !capturedPhotoUri ? (
                /* Face detected - hold steady message */
                <View style={styles.countdownOverlay}>
                  <Text style={styles.steadyText}>Hold Steady</Text>
                </View>
              ) : null}
            </Animated.View>
          ) : (
            /* Captured photo display */
            <View style={styles.capturedPhotoContainer}>
              <Image
                source={{ uri: capturedPhotoUri }}
                style={styles.capturedImage}
              />

              <View style={styles.captureSuccessOverlay}>
                <Text style={styles.captureSuccessText}>Photo Captured!</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom section with submit/cancel buttons */}
        <View style={styles.bottomSection}>
          {capturedPhotoUri ? (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isProcessing}
              >
                <Ionicons name="close-circle-outline" size={40} color="red" />
                <Text style={styles.buttonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => setShowConfirmModal(true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={40}
                      color="#03045E"
                    />
                    <Text style={styles.buttonText}>Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.instructionText}>
              {faces.length > 0
                ? faceDetectedRef.current
                  ? "Please hold still..."
                  : "Ready to capture!"
                : "Center your face in the frame"}
            </Text>
          )}
        </View>

        {/* Modals - unchanged */}
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
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.thankYouModalBody}>
                <Ionicons
                  name="checkmark-circle"
                  size={64}
                  color="#00A86B"
                  style={styles.modalIcon}
                />
                <Text style={styles.thankYouTitle}>Thank You!</Text>
                <Text style={styles.thankYouText}>
                  Your visit has been registered successfully.
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  borderContainer: {
    borderWidth: 14,
    borderColor: "#03045E", // Sky blue color
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF2F6",
  },
  headerContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 19,
    marginBottom: 15,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#03045E",
  },
  retryText: {
    color: "#03045E",
    fontFamily: "OpenSans_Condensed-SemiBold",
    fontSize: 14,
    marginLeft: 5,
  },
  headerText: {
    fontSize: 24,
    fontFamily: "OpenSans_Condensed-Bold",
    color: "#03045E",
    marginBottom: 20,
  },
  debugOverlay: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 5,
    zIndex: 9999,
  },
  debugText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "monospace",
  },
  cameraWrapper: {
    width: "90%",
    height: "40%",
    overflow: "hidden",
    borderRadius: 20,
    borderColor: "#03045E",
    borderWidth: 2,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  faceBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#00FF00",
    borderRadius: 10,
    borderStyle: "dashed",
  },
  noFaceDetected: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,0,0,0.3)",
  },
  noFaceText: {
    color: "white",
    fontSize: 18,
    fontFamily: "OpenSans_Condensed-Bold",
    textAlign: "center",
    backgroundColor: "rgba(255,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 5,
  },
  countdownOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,100,0,0.2)",
  },
  steadyText: {
    color: "white",
    fontSize: 15,
    fontFamily: "OpenSans_Condensed-SemiBold",
    backgroundColor: "rgba(0,100,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 15,
    marginBottom: 15,
    overflow: "hidden",
  },
  loadingContainer1: {
    ...StyleSheet.absoluteFillObject, // Fills the entire screen
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  countdownText: {
    color: "white",
    fontSize: 60,
    fontFamily: "OpenSans_Condensed-Bold",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  instructionText: {
    color: "#03045E",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 10,
    fontFamily: "OpenSans_Condensed-SemiBold",
  },
  bottomSection: {
    marginTop: 20,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "transparent",
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  capturedPhotoContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  capturedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  captureSuccessOverlay: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureSuccessText: {
    color: "white",
    fontSize: 18,
    fontFamily: "OpenSans_Condensed-Bold",
    backgroundColor: "rgba(0,150,0,0.8)",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 25,
    overflow: "hidden",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "98%",
  },
  cancelButton: {
    backgroundColor: "transparent",
    paddingVertical: 5,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginLeft: 10,
  },
  submitButton: {
    backgroundColor: "transparent",
    paddingVertical: 5,
    paddingHorizontal: 5,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonText: {
    color: "#03045E",
    fontSize: 17,
    fontFamily: "OpenSans_Condensed-Bold",
    marginLeft: 15,
  },
  buttonTextCancel: {
    color: "red",
    fontSize: 17,
    fontFamily: "OpenSans_Condensed-Bold",
    marginLeft: 8,
  },
  // Modal styles
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
  countdownContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  countdownTitle: {
    fontSize: 24,
    fontWeight: "bold",
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
    fontWeight: "bold",
    color: "#03045E",
  },
  captureCountdownText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 10,
  },
});

export default CameraScreen;
