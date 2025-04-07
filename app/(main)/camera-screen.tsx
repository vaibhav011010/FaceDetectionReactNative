import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { Worklets } from "react-native-worklets-core";
import { useRouter, usePathname, useSegments } from "expo-router";
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
import debounce from "lodash.debounce";

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
const { width, height } = Dimensions.get("window");
const isTablet = width >= 768;
const CameraScreen = (props: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const {
    visitorName: visitorNameRedux,
    visitorMobile: visitorMobileRedux,
    visitingCompany: visitingCompanyRedux,
  } = useSelector((state: RootState) => state.visitor);
  const dispatch = useDispatch<AppDispatch>();
  const currentSlide = useRef(new Animated.Value(0)).current;
  // Camera refs and states
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice("front");

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraKey, setCameraKey] = useState<number>(0);
  const [isResetting, setIsResetting] = useState(false);

  // Performance optimized state
  const [batteryMode, setBatteryMode] = useState("balanced");

  const [faces, setFaces] = useState<Face[]>([]);
  const [previewDimensions, setPreviewDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [isReady, setIsReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [frameProcessorEnabled, setFrameProcessorEnabled] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
  const isCameraMounted = useRef(true);
  const [cameraActive, setCameraActive] = useState(false);

  const [uiFaceDetected, setUIFaceDetected] = useState(false);

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const isTakingPhoto = useRef(false);
  const isProcessingRef = useRef(false);
  const isTakingPhotoRef = useRef(false);

  // Refs for performance optimization
  const countdownInProgressRef = useRef<boolean>(false);
  const frameProcessorEnabledRef = useRef<boolean>(true);
  const faceCaptureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const faceDetectedRef = useRef<boolean>(false);
  const lastProcessedTimestamp = useRef<number>(0);
  const FRAME_PROCESS_INTERVAL = 1000;

  const [cameraInitializing, setCameraInitializing] = useState(true);
  // Replace all setFrameProcessorEnabled calls with:
  // Replace ALL setFrameProcessorEnabled calls with:
  const toggleFrameProcessor = (enable: boolean) => {
    // Only toggle if state actually changes
    if (frameProcessorEnabled !== enable && cameraActive) {
      console.log(`Frame processor ${enable ? "ENABLED" : "DISABLED"}`);
      setFrameProcessorEnabled(enable);
      frameProcessorEnabledRef.current = enable;
    }
  };

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     console.log("Camera ref check:", !!cameraRef.current);
  //   }, 10000);

  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    // Ensure we have a valid camera device
    if (!device) {
      console.error("No camera device available");
      Alert.alert(
        "Camera Error",
        "No front camera found on this device. Please check your device settings."
      );
    }
  }, [device]);
  useEffect(() => {
    console.log("Camera component mounted with ref:", !!cameraRef.current);

    return () => {
      console.log("Camera component unmounting, ref:", !!cameraRef.current);
    };
  }, []);

  // Request camera permissions on mount and start initial countdown
  // Replace your camera initialization code with this more reliable approach
  useEffect(() => {
    // Clear any previous timers to prevent memory leaks
    if (faceCaptureTimerRef.current) {
      clearTimeout(faceCaptureTimerRef.current);
      faceCaptureTimerRef.current = null;
    }
    const requestPermission = async () => {
      try {
        // Check current permission status first
        const status = await Camera.getCameraPermissionStatus();

        // If not granted, explicitly request
        if (status !== "granted") {
          const newStatus = await Camera.requestCameraPermission();
          setHasPermission(newStatus === "granted");

          // Only proceed if permission is granted
          if (newStatus === "granted") {
            // Start the initial countdown after permission is confirmed
            startInitialCountdown();
          }
        } else {
          setHasPermission(true);
          // Start countdown if already have permission
          startInitialCountdown();
        }
      } catch (error) {
        console.error("Permission error:", error);
        Alert.alert(
          "Camera Permission Error",
          "Unable to access camera. Please check your device settings."
        );
      }
    };

    const startInitialCountdown = () => {
      // Start the initial countdown to prepare the user
      const initialCountdownInterval = setInterval(() => {
        setInitialCountdown((prev) => {
          const newCount = prev - 1;

          // When countdown reaches 0, show camera view but not yet activated
          if (newCount <= 0) {
            clearInterval(initialCountdownInterval);
            setShowInitialCountdown(false);
            setCameraActive(true);
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

      // Store interval reference for cleanup
      return () => {
        clearInterval(initialCountdownInterval);
      };
    };

    requestPermission();
    StatusBar.setHidden(true, "none");

    return () => {
      StatusBar.setHidden(false, "none");
      if (faceCaptureTimerRef.current) {
        clearTimeout(faceCaptureTimerRef.current);
        faceCaptureTimerRef.current = null;
      }
      // Properly clean up camera resources
      // setFrameProcessorEnabled(false);
      toggleFrameProcessor(false);
      setCameraActive(false);
    };
  }, []);
  useEffect(() => {
    // When this specific screen is loaded
    console.log("Screen loaded, resetting camera...");
    resetCamera();

    return () => {
      // When navigating away
      console.log("Navigating away, deactivating camera...");
      setCameraActive(false);
      frameProcessorEnabledRef.current = false;
    };
  }, [pathname, segments]);

  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        setCameraInitializing(true);

        // Wait for device to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (mounted) {
          setCameraActive(true);
          frameProcessorEnabledRef.current = true;
        }
      } finally {
        if (mounted) {
          setCameraInitializing(false);
        }
      }
    };

    initCamera();

    return () => {
      mounted = false;
      resetCaptureState();
      setCameraActive(false);
    };
  }, [cameraKey]); // Re-run when cameraKey changes
  // Face detection handler with throttling
  const { detectFaces } = useFaceDetector({
    performanceMode: "fast", // Use fast mode instead of "accurate"
    minFaceSize: 0.1, // Lower this to detect smaller faces
    landmarkMode: "none", // Disable landmarks to avoid false negatives
    contourMode: "none", // Disable contour detection to improve performance
  });

  const cameraSettings = useMemo(() => {
    switch (batteryMode) {
      case "low_power":
        return {
          photoQualityBalance: "speed",
          pixelFormat: "yuv",
          frameProcessorEnabled: false,
        };
      default:
        return {
          photoQualityBalance: "balanced",
          pixelFormat: "native",
          frameProcessorEnabled: true,
        };
    }
  }, [batteryMode]);

  const handleDetectedFaces = Worklets.createRunOnJS((newFaces: Face[]) => {
    // Skip if in invalid state
    if (
      isProcessingRef.current ||
      capturedPhotoUri ||
      !frameProcessorEnabledRef.current
    ) {
      return;
    }
    setUIFaceDetected(newFaces.length > 0);
    // Update faces only if changed
    if (JSON.stringify(faces) !== JSON.stringify(newFaces)) {
      setFaces(newFaces || []);
    }

    // Face detection logic
    if (newFaces.length > 0 && !faceDetectedRef.current) {
      faceDetectedRef.current = true;

      // Clear any existing timer
      if (faceCaptureTimerRef.current) {
        clearTimeout(faceCaptureTimerRef.current);
      }

      // Start new capture delay
      faceCaptureTimerRef.current = setTimeout(() => {
        if (!isProcessingRef.current && !capturedPhotoUri) {
          takePhoto();
        }
        faceCaptureTimerRef.current = null;
      }, 500); // 0.5second delay
    } else if (newFaces.length === 0) {
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
    if (isProcessingRef.current || capturedPhotoUri || !cameraActive) {
      console.log("Capture blocked - invalid state");
      return;
    }

    // Lock capture process
    isProcessingRef.current = true;
    frameProcessorEnabledRef.current = false;
    setIsProcessing(true);

    try {
      // Triple-check camera state
      if (!cameraRef.current) {
        throw new Error("Camera ref is null");
      }

      // Stabilization delay
      await new Promise((resolve) => setTimeout(resolve, 200));

      const photo = await cameraRef.current.takePhoto({
        flash: "off",
      });

      if (!photo?.path) {
        throw new Error("Invalid photo result");
      }

      const fileUri = photo.path.startsWith("file://")
        ? photo.path
        : `file://${photo.path}`;

      setCapturedPhotoUri(fileUri);
    } catch (error) {
      console.error("Capture failed:", error);
      resetCamera(); // Full reset on error
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };
  // Reset camera capture state

  // Modify your convertAndSubmit function with the correct navigation syntax
  const convertAndSubmit = async () => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const resetCaptureState = () => {
    // Reset all refs
    faceDetectedRef.current = false;
    countdownInProgressRef.current = false;
    isProcessingRef.current = false;

    // Clear any pending timers
    if (faceCaptureTimerRef.current) {
      clearTimeout(faceCaptureTimerRef.current);
      faceCaptureTimerRef.current = null;
    }

    // Reset frame processing (but don't enable yet)
    frameProcessorEnabledRef.current = false;
  };

  const resetCamera = async () => {
    console.log("Resetting camera...");
    setIsResetting(true);

    // 1. First disable everything
    setCameraActive(false);
    resetCaptureState();

    // 2. Clear states
    setCapturedPhotoUri(null);
    setCapturedPhotoBase64(null);
    setCountdown(null);
    setFaces([]);

    // 3. Wait for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 4. Remount camera with new key
    setCameraKey((prev) => prev + 1);

    // 5. Re-enable after delay
    setTimeout(() => {
      console.log("Re-enabling camera...");
      setCameraActive(true);
      setIsResetting(false);
      frameProcessorEnabledRef.current = true;
    }, 800);
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

  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;

  // Initial countdown screen
  // if (showInitialCountdown) {
  //   return (
  //     <View
  //       style={[
  //         styles.borderContainer2,
  //         { width: windowWidth, height: windowHeight },
  //       ]}
  //     >
  //       {/* <View style={styles.countdownContainer}> */}
  //       <Text style={styles.countdownTitle}>Getting Ready</Text>
  //       <Text style={styles.countdownInstructions}>
  //         Please prepare to position your face
  //       </Text>
  //       <Animated.Text
  //         style={[
  //           styles.initialCountdownText,
  //           { transform: [{ scale: scaleAnim }] },
  //         ]}
  //       >
  //         {initialCountdown}
  //       </Animated.Text>
  //     </View>
  //     // </View>
  //   );
  // }
  const getResponsiveSize = (baseSize: number) => {
    const scaleFactor = width / 375; // Standard iPhone width as base
    return baseSize * scaleFactor;
  };
  const handleCameraInitialized = () => {
    setCameraInitializing(false);
    setIsReady(true);
    console.log("Camera initialized successfully");
    // Enable frame processor only after camera is fully initialized
    setTimeout(() => {
      if (cameraActive) {
        // setFrameProcessorEnabled(true);
        toggleFrameProcessor(true);
      }
    }, 500);
  };
  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.screen, { transform: [{ translateX: currentSlide }] }]}
      >
        <View style={styles.container2}>
          <View
            style={[styles.borderContainer, { width: width, height: height }]}
          >
            <View style={styles.container3}>
              {showInitialCountdown ? (
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
                    {initialCountdown}
                  </Animated.Text>
                </View>
              ) : (
                <>
                  <View
                    style={styles.cameraWrapper}
                    onLayout={(event) => {
                      const { width, height } = event.nativeEvent.layout;
                      setPreviewDimensions({ width, height });
                    }}
                  >
                    {cameraActive && cameraInitializing && (
                      <View style={styles.cameraInitializingOverlay}>
                        <Text style={styles.initializingText}>
                          Initializing camera...
                        </Text>
                      </View>
                    )}

                    {!capturedPhotoUri ? (
                      <Animated.View
                        style={{
                          opacity: fadeAnim,
                          width: "100%",
                          height: "100%",
                          position: "relative", // Add this
                        }}
                      >
                        {cameraActive && (
                          <Camera
                            key={cameraKey}
                            ref={cameraRef}
                            onInitialized={handleCameraInitialized}
                            onError={(error) => {
                              console.error("Camera error:", error);
                              resetCamera();
                            }}
                            videoStabilizationMode="auto"
                            style={styles.camera}
                            device={device}
                            photoQualityBalance="balanced"
                            pixelFormat="yuv"
                            enableZoomGesture={false}
                            isActive={cameraActive}
                            frameProcessor={
                              frameProcessorEnabled ? frameProcessor : undefined
                            }
                            photo={true}
                          />
                        )}

                        {/* Modify face detection overlays */}
                        {faces.length === 0 &&
                        !isProcessing &&
                        !capturedPhotoUri ? (
                          <View
                            style={[
                              styles.noFaceDetected,
                              {
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: "transparent", // Ensure overlay is transparent
                              },
                            ]}
                          >
                            <Text style={styles.noFaceText}>
                              No Face Detected
                            </Text>
                            <Text style={styles.instructionText}>
                              Please position your face in the frame
                            </Text>
                          </View>
                        ) : faces.length > 0 &&
                          uiFaceDetected &&
                          !isProcessing &&
                          !capturedPhotoUri ? (
                          <View
                            style={[
                              styles.countdownOverlay,
                              {
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: "rgba(0,0,0,0.3)", // Semi-transparent overlay
                              },
                            ]}
                          >
                            <Text style={styles.steadyText}>Hold Steady</Text>
                          </View>
                        ) : null}

                        {/* Existing face boxes */}
                        {!isProcessing &&
                          !capturedPhotoUri &&
                          frameProcessorEnabled &&
                          renderFaceBoxes}
                      </Animated.View>
                    ) : (
                      /* Captured photo display */
                      <View style={styles.capturedPhotoContainer}>
                        <Image
                          source={{ uri: capturedPhotoUri }}
                          style={styles.capturedImage}
                        />

                        <View style={styles.captureSuccessOverlay}>
                          <Text style={styles.captureSuccessText}>
                            Photo Captured!
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Bottom section with submit/cancel buttons */}
                  <View style={styles.bottomSection}>
                    {capturedPhotoUri ? (
                      <View style={styles.buttonContainer}>
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
                          disabled={isProcessing}
                        >
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color="#03045E"
                          />
                          <Text style={styles.buttonTextCancel}>Cancel</Text>
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
                          disabled={isProcessing}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color="#fafafa" />
                          ) : (
                            <>
                              <Text style={styles.buttonText}>Submit</Text>
                              <Ionicons
                                name="checkmark-circle"
                                size={22}
                                color="#fafafa"
                              />
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.instructionText}>
                        {faces.length > 0
                          ? faceDetected
                            ? "Please hold still..."
                            : "Ready to capture!"
                          : "Center your face in the frame"}
                      </Text>
                    )}
                  </View>
                  {/* Header with retry button when photo is captured */}
                  {capturedPhotoUri && (
                    <View style={styles.headerContainer}>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={resetCamera}
                        disabled={isProcessing}
                      >
                        <Ionicons name="camera" size={22} color="#fafafa" />
                        <Text style={styles.retryText}>Capture Again</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

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
                        <Text style={styles.modalConfirmButtonText}>
                          Confirm
                        </Text>
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
                        <Text style={styles.modalConfirmButtonText}>
                          Confirm
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
              {/* <Modal
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
              </Modal> */}
              <Modal
                visible={showThankYouModal}
                transparent={false} // Full screen modal, no transparency
                animationType="slide" // Slide in animation
              >
                <View style={styles.fullScreenModal}>
                  <Image
                    source={require("../../assets/thankyou.png")} // Replace with your image source
                    style={styles.fullScreenImage}
                    resizeMode="cover"
                  />
                </View>
              </Modal>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  container3: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",

    borderRadius: 10,
    backgroundColor: "#EEF2F6",
  },
  borderContainer: {
    padding: 15,
    backgroundColor: "#EEF2F6",
    // borderWidth: 14,
    // borderColor: "#03045E", // Sky blue color
    // borderRadius: 2,
    // overflow: "hidden",
  },
  container2: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },
  screen: {
    flex: 1,
    width: width,
    justifyContent: "center",
    alignItems: "center",
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
  borderContainer2: {
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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  retryButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#03045E",
    height: 40,
    width: "100%",
    borderRadius: 10,
  },
  retryText: {
    color: "#FAFAFA",
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
    width: isTablet ? 400 : 306,
    height: isTablet ? 400 : 306,
    overflow: "hidden",
    borderRadius: 20,
    borderColor: "#03045E",
    borderWidth: 2,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cameraInitializingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  initializingText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
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
    backgroundColor: "rgba(255,0,0,0.3)",
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
    backgroundColor: "#EEF2F6",
  },
  steadyText: {
    color: "white",
    fontSize: 15,
    fontFamily: "OpenSans_Condensed-SemiBold",
    backgroundColor: "rgba(0,100,0,0.3)",
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
    backgroundColor: "#EEF2F6",
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
    backgroundColor: "rgba(0,150,0,0.3)",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "center", // Center buttons horizontally
    alignItems: "center", // Align buttons vertically
    width: "100%",
    gap: 20, // Add space between buttons
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
  submitButton: {
    backgroundColor: "#03045E",
    padding: 8,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  buttonText: {
    color: "white",
    fontSize: isTablet ? 20 : 14,
    fontFamily: "OpenSans_Condensed-Bold",
  },
  buttonTextCancel: {
    color: "#02023C",
    fontSize: isTablet ? 20 : 14,
    fontFamily: "OpenSans_Condensed-Bold",
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
  // countdownContainer: {
  //   flex: 1,
  //   justifyContent: "center",
  //   alignItems: "center",
  //   backgroundColor: "#f5f5f5",
  // },
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
});

export default CameraScreen;
