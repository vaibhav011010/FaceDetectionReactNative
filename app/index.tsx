// app/index.tsx
import React, { useEffect, useContext } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  InteractionManager,
} from "react-native";
import { useRouter } from "expo-router";
import { LoginContext } from "./context/LoginContext";

export default function SplashScreen() {
  const router = useRouter();
  const { isLoggedIn } = useContext(LoginContext);

  useEffect(() => {
    // Add a slight delay to ensure the root layout is mounted
    const navigationTask = InteractionManager.runAfterInteractions(() => {
      if (isLoggedIn) {
        router.replace("/checkin-screen");
      } else {
        router.replace("/login");
      }
    });

    return () => navigationTask.cancel();
  }, [isLoggedIn]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FAFAFA",
      }}
    ></View>
  );
}

// // app/index.tsx
// import React, { useEffect, useContext } from "react";
// import {
//   View,
//   Text,
//   ActivityIndicator,
//   InteractionManager,
// } from "react-native";
// import { useRouter } from "expo-router";
// import { LoginContext } from "./context/LoginContext";
// import {
//   startSessionMonitoring,
//   stopSessionMonitoring,
// } from "./api/sessionManager";
// import database from "./database";
// import User from "./database/models/User";
// import { Q } from "@nozbe/watermelondb";

// export default function SplashScreen() {
//   const router = useRouter();
//   const { isLoggedIn } = useContext(LoginContext);

//   useEffect(() => {
//     // Check if any user is logged in from the database
//     const checkLoginStatus = async () => {
//       const users = await database
//         .get<User>("users")
//         .query(Q.where("is_logged_in", true))
//         .fetch();

//       if (users.length > 0) {
//         // Start monitoring if user is logged in
//         startSessionMonitoring();
//       }
//     };

//     checkLoginStatus();

//     // Add a slight delay to ensure the root layout is mounted
//     const navigationTask = InteractionManager.runAfterInteractions(() => {
//       if (isLoggedIn) {
//         router.replace("/checkin-screen");
//       } else {
//         router.replace("/login");
//       }
//     });

//     return () => {
//       navigationTask.cancel();
//       // Stop monitoring when component unmounts
//       stopSessionMonitoring();
//     };
//   }, [isLoggedIn]);

//   return (
//     <View
//       style={{
//         flex: 1,
//         justifyContent: "center",
//         alignItems: "center",
//         backgroundColor: "white",
//       }}
//     >
//       <ActivityIndicator size="large" color="#0000ff" />
//     </View>
//   );
// }
