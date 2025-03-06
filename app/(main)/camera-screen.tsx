import React, { useRef, useEffect, useState } from "react";
import { StyleSheet, View, Text, Image, Animated } from "react-native";
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  PhotoFile,
} from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { Worklets } from "react-native-worklets-core";
import { useRouter } from "expo-router";

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

  // Debug state to track events
  const [debugMsg, setDebugMsg] = useState<string>("");

  // Ref to track if a countdown is already in progress
  const countdownInProgressRef = useRef<boolean>(false);

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
    if (cameraRef.current) {
      try {
        console.log("DEBUG: Attempting to take photo");
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
      } catch (error) {
        console.error("DEBUG: Failed to take photo:", error);
        setDebugMsg(`Photo error: ${error}`);
        // Reset countdown status to allow retrying
        countdownInProgressRef.current = false;
      }
    } else {
      console.log("DEBUG: Camera ref is null");
      setDebugMsg("Camera not ready");
      // Reset countdown status to allow retrying
      countdownInProgressRef.current = false;
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
  const handleSubmit = () => {
    router.replace("/checkin-screen");
  };

  return (
    <View style={styles.container}>
      {/* Debug overlay */}
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>
          Faces: {faces.length} | Count: {countdown} | Active:{" "}
          {countdownInProgressRef.current ? "Yes" : "No"}
        </Text>
        <Text style={styles.debugText}>Status: {debugMsg}</Text>
      </View>

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

      {/* Bottom section with instructions or controls */}
      <View style={styles.bottomSection}>
        {capturedPhoto ? (
          <View style={styles.buttonContainer}>
            <Text style={styles.resetText} onPress={resetCamera}>
              Retry
            </Text>
            <Text style={styles.resetText} onPress={handleSubmit}>
              Submit
            </Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEF2F6",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
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
    width: "100%",
    height: "60%",
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
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "rgba(255,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
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
    fontSize: 16,
    fontWeight: "600",
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
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  instructionText: {
    color: "#03045E",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 10,
  },
  bottomSection: {
    marginTop: 20,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#fff",
    width: "90%",
    alignItems: "center",
    elevation: 2,
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
    fontWeight: "bold",
    backgroundColor: "rgba(0,150,0,0.8)",
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 25,
    overflow: "hidden",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resetText: {
    color: "#0077B6",
    fontSize: 15,
    fontWeight: "600",
    marginHorizontal: 80,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#EEF2F6",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CameraScreen;
