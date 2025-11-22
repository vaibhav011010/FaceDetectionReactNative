// app/api/auth.ts
import { AxiosRequestConfig } from "axios";
import axiosInstance from "./axiosInstance";
import { withTimeout } from "@/src/utility/withTimeout";
import database from "../database";
import User from "../database/models/User";
import { Q } from "@nozbe/watermelondb";
import axiosBase from "./axiosBase";

export const login = async (
  email: string,
  password: string,
  config: AxiosRequestConfig = {}
) => {
  const response = await withTimeout(
    (signal) =>
      axiosBase.post(
        `/accounts/login/`,
        { email, password },
        { ...config, signal }
      ),
    4000 // 4 seconds timeout
  );
  // // Check if user is already logged in on another device
  // if (response.data.isLoggedIn === true) {
  //   throw new Error("ALREADY_LOGGED_IN");
  // }

  // Check if plan has expired
  const planExpireDate = new Date(
    response.data.data.corporate_park_detail.plan_expire_datetime
  );
  if (planExpireDate < new Date()) {
    throw new Error("PLAN_EXPIRED");
  }
  // Destructure the API response
  const { refresh, access, data } = response.data;
  const {
    user_detail,
    corporate_park_detail,
    role_detail,
    permission,
    building_detail,
  } = data;

  const needsPasswordChange = user_detail.change_password === false;

  let isFirstLogin = false;

  await database.write(async () => {
    const userCollection = database.get<User>("users");
    // Query for an existing record with the API user id
    const existingUsers = await userCollection
      .query(Q.where("user_id", user_detail.id))
      .fetch();

    if (existingUsers.length > 0) {
      // User exists - check if isFirstLogin is already set
      //isFirstLogin = existingUsers[0].isFirstLogin === true;

      await existingUsers[0].update((user) => {
        user.accessToken = access;
        user.refreshToken = refresh;
        user.email = user_detail.email;
        user.corporateParkId = corporate_park_detail.id;
        user.corporateParkName = corporate_park_detail.corporate_park_name;
        user.roleId = role_detail.id;
        user.roleName = role_detail.role_name;
        user.permissions = JSON.stringify(permission);
        user.isLoggedIn = true;
        user.needsPasswordChange = needsPasswordChange; // ✅ Updated field
        // Don't change isFirstLogin here, keep its existing value
      });
    } else {
      // This is a new user in our local database - consider this a first login
      isFirstLogin = true;

      await userCollection.create((user) => {
        user.userId = user_detail.id;
        user.email = user_detail.email;
        user.corporateParkId = corporate_park_detail.id;
        user.corporateParkName = corporate_park_detail.corporate_park_name;
        user.roleId = role_detail.id;
        user.roleName = role_detail.role_name;
        user.permissions = JSON.stringify(permission);
        user.accessToken = access;
        user.refreshToken = refresh;
        user.isLoggedIn = true;
        user.needsPasswordChange = needsPasswordChange; // ✅ New user
      });
    }
  });

  // Return all fields including our client-side first login flag
  return {
    access,
    refresh,
    user_detail,
    corporate_park_detail,
    building_detail,
    role_detail,
    permission,
    needsPasswordChange,
  };
};

// Fetch stored access token
export const getAccessToken = async () => {
  const users = await database
    .get<User>("users")
    .query(Q.where("is_logged_in", true))
    .fetch();

  if (users.length === 0) return null;
  return users[0].accessToken;
};

// Refresh access token when expired
export const refreshAccessToken = async () => {
  const users = await database
    .get<User>("users")
    .query(Q.where("is_logged_in", true))
    .fetch();

  if (users.length === 0) return null;

  const refreshToken = users[0].refreshToken;
  try {
    console.log("refresh token", refreshToken);
    const response = await axiosBase.post(`/api/token/refresh/`, {
      refresh: refreshToken,
    });
    const newAccessToken = response.data.access;

    const newRefreshToken = response.data.refresh || refreshToken;
    await database.write(async () => {
      await users[0].update((user) => {
        user.accessToken = newAccessToken;
        if (response.data.refresh) {
          user.refreshToken = newRefreshToken;
        }
      });
    });

    return newAccessToken;
  } catch (error) {
    console.error("Failed to refresh token", error);
    return null;
  }
};
// Add to your auth.ts
export const changePassword = async (
  oldPassword: string,
  newPassword: string,
  confirmPassword: string
) => {
  // Get the current access token
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("No access token found, please login again");
  }

  try {
    const response = await axiosInstance.post("/accounts/change-password/", {
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });

    // If password change is successful, update the isFirstLogin flag
    await database.write(async () => {
      const userCollection = database.get<User>("users");
      const loggedInUsers = await userCollection
        .query(Q.where("is_logged_in", true))
        .fetch();

      if (loggedInUsers.length > 0) {
        await loggedInUsers[0].update((user) => {
          user.needsPasswordChange = false;
          user.isLoggedIn = false;
        });
      }
    });

    return response.data;
  } catch (error) {
    console.error("Password change failed:", error);
    throw error;
  }
};
// app/api/auth.ts

export const getCurrentUserId = async (): Promise<number> => {
  const users = await database
    .get<User>("users")
    .query(Q.where("is_logged_in", true))
    .fetch();
  if (!users.length) throw new Error("No logged-in user");
  return users[0].userId;
};
// Return the stored tokens for a specific userId
export const getTokensForUser = async (userId: number) => {
  const users = await database
    .get<User>("users")
    .query(Q.where("user_id", userId))
    .fetch();
  if (!users.length) throw new Error(`No user ${userId}`);
  return {
    accessToken: users[0].accessToken,
    refreshToken: users[0].refreshToken,
  };
};

// Refresh only that user’s token
export const refreshAccessTokenForUser = async (userId: number) => {
  const { refreshToken } = await getTokensForUser(userId);
  const response = await axiosBase.post("/api/token/refresh/", {
    refresh: refreshToken,
  });
  const newAccess = response.data.access;
  const newRefresh = response.data.refresh || refreshToken;

  // persist back into that user record
  await database.write(async () => {
    const users = await database
      .get<User>("users")
      .query(Q.where("user_id", userId))
      .fetch();
    await users[0].update((u) => {
      u.accessToken = newAccess;
      if (response.data.refresh) u.refreshToken = newRefresh;
    });
  });

  return newAccess;
};
