// app/store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import visitorReducer from "./slices/visitorSlice";
import globalReducer from "./slices/globalSlice";
export const store = configureStore({
  reducer: {
    auth: authReducer,
    visitor: visitorReducer,
    global: globalReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
