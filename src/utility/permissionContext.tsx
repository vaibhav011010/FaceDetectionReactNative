// PermissionContext.tsx
import React, { createContext, useState, useEffect, useContext } from "react";
import { Alert, ActivityIndicator, View } from "react-native";
import { Camera } from "react-native-vision-camera";

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
      const granted = status === "granted";
      setHasCameraPermission(granted);

      if (!granted) {
        Alert.alert(
          "Camera Permission",
          "Camera permission is required for this app to function properly. Please enable it in settings."
        );
      }
    };

    requestPermission();
  }, []);

  if (hasCameraPermission === null) {
    // ⏳ While permission is still being checked, show a loading screen
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <PermissionContext.Provider value={{ hasCameraPermission }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionContext);
