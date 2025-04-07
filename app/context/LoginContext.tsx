import React, {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useEffect,
} from "react";
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
  const [isLoggedIn, setLocalIsLoggedIn] = useState<boolean>(false);

  // Auto-login on app start
  // useEffect(() => {
  //   const bootstrap = async () => {
  //     try {
  //       const userCollection = database.get<User>("users");
  //       const loggedInUsers = await userCollection
  //         .query(Q.where("is_logged_in", true))
  //         .fetch();

  //       if (loggedInUsers.length > 0) {
  //         const user = loggedInUsers[0];
  //         console.log("Auto-login with user:", user.email);

  //         dispatch(
  //           loginSuccess({
  //             user: {
  //               id: Number(user.userId),
  //               email: user.email,
  //               corporateParkId: user.corporateParkId,
  //               corporateParkName: user.corporateParkName,
  //               roleId: user.roleId,
  //               roleName: user.roleName,
  //               permissions: user.permissions
  //                 ? JSON.parse(user.permissions)
  //                 : {},
  //             },
  //             accessToken: user.accessToken,
  //             refreshToken: user.refreshToken,
  //           })
  //         );
  //         setLocalIsLoggedIn(true);
  //       }
  //     } catch (err) {
  //       console.error("Auto-login failed:", err);
  //     }
  //   };

  //   bootstrap();
  // }, []);

  const setIsLoggedIn = async (value: boolean, userData?: any) => {
    const userCollection = database.get<User>("users");

    if (value && userData) {
      const apiUserId = Number(userData.user_detail.id);
      const existingUsers = await userCollection
        .query(Q.where("user_id", apiUserId))
        .fetch();

      // Set all users to logged out first
      await database.write(async () => {
        const allUsers = await userCollection.query().fetch();
        for (const u of allUsers) {
          await u.update((user) => {
            user.isLoggedIn = false;
          });
        }
      });

      if (existingUsers.length > 0) {
        const storedUser = existingUsers[0];
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
              user.isLoggedIn = true; // ✅
            });
          });
        }
      } else {
        console.log("No matching user found. Creating a new record.");
        await database.write(async () => {
          await userCollection.create((user) => {
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
            user.isLoggedIn = true; // ✅
          });
        });
      }

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
      // Logging out: set all users as not logged in (don't delete)
      const storedUsers = await userCollection.query().fetch();
      await database.write(async () => {
        for (const user of storedUsers) {
          await user.update((u) => {
            u.isLoggedIn = false; // ✅
          });
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
