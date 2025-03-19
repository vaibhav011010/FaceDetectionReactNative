// app/store/slices/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface User {
  id: number;
  email: string;
  corporateParkId: number;
  corporateParkName: string;
  roleId: number;
  roleName: string;
  permissions: Record<string, string[]>; // e.g., { corporate_park: ['view', 'create'], ... }
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  emailError: string | null;
  passwordError: string | null;
  isEmailValid: boolean;
  isPasswordValid: boolean;
}

const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
  emailError: null,
  passwordError: null,
  isEmailValid: true,
  isPasswordValid: true,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (
      state,
      action: PayloadAction<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>
    ) => {
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.loading = false;
      state.error = null;
      state.emailError = null;
      state.passwordError = null;
      state.isEmailValid = true;
      state.isPasswordValid = true;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
    },
    setEmailError: (state, action: PayloadAction<string | null>) => {
      state.emailError = action.payload;
      state.isEmailValid = action.payload === null;
    },
    setPasswordError: (state, action: PayloadAction<string | null>) => {
      state.passwordError = action.payload;
      state.isPasswordValid = action.payload === null;
    },
    clearEmailError: (state) => {
      state.emailError = null;
      state.isEmailValid = true;
    },
    clearPasswordError: (state) => {
      state.passwordError = null;
      state.isPasswordValid = true;
    },
    resetAuthErrors: (state) => {
      state.error = null;
      state.emailError = null;
      state.passwordError = null;
      state.isEmailValid = true;
      state.isPasswordValid = true;
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  setEmailError,
  setPasswordError,
  clearEmailError,
  clearPasswordError,
  resetAuthErrors,
} = authSlice.actions;

export default authSlice.reducer;

// Selectors
export const selectIsLoggedIn = (state: { auth: AuthState }) =>
  state.auth.isLoggedIn;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAccessToken = (state: { auth: AuthState }) =>
  state.auth.accessToken;
export const selectRefreshToken = (state: { auth: AuthState }) =>
  state.auth.refreshToken;
export const selectAuthLoading = (state: { auth: AuthState }) =>
  state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectEmailError = (state: { auth: AuthState }) =>
  state.auth.emailError;
export const selectPasswordError = (state: { auth: AuthState }) =>
  state.auth.passwordError;
export const selectIsEmailValid = (state: { auth: AuthState }) =>
  state.auth.isEmailValid;
export const selectIsPasswordValid = (state: { auth: AuthState }) =>
  state.auth.isPasswordValid;
