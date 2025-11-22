import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface GlobalState {
  corporateParkName: string;
  corporateParkId: number | null;
  buildingId: number | null;
  // Add more global properties as needed, e.g.:
  // theme: "light" | "dark";
  // language: string;
}

const initialState: GlobalState = {
  corporateParkName: "",
  corporateParkId: null,
  buildingId: null,
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
    setCorporateParkID: (state, action: PayloadAction<number>) => {
      state.corporateParkId = action.payload;
    },
    setBuildingID(state, action: PayloadAction<number>) {
      // ✅ new
      state.buildingId = action.payload;
    },
    // you can add other reducers later if needed
  },
});

export const { setCorporateParkName, setCorporateParkID, setBuildingID } =
  globalSlice.actions;
export default globalSlice.reducer;
