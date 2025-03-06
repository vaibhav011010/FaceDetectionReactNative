// app/main/checkin-screen.tsx
import React from "react";
import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function CheckinScreen() {
  const router = useRouter();

  const goToVisitorForm = () => {
    router.replace("/visitorform-screen");
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Checkin Screen</Text>
      <Button title="Next: Visitor Form" onPress={goToVisitorForm} />
    </View>
  );
}
