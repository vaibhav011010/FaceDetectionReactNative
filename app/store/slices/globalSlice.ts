import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface GlobalState {
  corporateParkName: string;
  // Add more global properties as needed, e.g.:
  // theme: "light" | "dark";
  // language: string;
}

const initialState: GlobalState = {
  corporateParkName: "",
  // theme: "light",
  // language: "en",
};

const globalSlice = createSlice({
  name: "global",
  initialState,
  reducers: {
    setCorporateParkName: (state, action: PayloadAction<string>) => {
      state.corporateParkName = action.payload;
    },
    // Add more reducers as needed, e.g.:
    // setTheme: (state, action: PayloadAction<"light" | "dark">) => {
    //   state.theme = action.payload;
    // },
  },
});

export const { setCorporateParkName } = globalSlice.actions;
export default globalSlice.reducer;
