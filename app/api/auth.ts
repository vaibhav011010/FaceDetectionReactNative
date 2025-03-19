// app/api/auth.ts
import axiosInstance from "./axiosInstance";
import database from "../database";
import User from "../database/models/User";
import { Q } from "@nozbe/watermelondb";

export const login = async (email: string, password: string) => {
  const response = await axiosInstance.post(`/accounts/login/`, {
    email,
    password,
  });

  // Destructure the API response
  const { refresh, access, data } = response.data;
  const { user_detail, corporate_park_detail, role_detail, permission } = data;

  await database.write(async () => {
    const userCollection = database.get<User>("users");
    // Query for an existing record with the API user id
    const existingUsers = await userCollection
      .query(Q.where("user_id", user_detail.id))
      .fetch();

    if (existingUsers.length > 0) {
      // If a matching record exists, update its tokens and other fields if needed
      await existingUsers[0].update((user) => {
        user.accessToken = access;
        user.refreshToken = refresh;
        // Optionally update other fields to ensure data consistency
        user.email = user_detail.email;
        user.corporateParkId = corporate_park_detail.id;
        user.corporateParkName = corporate_park_detail.corporate_park_name;
        user.roleId = role_detail.id;
        user.roleName = role_detail.role_name;
        user.permissions = JSON.stringify(permission);
      });
    } else {
      // If no matching record exists, create a new one
      await userCollection.create((user) => {
        // Save the API's user id into the dedicated column "user_id"
        user.userId = user_detail.id;
        user.email = user_detail.email;
        user.corporateParkId = corporate_park_detail.id;
        user.corporateParkName = corporate_park_detail.corporate_park_name;
        user.roleId = role_detail.id;
        user.roleName = role_detail.role_name;
        user.permissions = JSON.stringify(permission); // Save permissions as JSON string
        user.accessToken = access;
        user.refreshToken = refresh;
      });
    }
  });

  // Return all fields needed by the login handler
  return {
    access,
    refresh,
    user_detail,
    corporate_park_detail,
    role_detail,
    permission,
  };
};

// Fetch stored access token
export const getAccessToken = async () => {
  const users = await database.get<User>("users").query().fetch();
  if (users.length === 0) return null;
  return users[0].accessToken;
};

// Refresh access token when expired
export const refreshAccessToken = async () => {
  const users = await database.get<User>("users").query().fetch();
  if (users.length === 0) return null;

  const refreshToken = users[0].refreshToken;
  try {
    const response = await axiosInstance.post(`/refresh/`, {
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
