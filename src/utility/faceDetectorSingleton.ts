// hooks/useSharedFaceDetector.ts
import { useFaceDetector } from "react-native-vision-camera-face-detector";

export const useSharedFaceDetector = () => {
  // ✅ Call useFaceDetector directly at the top level
  return useFaceDetector({
    performanceMode: "fast",
    minFaceSize: 0.1,
    landmarkMode: "none",
    contourMode: "none",
  });
};
