// app/main/visitorform-screen.tsx
import React from "react";
import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function VisitorFormScreen() {
  const router = useRouter();

  const goToCameraScreen = () => {
    router.replace("/camera-screen");
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Visitor Form Screen</Text>
      <Button title="Next: Camera" onPress={goToCameraScreen} />
    </View>
  );
}
