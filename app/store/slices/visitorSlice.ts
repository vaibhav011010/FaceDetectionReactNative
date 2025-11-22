// app/store/slices/visitorSlice.ts
import { createSlice, Dispatch, PayloadAction } from "@reduxjs/toolkit";
import { AppDispatch, RootState } from "../index"; // Assuming you have a store configuration
import axiosInstance from "../../api/axiosInstance"; // Adjust the path as needed
import database from "../../database/index";
import NetInfo from "@react-native-community/netinfo";
import { Q } from "@nozbe/watermelondb";

// Define the state types
interface CompanyOption {
  label: string;
  value: string;
  tenantUnitNumber: string;
  isActive?: boolean;
  userId?: string;
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
  lastSyncTime: number | null; // Track last API sync
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
  lastSyncTime: null,
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
        allCompanies: state.allCompanies,
        lastSyncTime: state.lastSyncTime,
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

// Helper function to save companies to DB with better error handling
const saveCompaniesToDB = async (companies: any[], userId: string) => {
  console.log(`Saving ${companies.length} companies for user ${userId} to DB`);

  try {
    await database.write(async () => {
      const companiesCollection = database.get("companies");

      // Clear existing companies for this user
      const existingCompanies = await companiesCollection
        .query(Q.where("user_id", userId))
        .fetch();

      for (const company of existingCompanies) {
        await company.destroyPermanently();
      }

      // Create new records using proper WatermelonDB API
      for (const comp of companies) {
        try {
          await companiesCollection.create((record: any) => {
            record.tenantId = Number(comp.value); // Keep main ID
            record.tenantName = comp.label;
            record.tenantUnitNumber = comp.tenantUnitNumber; // Save tenant unit number
            record.userId = String(userId);
            record.isActive = comp.isActive;
          });
        } catch (createError) {
          console.error(`Failed to create company: ${comp.label}`, createError);
        }
      }
    });

    console.log(`Successfully saved companies for user ${userId}`);
  } catch (error) {
    console.error(`Failed to save companies to DB:`, error);
    throw error;
  }
};

// Enhanced function to load companies from DB with better search support
const loadCompaniesFromDB = async (
  userId: string
): Promise<CompanyOption[]> => {
  try {
    const companiesCollection = database.get("companies");
    const localCompanies = await companiesCollection
      .query(Q.where("user_id", String(userId)), Q.where("is_active", true))
      .fetch();

    console.log(
      `Loaded ${localCompanies.length} companies from DB for user ${userId}`
    );

    return localCompanies.map((comp: any) => ({
      label: comp.tenantName,
      value: String(comp.tenantId), // Keep main ID as value
      tenantUnitNumber: comp.tenantUnitNumber, // Add tenant unit number
      userId: comp.userId,
      isActive: comp.isActive,
    }));
  } catch (error) {
    console.error(`Error loading companies from DB for user ${userId}:`, error);
    return [];
  }
};

// Background API sync function
const backgroundSyncCompanies = async (userId: string, dispatch: any) => {
  try {
    const isConnected = await NetInfo.fetch().then(
      (state) => state.isConnected
    );

    if (!isConnected) {
      console.log(
        `Device offline, skipping background sync for user ${userId}`
      );
      return;
    }

    console.log(`Starting background sync for user ${userId}`);
    dispatch(startSync());

    const response = await axiosInstance.get(
      "/visitors/tenant_visitor_dropdown/"
    );
    const companies = response.data || [];

    // Updated mapping to include tenant_unit_number
    const mappedCompanies = companies.map(
      (company: {
        id: number;
        tenant_name: string;
        tenant_unit_number: string;
        status: boolean;
      }) => ({
        label: company.tenant_name,
        value: String(company.id), // Keep main ID
        tenantUnitNumber: company.tenant_unit_number, // Add tenant unit number
        userId: userId,
        isActive: company.status,
      })
    );

    // Save to database
    await saveCompaniesToDB(mappedCompanies, userId);

    // Update Redux state
    dispatch(setAllCompanies(mappedCompanies));
    dispatch(syncSuccess());

    console.log(`Background sync completed for user ${userId}`);
  } catch (error: any) {
    console.error(`Background sync failed for user ${userId}:`, error);
    dispatch(syncFailure(error.message || "Background sync failed"));
  }
};

// Main function to load companies - Database first approach
export const loadInitialCompanies =
  (userId: string) => async (dispatch: any) => {
    console.log(
      `Loading companies for user ${userId} - Database first approach`
    );
    dispatch(setIsLoadingCompanies(true));

    try {
      // Step 1: Always try to load from database first
      const localCompanies = await loadCompaniesFromDB(userId);

      if (localCompanies.length > 0) {
        // Database has data, use it immediately
        console.log(
          `Found ${localCompanies.length} companies in database for user ${userId}`
        );
        dispatch(setAllCompanies(localCompanies));
        dispatch(setFilteredCompanies(localCompanies));

        // Start background sync to update database with fresh data
        backgroundSyncCompanies(userId, dispatch);
      } else {
        // Database is empty, try API as fallback
        console.log(`No companies in database for user ${userId}, trying API`);

        const isConnected = await NetInfo.fetch().then(
          (state) => state.isConnected
        );

        if (isConnected) {
          try {
            const response = await axiosInstance.get(
              "/visitors/tenant_visitor_dropdown/"
            );
            const companies = response.data || [];

            // Updated mapping to include tenant_unit_number
            const mappedCompanies = companies.map(
              (company: {
                id: number;
                tenant_name: string;
                tenant_unit_number: string;
                status: boolean;
              }) => ({
                label: company.tenant_name,
                value: String(company.id), // Keep main ID
                tenantUnitNumber: company.tenant_unit_number, // Add tenant unit number
                userId: userId,
                isActive: company.status,
              })
            );

            // Save to database and update state
            await saveCompaniesToDB(mappedCompanies, userId);

            const activeCompanies = mappedCompanies.filter(
              (c: any) => c.isActive
            );
            dispatch(setAllCompanies(activeCompanies));
            dispatch(setFilteredCompanies(activeCompanies));

            console.log(
              `Loaded ${mappedCompanies.length} companies from API for user ${userId}`
            );
          } catch (apiError) {
            console.error(`API fallback failed for user ${userId}:`, apiError);
            dispatch(setFilteredCompanies([]));
          }
        } else {
          console.log(`Device offline and no local data for user ${userId}`);
          dispatch(setFilteredCompanies([]));
        }
      }
    } catch (error) {
      console.error(`Error in loadInitialCompanies for user ${userId}:`, error);
      dispatch(setFilteredCompanies([]));
    } finally {
      dispatch(setIsLoadingCompanies(false));
    }
  };

// Enhanced search function - searches by both name and tenant_unit_number
const searchCompaniesInDB = async (
  searchTerm: string,
  userId: string
): Promise<CompanyOption[]> => {
  try {
    const companiesCollection = database.get("companies");
    const allUserCompanies = await companiesCollection
      .query(
        Q.where("user_id", userId),
        Q.where("is_active", true) // ✅ Only search in active companies
      )
      .fetch();

    console.log(
      `Searching in ${allUserCompanies.length} companies for "${searchTerm}"`
    );

    const filteredCompanies = allUserCompanies.filter((company: any) => {
      const tenantName = company.tenantName?.toLowerCase() || "";
      const tenantUnitNumber = String(company.tenantUnitNumber || "");
      const searchLower = searchTerm.toLowerCase();

      // Search by both name and tenant unit number
      const nameMatch = tenantName.includes(searchLower);
      const unitNumberMatch = tenantUnitNumber.includes(searchTerm);

      return nameMatch || unitNumberMatch;
    });

    console.log(`Found ${filteredCompanies.length} matching companies`);

    return filteredCompanies.map((comp: any) => ({
      label: comp.tenantName,
      value: String(comp.tenantId),
      tenantUnitNumber: comp.tenantUnitNumber,
      userId: comp.userId,
      isActive: comp.isActive,
    }));
  } catch (error) {
    console.error(`Error searching companies in DB for user ${userId}:`, error);
    return [];
  }
};

// Updated search function - Database only approach
export const searchCompanies =
  (searchTerm: string, userId: string) => async (dispatch: any) => {
    if (!searchTerm.trim()) {
      // If search term is empty, show all companies from Redux state
      const state = dispatch.getState();
      const allCompanies = state.visitor.allCompanies;
      dispatch(setFilteredCompanies(allCompanies));
      return;
    }

    dispatch(setIsLoadingCompanies(true));

    try {
      // Always search in local database only
      const searchResults = await searchCompaniesInDB(searchTerm, userId);
      dispatch(setFilteredCompanies(searchResults));

      console.log(
        `Search completed: ${searchResults.length} results for "${searchTerm}"`
      );
    } catch (error) {
      console.error(`Error in company search for user ${userId}:`, error);
      dispatch(setFilteredCompanies([]));
    } finally {
      dispatch(setIsLoadingCompanies(false));
    }
  };

// Handle account change
export const handleAccountChange =
  (newUserId: string) => async (dispatch: any) => {
    try {
      console.log(`Handling account change to user: ${newUserId}`);

      // Reset the visitor state
      dispatch(resetForm());
      dispatch(setFilteredCompanies([]));

      // Load companies for the new user
      dispatch(loadInitialCompanies(newUserId));

      console.log(`Successfully switched to account: ${newUserId}`);
    } catch (error) {
      console.error(`Error during account change to ${newUserId}:`, error);
    }
  };

// Manual sync function for force refresh
export const forceRefreshCompanies =
  (userId: string) => async (dispatch: Dispatch) => {
    console.log(`Force refreshing companies for user ${userId}`);

    // 1️⃣ Load local DB immediately
    const localCompanies = await loadCompaniesFromDB(userId);
    dispatch(setAllCompanies(localCompanies));
    dispatch(setFilteredCompanies(localCompanies));

    // 2️⃣ Check network connectivity
    const isConnected = await NetInfo.fetch().then(
      (state) => state.isConnected
    );
    if (!isConnected) {
      console.log(`Device offline → showing DB data only`);
      return;
    }

    // 3️⃣ Trigger API fetch with hard 4s timeout
    dispatch(setIsLoadingCompanies(true));

    try {
      // Promise.race ensures either the API resolves or timeout triggers
      const response = await Promise.race([
        axiosInstance.get("/visitors/tenant_visitor_dropdown/"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout: 4s")), 4000)
        ),
      ]);

      // Map response
      const companies = response.data || [];
      const mappedCompanies = companies.map(
        (company: {
          id: number;
          tenant_name: string;
          tenant_unit_number: string;
          status: boolean;
        }) => ({
          label: company.tenant_name,
          value: String(company.id),
          tenantUnitNumber: company.tenant_unit_number,
          userId,
          isActive: company.status,
        })
      );

      // Save to DB and update Redux state
      await saveCompaniesToDB(mappedCompanies, userId);
      dispatch(setAllCompanies(mappedCompanies));
      dispatch(setFilteredCompanies(mappedCompanies));

      console.log(`Force refresh completed from server for user ${userId}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `Server unreachable or timeout → keeping DB data: ${errMsg}`
      );
    } finally {
      dispatch(setIsLoadingCompanies(false));
    }
  };
