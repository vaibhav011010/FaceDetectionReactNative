// contexts/UserContext.tsx
import React, { createContext, useContext, ReactNode } from "react";

interface UserData {
  id: number;
  email: string;
  corporate_park_id: number;
  user_type: string;
  // Add other fields as needed
}

interface AuthResponse {
  user_detail: UserData;
  corporate_park_detail: any;
  role_detail: any;
  permission: any;
}

interface UserContextType {
  user: UserData | null;
  authData: AuthResponse | null;
  setUserData: (data: AuthResponse) => void;
  clearUserData: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [authData, setAuthData] = React.useState<AuthResponse | null>(null);

  const setUserData = (data: AuthResponse) => {
    setAuthData(data);
    // You might want to persist this data to AsyncStorage here
  };

  const clearUserData = () => {
    setAuthData(null);
    // Clear from AsyncStorage if needed
  };

  return (
    <UserContext.Provider
      value={{
        user: authData?.user_detail || null,
        authData,
        setUserData,
        clearUserData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
