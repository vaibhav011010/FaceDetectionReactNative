// app/store/slices/visitorSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppDispatch, RootState } from "../index"; // Assuming you have a store configuration
import axiosInstance from "../../api/axiosInstance"; // Adjust the path as needed
import database from "../../database/index";
import NetInfo from "@react-native-community/netinfo";
import { Q } from "@nozbe/watermelondb";

// Define the state types
interface CompanyOption {
  label: string;
  value: string;
}

interface VisitorState {
  visitorName: string;
  visitorMobile: string;
  visitingCompany: number | null | string;
  photo: string | null; // Base64 or URI of the photo
  filteredCompanies: CompanyOption[];
  isLoading: boolean;
  isLoadingCompanies: boolean;
  showCompanyDropdown: boolean;
  formSubmitted: boolean;
  error: string | null;
  // New sync-related fields
  isSyncing: boolean;
  syncError: string | null;
  mobileError: string | null;
  isMobileValid: boolean;
  visitorNameError: string | null;
  companyError: string | null;
  allCompanies: CompanyOption[];
}

// Initial state (removed temporary company data)
const initialState: VisitorState = {
  visitorName: "",
  visitorMobile: "",
  visitingCompany: null,
  allCompanies: [],
  photo: null,
  filteredCompanies: [],
  isLoading: false,
  isLoadingCompanies: false,
  showCompanyDropdown: false,
  formSubmitted: false,
  error: null,
  isSyncing: false,
  syncError: null,
  visitorNameError: null,
  companyError: null,
  mobileError: null,
  isMobileValid: true,
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
    setVisitingCompany: (state, action: PayloadAction<number | null>) => {
      state.visitingCompany = action.payload;
    },

    setMobileError: (state, action: PayloadAction<string | null>) => {
      state.mobileError = action.payload;
    },
    setIsMobileValid: (state, action: PayloadAction<boolean>) => {
      state.isMobileValid = action.payload;
    },
    setVisitorNameError: (state, action: PayloadAction<string | null>) => {
      state.visitorNameError = action.payload;
    },
    setCompanyError: (state, action: PayloadAction<string | null>) => {
      state.companyError = action.payload;
    },

    setPhoto: (state, action: PayloadAction<string>) => {
      state.photo = action.payload;
    },
    setAllCompanies: (state, action: PayloadAction<CompanyOption[]>) => {
      state.allCompanies = action.payload;
    },
    clearVisitorName: (state) => {
      state.visitorName = "";
    },
    clearVisitorMobile: (state) => {
      state.visitorMobile = "";
    },
    clearVisitingCompany: (state) => {
      state.visitingCompany = null;
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
    setFilteredCompanies: (state, action: PayloadAction<CompanyOption[]>) => {
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
    selectCompany: (state, action: PayloadAction<CompanyOption>) => {
      state.visitingCompany = Number(action.payload.value); // Ensure ID is stored as a number
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
  setMobileError,
  setIsMobileValid,
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
  setVisitorNameError,
  setCompanyError,
  syncSuccess,
  syncFailure,
  setAllCompanies,
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
export const selectMobileError = (state: RootState) =>
  state.visitor.mobileError;
export const selectVisitorNameError = (state: RootState) =>
  state.visitor.visitorNameError;
export const selectCompanyError = (state: RootState) =>
  state.visitor.companyError;

export const selectIsMobileValid = (state: RootState) =>
  state.visitor.isMobileValid;
// Export reducer
export default visitorSlice.reducer;

export const loadInitialCompanies =
  (userId: string) => async (dispatch: any) => {
    console.log(`loadInitialCompanies for user ${userId} - starting fresh`);
    dispatch(setIsLoadingCompanies(true));
    dispatch(setFilteredCompanies([])); // Start with empty array

    try {
      const isConnected = await NetInfo.fetch().then(
        (state) => state.isConnected
      );

      if (isConnected) {
        try {
          console.log(`Fetching companies from API for user ${userId}`);
          // Make sure axiosInstance has the correct auth token for current user
          const response = await axiosInstance.get(
            "/visitors/tenant_visitor_dropdown/"
          );

          console.log(`API response for user ${userId}:`, response.data);
          const companies = response.data || [];
          console.log("response data", companies);
          const mappedCompanies = companies.map(
            (company: { id: number; tenant_name: string }) => ({
              label: company.tenant_name,
              value: company.id,
              userId: userId,
            })
          );

          dispatch(setAllCompanies(mappedCompanies));

          console.log(
            `Setting ${mappedCompanies.length} companies in state for user ${userId}`
          );
          dispatch(setFilteredCompanies(mappedCompanies));

          // Try to save to DB (this appears to be failing but at least state will be correct)
          try {
            await saveCompaniesToDB(mappedCompanies, userId);
          } catch (dbError) {
            console.error(`Database save failed for user ${userId}:`, dbError);
          }
        } catch (apiError) {
          console.error(`API fetch failed for user ${userId}:`, apiError);
          // Try loading from local DB as fallback
          const localCompanies = await loadCompaniesFromDB(userId);
          dispatch(setFilteredCompanies(localCompanies));
        }
      } else {
        // Offline mode
        const localCompanies = await loadCompaniesFromDB(userId);
        dispatch(setFilteredCompanies(localCompanies));
      }
    } catch (error) {
      console.error(`Error in loadInitialCompanies for user ${userId}:`, error);
      dispatch(setFilteredCompanies([]));
    } finally {
      dispatch(setIsLoadingCompanies(false));
    }
  };
// Helper function to save companies to DB
// In your visitorSlice.ts file, update the saveCompaniesToDB function:

const saveCompaniesToDB = async (companies: any[], userId: string) => {
  console.log(
    `Attempting to save ${companies.length} companies for user ${userId} to DB`
  );

  try {
    await database.write(async () => {
      const companiesCollection = database.get("companies");

      // Fetch existing companies for this user
      const existingCompanies = await companiesCollection
        .query(Q.where("user_id", userId))
        .fetch();

      console.log(
        `Existing companies for user ${userId}:`,
        existingCompanies.length
      );

      // Delete existing records
      for (const company of existingCompanies) {
        await company.destroyPermanently();
      }

      // Create new records
      for (const comp of companies) {
        try {
          await companiesCollection.create((record: any) => {
            // Access the database column names directly
            record._raw.tenant_id = Number(comp.value);
            record._raw.tenant_name = comp.label;
            record._raw.user_id = String(userId);
          });
          console.log(`Created company: ${comp.label}`);
        } catch (createError) {
          console.error(`Failed to create company: ${comp.label}`, createError);
        }
      }
    });

    // Verify the save worked
    const companiesCollection = database.get("companies");
    const savedCompanies = await companiesCollection
      .query(Q.where("user_id", String(userId)))
      .fetch();

    console.log(
      `After save: Found ${savedCompanies.length} companies in DB for user ${userId}`
    );
  } catch (error) {
    console.error(`Failed to save companies to DB:`, error);
  }
};

// And update loadCompaniesFromDB similarly:

const loadCompaniesFromDB = async (userId: string) => {
  try {
    const companiesCollection = database.get("companies");
    const localCompanies = await companiesCollection
      .query(Q.where("user_id", String(userId)))
      .fetch();

    console.log(
      `Companies loaded from DB for user ${userId}:`,
      localCompanies.length
    );

    return localCompanies.map((comp: any) => ({
      label: comp._raw.tenant_name,
      value: comp._raw.tenant_id,
      userId: comp._raw.user_id,
    }));
  } catch (error) {
    console.error(`Error loading companies from DB for user ${userId}:`, error);
    return [];
  }
};

// Thunk function for fetching companies via API
export const fetchCompanies =
  (searchTerm: string, userId: string) => async (dispatch: any) => {
    if (!searchTerm.trim()) {
      dispatch(setFilteredCompanies([]));
      return;
    }

    dispatch(setIsLoadingCompanies(true));

    try {
      const isConnected = await NetInfo.fetch().then(
        (state) => state.isConnected
      );

      if (isConnected) {
        // Online: Try API first
        try {
          console.log(`Attempting API search for user ${userId}`);
          const response = await axiosInstance.get(
            `/visitors/tenant_visitor_dropdown/?search=${searchTerm}`
          );

          const companies = response.data || [];

          const mappedCompanies = companies.map(
            (company: { id: number; tenant_name: string }) => ({
              label: company.tenant_name,
              value: company.id,
              userId: userId,
            })
          );

          dispatch(setFilteredCompanies(mappedCompanies));
        } catch (apiError) {
          console.error("API search failed, falling back to local:", apiError);
          // Fall back to local search on API error
          await searchLocalCompanies(searchTerm, userId, dispatch);
        }
      } else {
        // Offline: Search local DB only for this user
        console.log(
          `Device offline, searching local DB for user ${userId}:`,
          searchTerm
        );
        await searchLocalCompanies(searchTerm, userId, dispatch);
      }
    } catch (error) {
      console.error(`Error in company search for user ${userId}:`, error);
      dispatch(setFilteredCompanies([]));
    } finally {
      dispatch(setIsLoadingCompanies(false));
    }
  };

// Helper function for local DB search
const searchLocalCompanies = async (
  searchTerm: string,
  userId: string,
  dispatch: any
) => {
  try {
    console.log(`Searching local DB for user ${userId}:`, searchTerm);
    const companiesCollection = database.get("companies");

    // Query companies specific to this user
    const userCompanies = await companiesCollection
      .query(Q.where("user_id", userId))
      .fetch();

    console.log(
      `Total companies in DB for user ${userId}:`,
      userCompanies.length
    );

    // Filter companies by search term
    const filteredCompanies = userCompanies.filter((company: any) => {
      const tenantName = company.tenant_name;
      return (
        typeof tenantName === "string" &&
        tenantName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    console.log("Filtered companies count:", filteredCompanies.length);

    const mappedCompanies = filteredCompanies.map((comp: any) => ({
      label: comp.tenant_name,
      value: comp.tenant_id,
      userId: comp.user_id,
    }));

    dispatch(setFilteredCompanies(mappedCompanies));
  } catch (dbError) {
    console.error(`Error searching local DB for user ${userId}:`, dbError);
    dispatch(setFilteredCompanies([]));
  }
};
export const handleAccountChange =
  (newUserId: string) => async (dispatch: any) => {
    try {
      console.log(`Handling account change to user: ${newUserId}`);

      // Reset the visitor state in Redux
      dispatch(resetForm());
      dispatch(setFilteredCompanies([]));

      // Load data specific to the new user
      dispatch(loadInitialCompanies(newUserId));

      console.log(`Successfully switched to account: ${newUserId}`);
    } catch (error) {
      console.error(`Error during account change to ${newUserId}:`, error);
    }
  };
// at the bottom of visitorSlice.ts (or in thunks.ts)
export const filterOfflineCompanies =
  (searchTerm: string) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const allCompanies = getState().visitor.allCompanies;
    const filtered = allCompanies.filter((c) =>
      c.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    dispatch(setFilteredCompanies(filtered));
  };
