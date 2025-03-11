import React, { useRef, useEffect, useState } from "react";
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
  const [faces, setFaces] = useState<Face[]>([]);
  const device = useCameraDevice("front");
  const cameraRef = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState({
    width: 0,
    height: 0,
  });

  // New states for countdown and photo capture
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<PhotoFile | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  // Debug state to track events
  const [debugMsg, setDebugMsg] = useState<string>("");

  // Ref to track if a countdown is already in progress
  const countdownInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    StatusBar.setHidden(true, "none");

    // Clean up when component unmounts
    return () => {
      StatusBar.setHidden(false, "none");
    };
  }, []);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === "granted");
      console.log("Camera permission status:", status);
    })();
  }, []);

  const { detectFaces } = useFaceDetector();

  const handleDetectedFaces = Worklets.createRunOnJS((newFaces: Face[]) => {
    setFaces(newFaces || []);

    // If we have faces and no countdown is in progress, start it
    if (
      newFaces.length > 0 &&
      !countdownInProgressRef.current &&
      !capturedPhoto
    ) {
      console.log("DEBUG: Face detected, starting countdown");
      setDebugMsg("Face detected - starting countdown");
      startCountdown();
    }
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      const detectedFaces = detectFaces(frame) as Face[];

      if (previewDimensions.width === 0 || previewDimensions.height === 0) {
        handleDetectedFaces(detectedFaces);
        return;
      }

      // Map normalized coordinates to preview layout
      const scaledFaces = detectedFaces.map((face) => ({
        bounds: {
          x: face.bounds.x * previewDimensions.width,
          y: face.bounds.y * previewDimensions.height,
          width: face.bounds.width * previewDimensions.width,
          height: face.bounds.height * previewDimensions.height,
        },
        pitchAngle: face.pitchAngle,
        rollAngle: face.rollAngle,
        yawAngle: face.yawAngle,
      }));

      handleDetectedFaces(scaledFaces);
    },
    [detectFaces, previewDimensions.width, previewDimensions.height]
  );

  // Simple function to start the countdown
  const startCountdown = () => {
    // Only start if not already in progress
    if (countdownInProgressRef.current || capturedPhoto) return;

    countdownInProgressRef.current = true;
    setCountdown(3);

    // Create a countdown sequence that doesn't depend on face detection
    const startTime = Date.now();

    const runCountdown = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const newCount = 3 - elapsedSeconds;

      if (newCount <= 0) {
        // Take photo when countdown reaches 0
        setCountdown(0);
        setDebugMsg("Taking photo");
        console.log("DEBUG: Countdown complete, taking photo");
        takePhoto();
      } else {
        // Update countdown
        setCountdown(newCount);
        setDebugMsg(`Counting: ${newCount}`);
        console.log(`DEBUG: Countdown at ${newCount}`);

        // Animate countdown number
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start();

        // Continue countdown
        setTimeout(runCountdown, 1000);
      }
    };

    // Start the countdown
    runCountdown();
  };

  // Function to capture photo
  const takePhoto = async () => {
    console.log("DEBUG: takePhoto function called");
    setIsProcessing(true);

    if (cameraRef.current) {
      try {
        console.log("DEBUG: Attempting to take photo");
        setDebugMsg("Taking photo...");

        const photo = await cameraRef.current.takePhoto({
          flash: "off",
        });

        console.log("DEBUG: Photo taken successfully", photo.path);
        setDebugMsg("Photo captured");
        setCapturedPhoto(photo);

        // Animate photo capture with a flash effect
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        setIsProcessing(false);
      } catch (error) {
        console.error("DEBUG: Failed to take photo:", error);
        setDebugMsg(`Photo error: ${error}`);
        // Show error to user
        Alert.alert(
          "Photo Error",
          "Failed to capture photo. Please try again.",
          [{ text: "OK", onPress: resetCamera }]
        );
        // Reset countdown status to allow retrying
        countdownInProgressRef.current = false;
        setIsProcessing(false);
      }
    } else {
      console.log("DEBUG: Camera ref is null");
      setDebugMsg("Camera not ready");
      // Reset countdown status to allow retrying
      countdownInProgressRef.current = false;
      setIsProcessing(false);
    }
  };

  // Function to reset and take another photo
  const resetCamera = () => {
    console.log("DEBUG: Resetting camera");
    setDebugMsg("Reset camera");
    setCapturedPhoto(null);
    setCountdown(null);
    countdownInProgressRef.current = false;
  };

  // Function to handle the cancel action
  const handleCancel = () => {
    setShowCancelModal(true);
    console.log("DEBUG: Canceling and navigating to check-in screen");
  };

  // Function to handle the confirm submission
  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    setIsProcessing(true);

    // Simulate submission process
    setTimeout(() => {
      setIsProcessing(false);
      setShowThankYouModal(true);

      // Automatically redirect after showing thank you message
      setTimeout(() => {
        setShowThankYouModal(false);
        router.replace("/checkin-screen");
      }, 2000);
    }, 1500);
  };

  if (!hasPermission) {
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
  const confirmCancel = () => {
    setShowCancelModal(false);
    console.log("DEBUG: Canceling and navigating to check-in screen");
    router.replace("/checkin-screen");
    // Add logic for cancellation (e.g., navigate back or clear form)
  };

  // const [fontsLoaded] = useFonts({
  //   "OpenSans_Condensed-Bold": require("../../assets/fonts/OpenSans_Condensed-Bold.ttf"),
  //   "OpenSans_Condensed-Regular": require("../../assets/fonts/OpenSans_Condensed-Regular.ttf"),
  //   "OpenSans_Condensed-SemiBold": require("../../assets/fonts/OpenSans_Condensed-SemiBold.ttf"),
  // });

  // if (!fontsLoaded) {
  //   return (
  //     <View style={styles.loadingContainer}>
  //       <ActivityIndicator size="large" color="#03045E" />
  //     </View>
  //   );
  // }
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
        {capturedPhoto && (
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.retryButton} onPress={resetCamera}>
              <Ionicons name="refresh-outline" size={22} color="#03045E" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={styles.cameraWrapper}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewDimensions({ width, height });
            console.log(
              `DEBUG: Camera preview dimensions set: ${width}x${height}`
            );
          }}
        >
          {!capturedPhoto ? (
            <Animated.View
              style={{ opacity: fadeAnim, width: "100%", height: "100%" }}
            >
              <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={!capturedPhoto}
                frameProcessor={!capturedPhoto ? frameProcessor : undefined}
                photo={true}
              />

              {/* Face boxes */}
              {faces.map((face, index) => (
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
              ))}

              {/* No face detected overlay */}
              {faces.length === 0 ? (
                <View style={styles.noFaceDetected}>
                  <Text style={styles.noFaceText}>No Face Detected</Text>
                  <Text style={styles.instructionText}>
                    Please position your face in the frame
                  </Text>
                </View>
              ) : countdown !== null && countdown > 0 ? (
                /* Countdown overlay */
                <View style={styles.countdownOverlay}>
                  <Text style={styles.steadyText}>Hold Steady</Text>
                  <Animated.Text
                    style={[
                      styles.countdownText,
                      { transform: [{ scale: scaleAnim }] },
                    ]}
                  >
                    {countdown}
                  </Animated.Text>
                </View>
              ) : null}
            </Animated.View>
          ) : (
            /* Captured photo display */
            <View style={styles.capturedPhotoContainer}>
              <Image
                source={{ uri: `file://${capturedPhoto.path}` }}
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
          {capturedPhoto ? (
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
                ? countdown !== null
                  ? "Please hold still..."
                  : "Ready to capture!"
                : "Center your face in the frame"}
            </Text>
          )}
        </View>

        {/* Confirmation Modal */}
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

        {/* Thank You Modal */}
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
});

export default CameraScreen;
