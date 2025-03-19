// app/store/slices/visitorSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../index"; // Assuming you have a store configuration
import axiosInstance from "../../api/axiosInstance"; // Adjust the path as needed
import database from "../../database/index";

// Define the state types
interface Company {
  label: string;
  value: string;
}

interface VisitorState {
  visitorName: string;
  visitorMobile: string;
  visitingCompany: string | number;
  photo: string | null; // Base64 or URI of the photo
  filteredCompanies: Company[];
  isLoading: boolean;
  isLoadingCompanies: boolean;
  showCompanyDropdown: boolean;
  formSubmitted: boolean;
  error: string | null;
  // New sync-related fields
  isSyncing: boolean;
  syncError: string | null;
}

// Initial state (removed temporary company data)
const initialState: VisitorState = {
  visitorName: "",
  visitorMobile: "",
  visitingCompany: "",

  photo: null,
  filteredCompanies: [],
  isLoading: false,
  isLoadingCompanies: false,
  showCompanyDropdown: false,
  formSubmitted: false,
  error: null,
  isSyncing: false,
  syncError: null,
};

// Create the slice
const visitorSlice = createSlice({
  name: "visitor",
  initialState,
  reducers: {
    setVisitorName: (state, action: PayloadAction<string>) => {
      state.visitorName = action.payload;
    },
    setVisitorMobile: (state, action: PayloadAction<string>) => {
      state.visitorMobile = action.payload;
    },
    setVisitingCompany: (state, action: PayloadAction<string>) => {
      state.visitingCompany = action.payload;
    },
    setPhoto: (state, action: PayloadAction<string>) => {
      state.photo = action.payload;
    },
    clearVisitorName: (state) => {
      state.visitorName = "";
    },
    clearVisitorMobile: (state) => {
      state.visitorMobile = "";
    },
    clearVisitingCompany: (state) => {
      state.visitingCompany = "";
      state.filteredCompanies = [];
    },
    clearPhoto: (state) => {
      state.photo = null;
    },
    resetForm: (state) => {
      return {
        ...initialState,
        photo: null, // Explicitly nullify photo
      };
    },
    setCompanyDropdownVisible: (state, action: PayloadAction<boolean>) => {
      state.showCompanyDropdown = action.payload;
    },
    // Remove filtering based on local companies.
    // Instead, we now use an API to fetch companies and update filteredCompanies.
    setFilteredCompanies: (state, action: PayloadAction<Company[]>) => {
      state.filteredCompanies = action.payload;
    },
    startLoadingCompanies: (state) => {
      state.isLoadingCompanies = true;
    },
    setIsLoadingCompanies: (state, action: PayloadAction<boolean>) => {
      state.isLoadingCompanies = action.payload;
    },
    finishLoadingCompanies: (state) => {
      state.isLoadingCompanies = false;
    },
    // When a company is selected, store its id (value) instead of the label
    // In your Redux slice
    selectCompany: (state, action: PayloadAction<Company>) => {
      state.visitingCompany = String(action.payload.value); // Convert to string
      state.showCompanyDropdown = false;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    submitVisitorForm: (state) => {
      state.isLoading = true;
    },
    submitVisitorFormSuccess: (state) => {
      state.isLoading = false;
      state.formSubmitted = true;
    },
    // New reducers for syncing visitor data
    startSync: (state) => {
      state.isSyncing = true;
      state.syncError = null;
    },
    syncSuccess: (state) => {
      state.isSyncing = false;
      state.syncError = null;
    },
    syncFailure: (state, action: PayloadAction<string>) => {
      state.isSyncing = false;
      state.syncError = action.payload;
    },
    clearSyncError: (state) => {
      state.syncError = null;
    },
  },
});

// Export actions
export const {
  setVisitorName,
  setVisitorMobile,
  setVisitingCompany,
  setPhoto,
  clearVisitorName,
  clearVisitorMobile,
  clearVisitingCompany,
  clearPhoto,
  resetForm,
  setCompanyDropdownVisible,
  setFilteredCompanies,
  startLoadingCompanies,
  finishLoadingCompanies,
  selectCompany,
  setIsLoading,
  setIsLoadingCompanies,
  submitVisitorForm,
  submitVisitorFormSuccess,
  startSync,
  syncSuccess,
  syncFailure,
  clearSyncError,
} = visitorSlice.actions;

// Export selectors
export const selectVisitorName = (state: RootState) =>
  state.visitor.visitorName;
export const selectVisitorMobile = (state: RootState) =>
  state.visitor.visitorMobile;
export const selectVisitingCompany = (state: RootState) =>
  state.visitor.visitingCompany;
export const selectPhoto = (state: RootState) => state.visitor.photo;
export const selectIsLoading = (state: RootState) => state.visitor.isLoading;
export const selectIsLoadingCompanies = (state: RootState) =>
  state.visitor.isLoadingCompanies;
export const selectFilteredCompanies = (state: RootState) =>
  state.visitor.filteredCompanies;
export const selectShowCompanyDropdown = (state: RootState) =>
  state.visitor.showCompanyDropdown;
export const selectFormSubmitted = (state: RootState) =>
  state.visitor.formSubmitted;
export const selectError = (state: RootState) => state.visitor.error;
export const selectIsSyncing = (state: RootState) => state.visitor.isSyncing;
export const selectSyncError = (state: RootState) => state.visitor.syncError;

// Export reducer
export default visitorSlice.reducer;

// Thunk function for fetching companies via API
export const fetchCompanies = (searchTerm: string) => async (dispatch: any) => {
  if (!searchTerm.trim()) {
    dispatch(setFilteredCompanies([]));
    console.log("Search term is empty, clearing company list.");
    return;
  }

  dispatch(setIsLoadingCompanies(true));
  console.log(`Fetching companies for search term: "${searchTerm}"`);

  try {
    const response = await axiosInstance.get(
      `/visitors/tenant_visitor_dropdown/?search=${searchTerm}`
    );
    console.log("API Response:", response.data);

    const companies = response.data || [];
    console.log("Extracted Companies:", companies);

    const mappedCompanies = companies.map(
      (company: { id: number; tenant_name: string }) => ({
        label: company.tenant_name,
        value: String(company.id), // Convert to string for consistency
      })
    );
    console.log("Mapped Companies:", mappedCompanies);

    // Save the mapped companies to the local database
    await database.write(async () => {
      const companiesCollection = database.get("companies");
      // Option 1: Clear existing companies (if you want to refresh on each fetch)
      const existingCompanies = await companiesCollection.query().fetch();
      for (const existing of existingCompanies) {
        await existing.destroyPermanently();
      }
      // Option 2: Alternatively, update or merge records instead of clearing
      for (const comp of mappedCompanies) {
        await companiesCollection.create((record: any) => {
          record.label = comp.label;
          record.value = comp.value;
        });
      }
    });

    dispatch(setFilteredCompanies(mappedCompanies));
  } catch (error: any) {
    console.error("Error fetching companies from API:", error.message || error);

    // In case of a network error, load companies from the local database
    try {
      const companiesCollection = database.get("companies");
      const localCompanies = await companiesCollection.query().fetch();
      const mappedLocalCompanies = localCompanies.map((comp: any) => ({
        label: comp.label,
        value: comp.value,
      }));
      console.log("Loaded companies from local DB:", mappedLocalCompanies);
      dispatch(setFilteredCompanies(mappedLocalCompanies));
    } catch (dbError) {
      console.error("Error fetching companies from local DB:", dbError);
      dispatch(setFilteredCompanies([]));
    }
  } finally {
    dispatch(setIsLoadingCompanies(false));
    console.log("Finished fetching companies.");
  }
};
