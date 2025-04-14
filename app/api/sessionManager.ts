import NetInfo from "@react-native-community/netinfo";
import { store } from "../store";
import { logout } from "../store/slices/authSlice";
import axiosInstance from "./axiosInstance";
import { getAccessToken } from "./auth";
import database from "../database";
import User from "../database/models/User";
import { Q } from "@nozbe/watermelondb";
import { Alert } from "react-native";

let sessionCheckInterval: NodeJS.Timeout | null = null;

// Check session validity on the server
const checkSessionValidity = async () => {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const response = await axiosInstance.get("/accounts/check-session/", {
      headers: { Authorization: `JWT ${token}` },
    });

    const { isLoggedIn, data } = response.data;
    const planExpireDate = new Date(
      data.corporate_park_detail.plan_expire_datetime
    );

    if (!isLoggedIn) {
      await performLogout(
        "You have been logged out because you logged in on another device."
      );
      return;
    }

    if (planExpireDate < new Date()) {
      await performLogout(
        "Your plan has expired. Please contact administrator."
      );
      return;
    }
  } catch (error: any) {
    console.log("Session check failed:", error);
    // Only logout on specific errors, not network errors
    if (error.response && error.response.status === 401) {
      await performLogout("Your session has expired.");
    }
  }
};

// Perform logout with reason
const performLogout = async (reason: string) => {
  // Update database
  const userCollection = database.get<User>("users");
  const loggedInUsers = await userCollection
    .query(Q.where("is_logged_in", true))
    .fetch();

  await database.write(async () => {
    for (const user of loggedInUsers) {
      await user.update((u) => {
        u.isLoggedIn = false;
      });
    }
  });

  // Dispatch logout action
  store.dispatch(logout());

  // Show reason to user
  Alert.alert("Session Ended", reason);
};

// Start monitoring network and session
export const startSessionMonitoring = () => {
  // Clear any existing intervals
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  // Set up network listener
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      // Check session immediately when coming online
      checkSessionValidity();
    }
  });

  // Regular interval check when app is running (every 5 minutes)
  sessionCheckInterval = setInterval(() => {
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        checkSessionValidity();
      }
    });
  }, 5 * 60 * 1000); // 5 minutes
};

// Stop monitoring
export const stopSessionMonitoring = () => {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
};
