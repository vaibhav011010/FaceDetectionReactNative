// app/api/auth.ts
import axiosInstance from "./axiosInstance";
import database from "../database";
import User from "../database/models/User";
import { Q } from "@nozbe/watermelondb";
import axiosBase from "./axiosBase";

export const login = async (email: string, password: string) => {
  const response = await axiosInstance.post(`/accounts/login/`, {
    email,
    password,
  });

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
  const { user_detail, corporate_park_detail, role_detail, permission } = data;

  let isFirstLogin = false;

  await database.write(async () => {
    const userCollection = database.get<User>("users");
    // Query for an existing record with the API user id
    const existingUsers = await userCollection
      .query(Q.where("user_id", user_detail.id))
      .fetch();

    if (existingUsers.length > 0) {
      // User exists - check if isFirstLogin is already set
      isFirstLogin = existingUsers[0].isFirstLogin === true;

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
        user.isFirstLogin = true; // Set first login flag for new users
      });
    }
  });

  // Return all fields including our client-side first login flag
  return {
    access,
    refresh,
    user_detail,
    corporate_park_detail,
    role_detail,
    permission,
    isFirstLogin,
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
    const response = await axiosBase.post(`/api/token/refresh/`, {
      refresh: refreshToken,
    });
    const newAccessToken = response.data.access;

    await database.write(async () => {
      await users[0].update((user) => {
        user.accessToken = newAccessToken;
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
          user.isFirstLogin = false; // Set to false after password change
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
