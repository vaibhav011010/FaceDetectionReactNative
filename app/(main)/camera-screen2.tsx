import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  BackHandler,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  PhotoFile,
  CameraPermissionStatus,
} from "react-native-vision-camera";
import * as ScreenOrientation from "expo-screen-orientation";
import { Worklets } from "react-native-worklets-core";
import {
  useFaceDetector,
  Face,
} from "react-native-vision-camera-face-detector";
import FaceDetection from "@react-native-ml-kit/face-detection";

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
import { submitVisitor, syncVisitors } from "../api/visitorForm";
import NextSvg from "@/src/utility/nextSvg";
import StarIcon from "@/src/utility/starIcon";
import CameraIcon from "@/src/utility/CameraSvg";
import ThankYou from "@/src/utility/ThankyouIcon";
import { useUniversalDialog } from "../../src/utility/UniversalDialogProvider";

import { withTimeoutSubmit } from "@/src/utility/withTimeOutSubmit";

const { width, height } = Dimensions.get("window");
const isTablet = width >= 768;

const useResponsiveDimensions = () => {
  const [dimensions, setDimensions] = useState(() => {
    const window = Dimensions.get("window");
    const screen = Dimensions.get("screen");
    return {
      windowWidth: window.width,
      windowHeight: window.height,
      screenHeight: screen.height, // Full screen height
    };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener(
      "change",
      ({ window, screen }) => {
        setDimensions({
          windowWidth: window.width,
          windowHeight: window.height,
          screenHeight: screen.height,
        });
      }
    );

    return () => subscription?.remove();
  }, []);

  return {
    ...dimensions,
    actualHeight: dimensions.screenHeight, // Use this for full height
    isLandscape: dimensions.windowWidth > dimensions.windowHeight,
    isTablet: Math.min(dimensions.windowWidth, dimensions.windowHeight) >= 768,
  };
};
interface LooseFace {
  bounds?: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  [key: string]: any;
}
const FaceDetectionCamera: React.FC = () => {
  const [uiRotation, setUiRotation] = useState<number>(0);

  const { windowWidth, windowHeight, isLandscape, isTablet, screenHeight } =
    useResponsiveDimensions();
  // States
  const [isXiaomiDevice, setIsXiaomiDevice] = useState(false);
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
  const [cameraKey, setCameraKey] = useState(0);
  const showDialog = useUniversalDialog();
  const [bootstrapped, setBootstrapped] = useState(false);

  const [isCameraReady, setIsCameraReady] = useState(true);
  const [captureAttemptsLeft, setCaptureAttemptsLeft] = useState(5);

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
  const [photoHasFace, setPhotoHasFace] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState(false);

  const { detectFaces } = useFaceDetector({
    performanceMode: "fast",
    landmarkMode: "none", // No landmarks needed
    contourMode: "none", // No contours needed
    classificationMode: "none", // No smile/eye detection needed
    minFaceSize: 0.05, // Accept very small faces (5% of image)
    trackingEnabled: false, // Disable tracking for speed
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
      const timestamp = Date.now();

      // Log entry condition
      if (
        hasTakenPhotoRef.current ||
        isTakingPicture ||
        isCaptureAgainDisabled
      ) {
        console.log(`[${timestamp}] 🚫 Face detection blocked:`, {
          hasTakenPhoto: hasTakenPhotoRef.current,
          isTakingPicture,
          isCaptureAgainDisabled,
          facesCount: faces.length,
        });
        return;
      }

      console.log(`[${timestamp}] 👁️ Processing ${faces.length} faces`);

      // MUCH SIMPLER validation - just check if face exists and has reasonable size
      const validFace =
        faces.length > 0 &&
        faces.some((face, index) => {
          const faceWidth = face.bounds.width;
          const faceHeight = face.bounds.height;

          console.log(`[${timestamp}] 📏 Face ${index} dimensions:`, {
            width: faceWidth,
            height: faceHeight,
            bounds: face.bounds,
            isTablet,
          });

          // Allow extremely small faces (1% of preview size)
          const minSize = 5; // basically almost any detected face
          const isValidSize = faceWidth > minSize && faceHeight > minSize;

          console.log(`[${timestamp}] ✅ Face ${index} validation:`, {
            isValidSize,
            minSize,
            meetsRequirement: isValidSize,
          });

          return isValidSize;
        });

      // Only update if status actually changed to prevent unnecessary re-renders
      if (validFace !== isFaceDetected) {
        console.log(`[${timestamp}] 🔄 Face detection state changed:`, {
          from: isFaceDetected,
          to: validFace,
          facesCount: faces.length,
        });
        setIsFaceDetected(validFace);
      }

      // Immediate photo capture when face detected (no delays)
      if (validFace && !photoTimeoutRef.current && !hasTakenPhotoRef.current) {
        console.log(`[${timestamp}] 📸 Scheduling photo capture...`);
        photoTimeoutRef.current = setTimeout(() => {
          if (!hasTakenPhotoRef.current && !isTakingPicture) {
            console.log(`[${Date.now()}] 🎯 Executing photo capture`);
            takePicture();
          } else {
            console.log(`[${Date.now()}] ❌ Photo capture cancelled:`, {
              hasTakenPhoto: hasTakenPhotoRef.current,
              isTakingPicture,
            });
          }
          photoTimeoutRef.current = null;
        }, 50); // Very short delay - just enough to prevent double captures
      } else if (validFace) {
        console.log(`[${timestamp}] ⏳ Photo capture blocked:`, {
          hasTimeout: !!photoTimeoutRef.current,
          hasTakenPhoto: hasTakenPhotoRef.current,
        });
      }
    },
    [isFaceDetected, isTakingPicture, isCaptureAgainDisabled, isTablet]
  );

  // Create worklet functions
  const onFaceDetectedJS = Worklets.createRunOnJS(onFaceDetected);

  // Improved frame processor with better locking mechanism
  const lastProcess = useRef<number>(0);
  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";

    const now = Date.now();

    // Log throttling
    if (now - lastProcess.current < 400) {
      // Uncomment for very detailed throttling logs (can be noisy)
      // console.log(`[${now}] ⏱️ Frame throttled, last: ${now - lastProcess.current}ms ago`);
      return;
    }

    // Skip if already processing to prevent queue buildup
    if (processingLock.current) {
      console.log(`[${now}] 🔒 Frame skipped - processing lock active`);
      return;
    }

    console.log(
      `[${now}] 🎬 Processing frame - gap: ${now - lastProcess.current}ms`
    );

    lastProcess.current = now;
    processingLock.current = true;

    try {
      const startDetection = Date.now();
      const faces = detectFaces(frame);
      const detectionTime = Date.now() - startDetection;

      console.log(`[${now}] 🔍 Face detection completed:`, {
        detectionTime: `${detectionTime}ms`,
        facesFound: faces.length,
        processingGap: now - lastProcess.current,
      });

      onFaceDetectedJS(faces);
    } catch (error) {
      console.error(`[${now}] ❌ Face detection error:`, error);
      onFaceDetectedJS([]); // Continue with empty array
    } finally {
      // CRITICAL: Always unlock, even on error
      processingLock.current = false;
      console.log(`[${Date.now()}] 🔓 Processing lock released`);
    }
  }, []);
  // const cleanupFaceDetection = useCallback(() => {
  //   if (photoTimeoutRef.current) {
  //     clearTimeout(photoTimeoutRef.current);
  //   }
  //   processingLock.current = false;
  //   setIsFaceDetected(false);
  // }, []);

  // Request camera permissions
  useEffect(() => {
    const checkPermissions = async (): Promise<void> => {
      try {
        // First check existing status
        const currentStatus: CameraPermissionStatus =
          await Camera.getCameraPermissionStatus();

        if (currentStatus === "granted") {
          setHasPermission(true);
        } else if (currentStatus === "denied") {
          setHasPermission(false);
        } else {
          // If undetermined → request
          const newStatus: CameraPermissionStatus =
            await Camera.requestCameraPermission();
          setHasPermission(newStatus === "granted");
        }
      } catch (err) {
        console.error("Permission check failed:", err);
        setHasPermission(false); // fallback so UI doesn't spin forever
      }
    };

    checkPermissions();

    return () => {
      // Clean up all timeouts
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (photoTimeoutRef.current) clearTimeout(photoTimeoutRef.current);
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const orientationFixTimeout = setTimeout(() => {
      console.log("🔄 Forcing camera remount to align orientation...");
      setShowCamera(false);

      setTimeout(() => {
        setShowCamera(true);
        console.log("✅ Camera orientation re-initialized");
      }, 300); // small delay before re-render
    }, 1500); // run ~1.5s after mount (after countdown starts)

    return () => clearTimeout(orientationFixTimeout);
  }, []);

  // Handle the countdown separately
  useEffect(() => {
    if (countdown > 0) {
      timeoutRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
        animateCountdown(); // Trigger animation every time the countdown changes
      }, 1000);
    } else if (countdown === 0) {
      console.log("⏱️ Countdown finished, resetting camera...");
      setCameraKey((prev) => prev + 1);
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

  // Alternative: Even more lenient version with option to skip
  async function validateCapturedImage(uri: string): Promise<boolean> {
    try {
      const faces = await FaceDetection.detect(uri, {
        performanceMode: "fast",
        landmarkMode: "none",
        classificationMode: "none",
        minFaceSize: 0.001, // Extremely small minimum face size
      });

      const faceCount = faces?.length || 0;
      console.log("Lenient face validation:", { facesFound: faceCount });

      // If no face found, give user choice but don't force retake
      if (faceCount === 0) {
        let userChoice = false;
        await showDialog({
          title: "Face Detection",
          message:
            "We couldn’t find a face in your photo. You can still continue, but a clear face photo works best. Press Continue to proceed or Retake to try again.",
          actions: [
            {
              label: "Retake Photo",
              onPress: () => {
                userChoice = false;
              },
            },
            {
              label: "Continue",
              mode: "contained",
              onPress: () => {
                userChoice = true;
              },
            },
          ],
        });
        return userChoice;
      }

      return true;
    } catch (error) {
      console.error("Face validation error:", error);
      return true;
    }
  }
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
        await showDialog({
          title: "Error",
          message: "Failed to capture photo",
          actions: [
            {
              label: "OK",
              mode: "contained",
              onPress: () => {},
            },
          ],
        });
      }
    } finally {
      setIsTakingPicture(false);
    }
  }, [isTakingPicture, notifyCapture]);
  // Add this cleanup function
  const cleanupCamera = useCallback(() => {
    const timestamp = Date.now();
    console.log(`[${timestamp}] 🧹 Starting camera cleanup...`);

    // Log current state before cleanup
    console.log(`[${timestamp}] 📊 Pre-cleanup state:`, {
      hasTakenPhoto: hasTakenPhotoRef.current,
      processingLock: processingLock.current,
      isFaceDetected,
      isProcessingFrame,
      activeTimeouts: {
        photo: !!photoTimeoutRef.current,
        capture: !!captureTimeoutRef.current,
        steadyFace: !!steadyFaceTimerRef.current,
        main: !!timeoutRef.current,
      },
    });

    // Clear all timeouts
    let clearedTimeouts = 0;
    [
      photoTimeoutRef,
      captureTimeoutRef,
      steadyFaceTimerRef,
      timeoutRef,
    ].forEach((ref, index) => {
      const timeoutNames = ["photo", "capture", "steadyFace", "main"];
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
        clearedTimeouts++;
        console.log(`[${timestamp}] ⏰ Cleared ${timeoutNames[index]} timeout`);
      }
    });

    // Reset all refs and locks
    const previousStates = {
      hasTakenPhoto: hasTakenPhotoRef.current,
      processingLock: processingLock.current,
      lastProcess: lastProcess.current,
    };

    hasTakenPhotoRef.current = false;
    processingLock.current = false;
    lastProcess.current = 0; // Reset the throttle timer

    // Reset face detection state
    setIsFaceDetected(false);
    setIsProcessingFrame(false);

    console.log(`[${timestamp}] ✅ Cleanup completed:`, {
      clearedTimeouts,
      previousStates,
      newStates: {
        hasTakenPhoto: hasTakenPhotoRef.current,
        processingLock: processingLock.current,
        lastProcess: lastProcess.current,
      },
    });

    // Force cleanup hint
    if (global.gc) {
      console.log(`[${timestamp}] 🗑️ Triggering garbage collection`);
      global.gc();
    }
  }, [isFaceDetected, isProcessingFrame]);
  // Safely reset to capture again - improved for reliability
  const captureAgain = useCallback(async (): Promise<void> => {
    if (isCaptureAgainDisabled) return;

    if (captureAttemptsLeft <= 0) {
      // Reached last attempt — show alert and exit before triggering reset
      await showDialog({
        title: "Maximum Attempts Reached",
        message:
          "You've used all 5 tries. Please try again from the Home Page.",
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: () => {
              confirmCancel(); // navigate to home, reset states
            },
          },
        ],
      });
      return;
    }

    setIsCaptureAgainDisabled(true);
    cleanupCamera();
    setCapturedPhoto(null);
    setIsFaceDetected(false);

    const delay = isXiaomiDevice ? 800 : 300;

    setTimeout(() => {
      setCameraKey((prev) => prev + 1);
      hasTakenPhotoRef.current = false;
      processingLock.current = false;
      setIsCaptureAgainDisabled(false);

      // Now safely decrement attempt count AFTER reset is done
      setCaptureAttemptsLeft((prev) => prev - 1);
    }, delay);
  }, [cleanupCamera, captureAttemptsLeft, isCaptureAgainDisabled]);
  // const convertAndSubmit = async () => {
  //   console.log("🔥 convertAndSubmit started");
  //   setIsLoading(true);
  //   setIsCaptureAgainDisabled(true);

  //   if (!capturedPhoto) {
  //     console.log("❌ No captured photo");
  //     await showDialog({
  //       title: "Error",
  //       message: "No photo to submit",
  //       actions: [
  //         {
  //           label: "OK",
  //           mode: "contained",
  //           onPress: () => {},
  //         },
  //       ],
  //     });
  //     setIsLoading(false);
  //     setIsCaptureAgainDisabled(false);
  //     return;
  //   }

  //   let shouldShowModal = false;

  //   try {
  //     console.log("✅ Starting submission process");
  //     setShowConfirmModal(false);

  //     // Prepare base64
  //     let base64String = capturedPhotoBase64;
  //     if (!base64String) {
  //       console.log("📷 Converting photo to base64");
  //       const result = await convertPhotoToBase64(capturedPhoto);
  //       base64String =
  //         typeof result === "string" ? result : result.image_base64;
  //     }

  //     let result;
  //     let isOfflineScenario = false;

  //     console.log("🌐 Attempting API submission with 4 second timeout");
  //     try {
  //       result = await withTimeoutSubmit(
  //         submitVisitor(
  //           visitorNameRedux,
  //           visitorMobileRedux,
  //           Number(visitingCompanyRedux),
  //           base64String
  //         ),
  //         4000
  //       );
  //       console.log("✅ API submission result:", result);
  //     } catch (error: any) {
  //       console.log("❌ API submission failed/timeout:", error.message);
  //       isOfflineScenario = true;
  //       result = {
  //         success: false,
  //         error: "stored locally",
  //       };
  //     }

  //     const offlineStored = isOfflineScenario;

  //     // Check if data was stored locally (even if success is false)
  //     const wasStoredLocally =
  //       result.error && result.error.includes("stored locally");

  //     console.log("📊 Submit result:", {
  //       success: result.success,
  //       offlineStored,
  //       isOfflineScenario,
  //       wasStoredLocally,
  //       error: result.error,
  //     });

  //     // Show modal if successful OR if stored locally
  //     if (result.success || offlineStored || wasStoredLocally) {
  //       console.log("🎯 Success or offline scenario - should show modal");
  //       shouldShowModal = true;
  //       setCapturedPhoto(null);
  //       resetStates(true);
  //       console.log("🎯 shouldShowModal set to:", shouldShowModal);
  //     } else {
  //       console.log("💥 Complete failure - navigating immediately");
  //       resetStates(true);
  //       router.replace("/checkin-screen");
  //     }
  //   } catch (error) {
  //     console.error("💥 Unexpected error in convertAndSubmit:", error);
  //     await showDialog({
  //       title: "Submit Failed",
  //       message: "Visitor check-in submission failed. Please try again.",
  //       actions: [
  //         {
  //           label: "OK",
  //           mode: "contained",
  //           onPress: () => {},
  //         },
  //       ],
  //     });
  //     setIsCaptureAgainDisabled(false);
  //   } finally {
  //     console.log("🏁 Finally block - turning off loading");
  //     setIsLoading(false);

  //     console.log("🎭 Finally block - shouldShowModal:", shouldShowModal);

  //     if (shouldShowModal) {
  //       console.log("🎉 About to show thank you modal in 100ms");
  //       setTimeout(() => {
  //         console.log("🎭 Setting showThankYouModal to true");
  //         setShowThankYouModal(true);

  //         setTimeout(() => {
  //           console.log("🚀 Closing modal and navigating after 2 seconds");
  //           setShowThankYouModal(false);
  //           router.replace("/checkin-screen");
  //         }, 2000);
  //       }, 100);
  //     } else {
  //       console.log("❌ shouldShowModal is false - not showing modal");
  //     }
  //   }
  // };
  // Handle cancel

  const convertAndSubmit = async () => {
    console.log("🔥 convertAndSubmit started");
    setIsLoading(true);
    setIsCaptureAgainDisabled(true);

    if (!capturedPhoto) {
      console.log("❌ No captured photo");
      await showDialog({
        title: "Error",
        message: "No photo to submit",
        actions: [{ label: "OK", mode: "contained", onPress: () => {} }],
      });
      setIsLoading(false);
      setIsCaptureAgainDisabled(false);
      return;
    }

    let shouldShowModal = false;

    try {
      console.log("✅ Starting offline submission process");
      setShowConfirmModal(false);

      // Convert photo to base64 if not already
      let base64String = capturedPhotoBase64;
      if (!base64String) {
        console.log("📷 Converting photo to base64");
        const result = await convertPhotoToBase64(capturedPhoto);
        base64String =
          typeof result === "string" ? result : result.image_base64;
      }

      // Directly store visitor offline (no timeout, no API)
      console.log("💾 Storing visitor offline...");
      const result = await submitVisitor(
        visitorNameRedux,
        visitorMobileRedux,
        Number(visitingCompanyRedux),
        base64String
      );

      console.log("📊 Offline store result:", result);

      if (result.success) {
        console.log("🎯 Visitor stored locally - showing thank you modal");

        shouldShowModal = true;
        setCapturedPhoto(null);
        resetStates(true);
      } else {
        console.log("💥 Local storage failed:", result.error);
        await showDialog({
          title: "Storage Failed",
          message: "Could not store visitor locally. Please try again.",
          actions: [{ label: "OK", mode: "contained", onPress: () => {} }],
        });
        resetStates(true);
        router.replace("/checkin-screen");
      }
    } catch (error) {
      console.error("💥 Unexpected error in convertAndSubmit:", error);
      await showDialog({
        title: "Submit Failed",
        message: "Visitor check-in submission failed. Please try again.",
        actions: [{ label: "OK", mode: "contained", onPress: () => {} }],
      });
      setIsCaptureAgainDisabled(false);
    } finally {
      console.log("🏁 Finally block - turning off loading");
      setIsLoading(false);

      if (shouldShowModal) {
        console.log("🎉 About to show thank you modal in 100ms");
        setTimeout(() => {
          console.log("🎭 Setting showThankYouModal to true");
          setShowThankYouModal(true);

          setTimeout(() => {
            console.log("🚀 Closing modal and navigating after 2 seconds");
            setShowThankYouModal(false);
            router.replace("/checkin-screen");
          }, 2000);
        }, 100);
      } else {
        console.log("❌ shouldShowModal is false - not showing modal");
      }
    }
  };

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const resetStates = (clearRedux = false) => {
    setShowCamera(false);
    setCapturedPhotoBase64(null);
    setCapturedPhoto(null);
    setIsTakingPicture(false);
    setIsFaceDetected(false);
    hasTakenPhotoRef.current = false;
    processingLock.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (photoTimeoutRef.current) clearTimeout(photoTimeoutRef.current);
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    timeoutRef.current = null;
    photoTimeoutRef.current = null;
    captureTimeoutRef.current = null;
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
  const handleConfirmSubmit = async () => {
    if (!capturedPhoto) {
      await showDialog({
        title: "Error",
        message: "No photo to submit",
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

    // 1️⃣ Close modal so it’s not blocking
    setShowConfirmModal(false);
    setIsCaptureAgainDisabled(true);

    // 2️⃣ Fade button to indicate “checking photo”
    setIsValidating(true);

    // 3️⃣ Run face-validation
    const ok = await validateCapturedImage(capturedPhoto);

    // 4️⃣ Always turn off the fade
    setIsValidating(false);
    try {
      if (!ok) {
        // Validation failed: re-enable capture again since we're staying on screen
        setIsCaptureAgainDisabled(false);
        return;
      }

      // 5️⃣ Validation passed → now show spinner and submit
      // convertAndSubmit() already flips isLoading internally
      await convertAndSubmit();
    } catch (error) {
      // Handle any unexpected errors
      console.error("Error in handleConfirmSubmit:", error);
      setIsValidating(false);
      setIsCaptureAgainDisabled(false); // Re-enable on error
      await showDialog({
        title: "Error",
        message: "An unexpected error occurred. Please try again.",
        actions: [
          {
            label: "OK",
            mode: "contained",
            onPress: () => {},
          },
        ],
      });
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#03045E" />
      </View>
    );
  }

  // 2. Permission denied
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

  // 3. Countdown before showing camera
  if (countdown > 0) {
    return (
      <View style={styles.container}>
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
  const responsiveStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#EEF2F6",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
    },
    contentContainer: {
      flex: 1,
      width: "100%",
      backgroundColor: "#EEF2F6",
      flexDirection: isLandscape ? "row" : "column", // Key change
    },
    cameraContainer: {
      height: isLandscape ? "100%" : "55%", // Responsive height
      width: isLandscape ? "65%" : "100%", // Responsive width
      justifyContent: "center",
      alignSelf: isLandscape ? "center" : "auto",
      alignItems: "center",
      paddingTop: isLandscape ? 20 : 50, // Responsive padding
      paddingBottom: isLandscape ? 20 : 50, // Responsive padding
    },
    cameraFrameContainer: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      flex: 1,
    },
    cameraFrame: {
      width: isLandscape ? "90%" : "80%",
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
      flex: isLandscape ? 1 : 0.8, // Responsive flex
      paddingHorizontal: isLandscape ? 20 : 40,
      backgroundColor: "transparent",
      paddingBottom: 30,
      width: isLandscape ? "35%" : "100%", // Responsive width
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      flexDirection: "column",
      justifyContent: isLandscape ? "center" : "space-between",
      shadowRadius: 1.41,
    },
    actionButtonsContainer: {
      flexDirection: isLandscape ? "column" : "row", // Stack vertically in landscape
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      gap: isLandscape ? 10 : 30,
    },
    cancelButton: {
      backgroundColor: "transparent",
      borderColor: "#03045E",
      borderWidth: 2,
      padding: 7,
      borderRadius: 5,
      alignItems: "center",
      marginTop: isLandscape ? 20 : 40,
      marginBottom: isLandscape ? 15 : 30,
      width: isLandscape ? "100%" : "40%", // Responsive width
      minHeight: 36,
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
    },
    submitButton: {
      backgroundColor: "#03045E",
      padding: 8,
      borderRadius: 5,
      alignItems: "center",
      marginTop: isLandscape ? 20 : 40,
      marginBottom: isLandscape ? 15 : 30,
      width: isLandscape ? "80%" : "30%",
      minHeight: 36,

      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
    },
    captureAgainButton: {
      backgroundColor: "#03045E",
      borderRadius: 10,
      width: "100%",
      height: 40, // Responsive height
      alignItems: "center",
      marginTop: isLandscape ? 10 : "auto",
      justifyContent: "center",
    },
    instructionsContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: isLandscape ? 10 : 20,
    },
    instructionText: {
      fontSize: isTablet ? 19 : 16,
      fontWeight: "500",
      textAlign: "center",
      color: "#001973",
    },
    cancelButtonText: {
      color: "#03045E",
      fontSize: isTablet ? 21 : 15,
      fontFamily: "OpenSans_Condensed-Bold",
    },
    submitButtonText: {
      color: "white",
      fontSize: isTablet ? 21 : 15,
      fontFamily: "OpenSans_Condensed-Bold",
    },
    // Modal styles remain mostly the same but can be made responsive
    modalContainer: {
      backgroundColor: "#FFFFFF",
      borderRadius: 15,
      width: isLandscape ? "60%" : "90%", // Responsive modal width
      maxWidth: 400,
      overflow: "hidden",
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },

    // ... rest of your existing modal styles
  });

  const getResponsiveSize = (baseSize: number) => {
    const scaleFactor = width / 375; // Standard iPhone width as base
    return baseSize * scaleFactor;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EEF2F6" }}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {showCamera && (
          <View style={responsiveStyles.contentContainer}>
            {/* Camera Container */}
            <View style={responsiveStyles.cameraContainer}>
              {!capturedPhoto ? (
                /* Camera View */
                <View style={responsiveStyles.cameraFrameContainer}>
                  <View style={[responsiveStyles.cameraFrame]}>
                    <Camera
                      key={cameraKey}
                      ref={cameraRef}
                      zoom={isTablet ? 0.6 : 0.4}
                      style={styles.camera}
                      androidPreviewViewType="texture-view"
                      device={device}
                      photoQualityBalance="speed"
                      preview={true}
                      isActive={!capturedPhoto && showCamera}
                      pixelFormat="yuv"
                      photo={true}
                      videoHdr={false}
                      photoHdr={false}
                      lowLightBoost={false}
                      videoStabilizationMode="off"
                      enableZoomGesture={false}
                      resizeMode="cover"
                      frameProcessor={
                        !capturedPhoto ? frameProcessor : undefined
                      }
                      enableDepthData={false}
                      enablePortraitEffectsMatteDelivery={false}
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
                <View style={responsiveStyles.cameraFrameContainer}>
                  <View style={responsiveStyles.cameraFrame}>
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
            <View style={responsiveStyles.controlsContainer}>
              {capturedPhoto ? (
                <>
                  {/* Submit/Cancel buttons */}
                  <View style={responsiveStyles.actionButtonsContainer}>
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
                          opacity: isLoading || isValidating ? 0.3 : 1,
                        },
                      ]}
                      disabled={isLoading || isValidating}
                      onPress={handleCancel}
                    >
                      {/* <View style={styles.buttonContent}>  */}
                      {/* <Ionicons name="close-circle" size={22} color="#03045E" /> */}
                      <StarIcon />
                      <Text style={responsiveStyles.cancelButtonText}>
                        Cancel
                      </Text>
                      {/* </View> */}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        responsiveStyles.submitButton,
                        {
                          width: "50%",
                          height: getResponsiveSize(40),
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          opacity: isValidating ? 0.3 : 1,
                        },
                      ]}
                      disabled={isLoading || isValidating}
                      onPress={() => setShowConfirmModal(true)}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#fafafa" />
                      ) : (
                        //   <View style={styles.buttonContent}>
                        <>
                          <Text style={responsiveStyles.submitButtonText}>
                            Submit
                          </Text>
                          <NextSvg />
                        </>
                        //   </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Capture Again button */}
                  <View style={styles.footerContainer}>
                    <TouchableOpacity
                      style={[
                        responsiveStyles.captureAgainButton,
                        {
                          opacity: isCaptureAgainDisabled ? 0.3 : 1,
                        },
                      ]}
                      onPress={captureAgain}
                      disabled={isCaptureAgainDisabled}
                    >
                      <View style={styles.captureAgainContent}>
                        {/* <Ionicons name="camera" size={22} color="#fafafa" /> */}
                        <CameraIcon
                          style={{ opacity: isCaptureAgainDisabled ? 0.3 : 1 }}
                        />
                        <Text style={[styles.captureAgainText]}>
                          Capture Again ({captureAttemptsLeft})
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                /* Instruction text */
                <View style={responsiveStyles.instructionsContainer}>
                  <Text style={responsiveStyles.instructionText}>
                    {isFaceDetected
                      ? "Hold still while we capture your photo"
                      : "Center your face in the frame"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={responsiveStyles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Submission</Text>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalText}>
                  Are you sure you want to submit this photo?
                </Text>
              </View>

              <View style={styles.modalFooter}>
                <>
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
                </>
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
    width: "100%",
    height: "auto",
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
    paddingTop: 0,
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
  // Add to your StyleSheet
  limitReachedText: {
    color: "#ff4444",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
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
    fontSize: isTablet ? 21 : 15,
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
    fontSize: isTablet ? 21 : 15,
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
    fontSize: 15,
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
    fontSize: 19,
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
    fontSize: 19,
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
