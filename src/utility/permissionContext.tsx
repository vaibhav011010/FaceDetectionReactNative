// PermissionContext.tsx
import React, { createContext, useState, useEffect, useContext } from "react";
import { Alert } from "react-native";
import { Camera } from "react-native-vision-camera"; // or your camera lib

interface PermissionContextProps {
  hasCameraPermission: boolean | null;
}

const PermissionContext = createContext<PermissionContextProps>({
  hasCameraPermission: null,
});

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    const requestPermission = async () => {
      const status = await Camera.requestCameraPermission();
      setHasCameraPermission(status === "granted");
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission",
          "Camera permission is required for this app to function properly. Please enable it in settings."
        );
      }
    };

    requestPermission();
  }, []);

  return (
    <PermissionContext.Provider value={{ hasCameraPermission }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionContext);
