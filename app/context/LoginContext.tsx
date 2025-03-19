import React, { createContext, useState, ReactNode, useMemo } from "react";
import { Alert } from "react-native";
import { useAppDispatch } from "../store/hooks";
import { loginSuccess, logout } from "../store/slices/authSlice";
import database from "../database/index";
import User from "../database/models/User";
import { Q } from "@nozbe/watermelondb";

interface LoginContextType {
  isLoggedIn: boolean;
  /**
   * When logging in (value=true), userData must be provided.
   * The function checks the database for an existing record with the same API user id.
   * If found and the email matches, it updates the tokens.
   * Otherwise, it creates a new record.
   * When logging out (value=false), it clears the stored data.
   */
  setIsLoggedIn: (value: boolean, userData?: any) => Promise<void>;
}

export const LoginContext = createContext<LoginContextType>({
  isLoggedIn: false,
  setIsLoggedIn: async () => {},
});

interface LoginProviderProps {
  children: ReactNode;
}

export const LoginProvider: React.FC<LoginProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  // Force manual login on every app start.
  const [isLoggedIn, setLocalIsLoggedIn] = useState<boolean>(false);

  const setIsLoggedIn = async (value: boolean, userData?: any) => {
    if (value && userData) {
      const userCollection = database.get<User>("users");
      const apiUserId = Number(userData.user_detail.id);
      console.log("API user id:", apiUserId);

      // Query for an existing record using the API's user id.
      const existingUsers = await userCollection
        .query(Q.where("user_id", apiUserId))
        .fetch();
      console.log("Existing users count:", existingUsers.length);

      if (existingUsers.length > 0) {
        const storedUser = existingUsers[0];
        // Compare stored email with the API email.
        if (storedUser.email !== userData.user_detail.email) {
          Alert.alert(
            "Login Failed",
            "This login does not match the stored credentials."
          );
          throw new Error("Stored user does not match new credentials");
        } else {
          console.log("Matching stored user found. Updating tokens.");
          await database.write(async () => {
            await storedUser.update((user) => {
              user.accessToken = userData.access;
              user.refreshToken = userData.refresh;
            });
          });
        }
      } else {
        console.log("No matching user found. Creating a new record.");
        await database.write(async () => {
          await userCollection.create((user) => {
            // Save the API user id in the dedicated column.
            user.userId = apiUserId;
            user.email = userData.user_detail.email;
            user.corporateParkId = userData.user_detail.corporate_park_id;
            user.corporateParkName =
              userData.corporate_park_detail.corporate_park_name;
            user.roleId = userData.role_detail.id;
            user.roleName = userData.role_detail.role_name;
            user.permissions = JSON.stringify(userData.permission);
            user.accessToken = userData.access;
            user.refreshToken = userData.refresh;
          });
        });
      }
      // Dispatch loginSuccess to update Redux state for this session.
      dispatch(
        loginSuccess({
          user: {
            id: apiUserId,
            email: userData.user_detail.email,
            corporateParkId: Number(userData.user_detail.corporate_park_id),
            corporateParkName:
              userData.corporate_park_detail.corporate_park_name,
            roleId: Number(userData.role_detail.id),
            roleName: userData.role_detail.role_name,
            permissions: userData.permission,
          },
          accessToken: userData.access,
          refreshToken: userData.refresh,
        })
      );
    } else {
      // Logging out: clear all stored user records.
      const userCollection = database.get<User>("users");
      const storedUsers = await userCollection.query().fetch();
      await database.write(async () => {
        for (const user of storedUsers) {
          await user.destroyPermanently();
        }
      });
      dispatch(logout());
    }
    setLocalIsLoggedIn(value);
  };

  const contextValue = useMemo(
    () => ({ isLoggedIn, setIsLoggedIn }),
    [isLoggedIn]
  );
  return (
    <LoginContext.Provider value={contextValue}>
      {children}
    </LoginContext.Provider>
  );
};
