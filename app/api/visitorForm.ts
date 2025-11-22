import "react-native-get-random-values";
import axiosInstance from "../api/axiosInstance";
import database from "../database";
import Visitor from "../database/models/Visitor";
import { Q } from "@nozbe/watermelondb";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { v4 as uuidv4 } from "uuid";
import { AppState, AppStateStatus } from "react-native";
import * as Crypto from "expo-crypto";
import { getCurrentUserId } from "./auth";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { AppLogger } from "@/src/utility/Logger/Logger";
import NetworkManager from "@/src/utility/networkHandeling/NetworkManager";
import { useSelector } from "react-redux";
import { RootState, store } from "../store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Use the relative endpoint as baseURL is set in axiosInstance
const API_ENDPOINT = "/visitors/add_visitor/";
const VISITOR_IMAGES_DIR = `${FileSystem.documentDirectory}visitor_images`;
export const getCorporateParkId = (): number | null => {
  const state = store.getState();
  return state.global?.corporateParkId ?? null;
};

export const getBuildingId = (): number | null => {
  const state = store.getState();
  return state.global?.buildingId ?? null;
};

// Timer reference for sync
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

const SYNC_INTERVAL = 2 * 60 * 1000; // 15 minutes in milliseconds
let appStateListener: any = null;

export const isServerOnline = async (): Promise<boolean> => {
  try {
    // First check device connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) {
      console.log("📴 No internet connection");
      return false;
    }

    // Use a lightweight HEAD request to confirm server reachability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await axiosInstance.get("/accounts/get-user-detail/", {
      timeout: 5000, // 5 second timeout
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    clearTimeout(timeoutId);

    // Consider online if we get any valid response
    if (
      (response.status >= 200 && response.status < 300) ||
      response.status === 401
    ) {
      console.log("✅ Server reachable (authentication may be required)");
      return true;
    }

    console.log("⚠️ Server responded but not healthy:", response.status);
    return false;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("⏳ Network timeout, treating as offline");
    } else {
      console.log("🛑 Server unreachable:", error.message || error);
    }
    return false;
  }
};

// Ensure the directory exists
const ensureDirectoryExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(VISITOR_IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(VISITOR_IMAGES_DIR, {
      intermediates: true,
    });
  }
};

// Compress image before processing
const compressImage = async (imageBase64: string): Promise<string> => {
  try {
    // Create a temporary file from base64 to use with ImageManipulator
    const tempFilePath = `${
      FileSystem.cacheDirectory
    }temp_original_${Date.now()}.jpg`;

    // Remove the data:image/jpeg;base64, prefix if it exists
    const base64Data = imageBase64.includes("base64,")
      ? imageBase64.split("base64,")[1]
      : imageBase64;
    if (!base64Data || typeof base64Data !== "string") {
      throw new Error("Invalid base64 image data");
    }

    await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Compress the image using ImageManipulator
    const manipResult = await ImageManipulator.manipulateAsync(
      tempFilePath,
      [{ resize: { width: 800, height: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Read the compressed image as base64
    const compressedBase64 = await FileSystem.readAsStringAsync(
      manipResult.uri,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    // Clean up temporary files
    await FileSystem.deleteAsync(tempFilePath, { idempotent: true });

    // console.log(
    //   `Compressed image from ${base64Data.length} to ${compressedBase64.length} characters`
    // );
    return compressedBase64;
  } catch (error) {
    console.error("Error compressing image:", error);
    // Return original if compression fails
    return imageBase64.includes("base64,")
      ? imageBase64.split("base64,")[1]
      : imageBase64;
  }
};

/**
 * Saves a base64 image to file system and returns the file path
 */
const saveImageToFile = async (base64Data: string): Promise<string> => {
  await ensureDirectoryExists();

  const timestamp = new Date().getTime();
  const fileName = `visitor_${timestamp}.jpg`;
  const filePath = `${VISITOR_IMAGES_DIR}/${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filePath;
};

/**
 * Start the periodic sync timer
 */
export const startPeriodicSync = () => {
  // Clear any existing timer
  if (syncIntervalId) clearInterval(syncIntervalId);

  // Start new timer
  syncIntervalId = setInterval(() => {
    console.log("Running periodic sync");
    syncVisitors();
  }, SYNC_INTERVAL);

  // Reset listener safely
  if (appStateListener) {
    appStateListener.remove();
    appStateListener = null;
  }

  appStateListener = AppState.addEventListener("change", handleAppStateChange);

  console.log("Periodic sync started");
};

/**
 * Handle app state changes
 */
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (nextAppState === "active") {
    // App came to foreground, check network then trigger sync
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        console.log("App came to foreground with network, triggering sync");
        syncVisitors()
          .then((result) => {
            console.log("App foreground sync completed:", result);
          })
          .catch((error) => {
            console.error("App foreground sync failed:", error);
          });
      } else {
        console.log("App came to foreground but no network, skipping sync");
      }
    });
  }
};

/**
 * Stop the periodic sync timer
 */
export const stopPeriodicSync = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  // Remove app state listener
  if (appStateListener) {
    appStateListener.remove();
    appStateListener = null;
  }

  console.log("Periodic sync stopped");
};

/**
 * Triggers sync when a security guard logs in
 */
export const triggerLoginSync = async () => {
  console.log("Security guard logged in, triggering sync");

  // Check network before running sync
  const networkState = await NetInfo.fetch();
  let result = { success: false, syncedCount: 0, failedCount: 0 };

  if (networkState.isConnected) {
    // Run the sync
    result = await syncVisitors();
    console.log("Login sync result:", result);
  } else {
    console.log(
      "No network connection during login, sync will happen when connection is available"
    );
  }

  // Start the periodic sync timer regardless of network status
  // It will check network before each sync attempt
  startPeriodicSync();

  return result;
};
/**
 * Clean up and cancel sync timer on logout
 */
export const handleLogout = () => {
  stopPeriodicSync();
};
/**
 * Submits a visitor record.
 * - If the API call succeeds, the record is stored locally as synced.
 * - If a network error occurs, the record is stored locally as unsynced for later sync.
 */

const storeVisitorLocally = async (
  visitorName: string,
  visitorMobileNo: string,
  visitingTenantId: number,
  visitorPhotoBase64: string,
  existingUuid?: string,
  createdDatetime?: string
) => {
  const imageFilePath = await saveImageToFile(visitorPhotoBase64);
  const imageName = `visitor_${Date.now()}.jpg`;
  const currentUserId = await getCurrentUserId();

  await database.write(async () => {
    await database.get<Visitor>("visitors").create((visitor) => {
      visitor.visitorName = visitorName;
      visitor.visitorMobileNo = visitorMobileNo;
      visitor.visitingTenantId = visitingTenantId;
      visitor.visitorPhoto = imageFilePath;
      visitor.visitorPhotoName = imageName;
      visitor.timestamp = Date.now();
      visitor.isSynced = false;
      visitor.recordUuid = existingUuid || Crypto.randomUUID();
      visitor.createdByUserId = currentUserId;
      visitor.visitorSyncStatus = "not_synced";
      visitor.createdDatetime = createdDatetime || new Date().toISOString();
    });
  });

  console.log("Visitor stored locally for later sync.");
};

export const submitVisitor = async (
  visitorName: string,
  visitorMobileNo: string,
  visitingTenantId: number,
  visitorPhotoBase64: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  const recordUuid = Crypto.randomUUID();

  try {
    const currentUserId = await getCurrentUserId();
    const compressedPhotoBase64 = await compressImage(visitorPhotoBase64);

    console.log("Storing visitor offline:", {
      visitor_name: visitorName,
      visitor_mobile_no: visitorMobileNo,
      visiting_tenant_id: visitingTenantId,
      record_uuid: recordUuid,
    });

    // Generate unique image name
    const timestamp = new Date().getTime();
    const imageName = `visitor_${timestamp}.jpg`;
    const createdDatetime = new Date().toISOString();

    // Save the compressed image to file system
    const imageFilePath = await saveImageToFile(compressedPhotoBase64);

    // Store visitor locally (unsynced)
    await database.write(async () => {
      await database.get<Visitor>("visitors").create((visitor) => {
        visitor.visitorName = visitorName;
        visitor.visitorMobileNo = visitorMobileNo;
        visitor.visitingTenantId = visitingTenantId;
        visitor.visitorPhoto = imageFilePath;
        visitor.visitorPhotoName = imageName;
        visitor.createdByUserId = currentUserId;
        visitor.timestamp = Date.now();
        visitor.recordUuid = recordUuid;
        visitor.createdDatetime = createdDatetime;

        // Mark as unsynced since it hasn't gone to the server yet
        visitor.isSynced = false;
        visitor.visitorSyncStatus = "not_synced";
        visitor.serverId = null;
      });
    });

    console.log("✅ Visitor stored offline successfully");

    // ✅ Log successful visitor creation
    await AppLogger.info("Visitor created in databse", {
      visitor_name: visitorName,
      visitor_mobile_no: visitorMobileNo,
      record_uuid: recordUuid,
      visiting_tenant_id: visitingTenantId,
      created_datetime: createdDatetime,
      created_by: currentUserId,
      has_photo: !!imageFilePath,
      sync_status: "not_synced",
    });

    return { success: true, data: { recordUuid } };
  } catch (error: unknown) {
    console.error("❌ Error while storing visitor offline:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // ✅ Log the error with context
    await AppLogger.error("Failed to create visitor offline", {
      record_uuid: recordUuid,
      visitor_name: visitorName, // Safe to log name for debugging
      visiting_tenant_id: visitingTenantId,
      error_message: errorMessage,
      error_stack: error instanceof Error ? error.stack : undefined,
    });

    return { success: false, error: errorMessage };
  }
};

// export const submitVisitor = async (
//   visitorName: string,
//   visitorMobileNo: string,
//   visitingTenantId: number,
//   visitorPhotoBase64: string
// ): Promise<{
//   success: boolean;
//   data?: any;
//   error?: string;
//   warning?: string;
// }> => {
//   // Add this: Generate UUID for this record
//   const recordUuid = Crypto.randomUUID();
//   try {
//     const currentUserId = await getCurrentUserId();
//     // Compress the image first
//     const compressedPhotoBase64 = await compressImage(visitorPhotoBase64);

//     console.log("Submitting payload:", {
//       visitor_name: visitorName,
//       visitor_mobile_no: visitorMobileNo,
//       visiting_tenant_id: visitingTenantId,
//       //photoLength: compressedPhotoBase64.length,
//     });

//     // Generate a unique image name using timestamp
//     const timestamp = new Date().getTime();
//     const imageName = `visitor_${timestamp}.jpg`;

//     const createdDatetime = new Date().toISOString();

//     const photoObject = {
//       image_name: imageName,
//       image_base64: compressedPhotoBase64,
//     };

//     // Save image to file system instead of directly to database
//     const imageFilePath = await saveImageToFile(compressedPhotoBase64);

//     // Send to server
//     const response = await axiosInstance.post(
//       API_ENDPOINT,
//       {
//         visitor_name: visitorName,
//         photo: photoObject,
//         visitor_mobile_no: visitorMobileNo,
//         visiting_tenant_id: visitingTenantId,
//         uuid: recordUuid,
//         created_datetime: createdDatetime,
//       },
//       { metadata: { userId: currentUserId } }
//     );

//     console.log("About to send API request with data:", {
//       visitor_name: visitorName,
//       visitor_mobile_no: visitorMobileNo,
//       visiting_tenant_id: visitingTenantId,
//       record_uuid: recordUuid,
//       // Don't log the full base64 image
//       //photo_size: photoObject.image_base64.length,
//     });

//     if (response.status !== 200 && response.status !== 201) {
//       console.warn(
//         `Unexpected response status: ${response.status}. Storing locally.`
//       );
//       await storeVisitorLocally(
//         visitorName,
//         visitorMobileNo,
//         visitingTenantId,
//         visitorPhotoBase64,
//         recordUuid,
//         createdDatetime
//       );
//       return {
//         success: false,
//         error: `Unexpected server status ${response.status}. Stored locally for sync.`,
//       };
//     }

//     // console.log("API Response Status:", response.status);
//     // console.log("API Response Headers:", JSON.stringify(response.headers));
//     // console.log("API Response Data:", JSON.stringify(response.data));

//     // Check if there's an ID field in the response - use consistent extraction
//     const responseId =
//       response.data?.id ||
//       response.data?.visitor_id ||
//       response.data?.data?.id ||
//       response.data?.results?.[0]?.id ||
//       null;

//     console.log("Extracted server ID:", responseId);
//     console.log("Saving to database with server ID:", responseId);

//     // Database operation with better error handling
//     try {
//       if (response.status === 200 || response.status === 201) {
//         await database.write(async () => {
//           await database.get<Visitor>("visitors").create((visitor) => {
//             visitor.visitorName = visitorName;
//             visitor.visitorMobileNo = visitorMobileNo;
//             visitor.visitingTenantId = visitingTenantId;
//             visitor.visitorPhoto = imageFilePath;
//             // visitor.visitorPhotoName = imageName;
//             visitor.createdByUserId = currentUserId;
//             visitor.isSynced = true;
//             visitor.visitorSyncStatus = "synced";
//             visitor.timestamp = Date.now();
//             visitor.serverId = responseId;
//             visitor.recordUuid = recordUuid;
//             visitor.createdDatetime = createdDatetime;
//           });
//         });
//       } else {
//         // Store locally as unsynced
//         await database.write(async () => {
//           await database.get<Visitor>("visitors").create((visitor) => {
//             visitor.visitorName = visitorName;
//             visitor.visitorMobileNo = visitorMobileNo;
//             visitor.visitingTenantId = visitingTenantId;
//             visitor.visitorPhoto = imageFilePath;
//             visitor.visitorPhotoName = imageName;
//             visitor.createdByUserId = currentUserId;
//             visitor.timestamp = Date.now();
//             visitor.recordUuid = recordUuid;
//             visitor.createdDatetime = createdDatetime;

//             // ❌ Do NOT mark as synced
//             visitor.isSynced = false;
//             visitor.visitorSyncStatus = "not_synced";
//             visitor.serverId = null;
//           });
//         });
//       }
//       return { success: true, data: response.data };
//     } catch (error: unknown) {
//       console.error("Database write error details:", error);

//       // Return partial success since API call worked but local storage failed
//       const errorMessage =
//         error instanceof Error ? error.message : String(error);
//       return {
//         success: true,
//         data: response.data,
//         warning: "API success but local storage failed. Error: " + errorMessage,
//       };
//     }
//   } catch (error: unknown) {
//     // Detailed error logging

//     console.error("=== SUBMIT VISITOR ERROR ===");
//     console.error("Error type:", typeof error);
//     console.error(
//       "Error message:",
//       error instanceof Error ? error.message : String(error)
//     );

//     const axiosError = error as any; // Type assertion for axios error properties

//     if (axiosError.response) {
//       // The request was made and the server responded with a status code
//       // that falls out of the range of 2xx
//       console.error("Error status:", axiosError.response.status);

//       console.error(
//         "Error headers:",
//         JSON.stringify(axiosError.response.headers)
//       );
//       console.error("Error data:", JSON.stringify(axiosError.response.data));
//     } else if (axiosError.request) {
//       // The request was made but no response was received
//       console.error("No response received. Request:", axiosError.request);
//     } else {
//       // Something happened in setting up the request that triggered an Error
//       console.error(
//         "Error in request setup:",
//         error instanceof Error ? error.message : String(error)
//       );
//     }
//     console.error("Error config:", axiosError.config);

//     // Network error handling remains the same
//     if (
//       error instanceof Error &&
//       error.message &&
//       error.message.includes("Network Error")
//     ) {
//       console.log("Network error detected, storing locally");

//       try {
//         const imageFilePath = await saveImageToFile(visitorPhotoBase64);
//         const imageName = `visitor_${Date.now()}.jpg`;
//         const currentUserId = await getCurrentUserId();

//         await database.write(async () => {
//           await database.get<Visitor>("visitors").create((visitor) => {
//             visitor.visitorName = visitorName;
//             visitor.visitorMobileNo = visitorMobileNo;
//             visitor.visitingTenantId = visitingTenantId;
//             visitor.visitorPhoto = imageFilePath;
//             visitor.visitorPhotoName = imageName;
//             visitor.timestamp = Date.now();
//             visitor.isSynced = false;
//             visitor.recordUuid = recordUuid;
//             visitor.createdByUserId = currentUserId;
//             visitor.visitorSyncStatus = "not_synced";
//             visitor.createdDatetime = new Date().toISOString();
//           });
//         });
//         console.log("Successfully stored locally for later sync");
//         return { success: false, error: "Data stored locally for sync" };
//       } catch (dbError: unknown) {
//         console.error("Failed to store locally:", dbError);
//         const dbErrorMessage =
//           dbError instanceof Error ? dbError.message : String(dbError);
//         return {
//           success: false,
//           error: "Network error and failed to store locally: " + dbErrorMessage,
//         };
//       }
//     }

//     const errorMessage = error instanceof Error ? error.message : String(error);
//     return { success: false, error: errorMessage || "Unknown error occurred" };
//   }
// };
/**
 * Prepares a visitor record for sync
 */
const prepareVisitorForSync = async (visitor: Visitor) => {
  let base64Data = "";

  // Read image from file
  if (visitor.visitorPhoto) {
    const fileInfo = await FileSystem.getInfoAsync(visitor.visitorPhoto);
    if (fileInfo.exists) {
      base64Data = await FileSystem.readAsStringAsync(visitor.visitorPhoto, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else {
      console.warn(
        `[SYNC] Image file not found for visitor ${visitor.id} at ${visitor.visitorPhoto}`
      );
      return null; // 🔥 Prevent broken sync
    }
  }

  if (!base64Data) {
    console.warn(`[SYNC] No image data found for visitor ${visitor.id}`);
    return null; // 🔥 Skip syncing if image can't be loaded
  }

  // ✅ Use stored image name or fallback to generating one
  const imageName =
    visitor.visitorPhotoName ||
    `visitor_${visitor.timestamp || Date.now()}.jpg`;

  const photoObject = {
    image_name: imageName,
    image_base64: base64Data,
  };
  const createdDatetime =
    visitor.createdDatetime || new Date(visitor.timestamp).toISOString();

  return {
    visitor_name: visitor.visitorName,
    photo: photoObject,
    visitor_mobile_no: visitor.visitorMobileNo,
    visiting_tenant_id: visitor.visitingTenantId,
    uuid: visitor.recordUuid,
    created_datetime: createdDatetime,
  };
};

export const debugSyncRecords = async () => {
  const currentUserId = await getCurrentUserId();

  // Check ALL records
  const allVisitors = await database.get<Visitor>("visitors").query().fetch();
  console.log(`🔎 Total records in DB: ${allVisitors.length}`);

  // Check unsynced records (without user filter)
  const allUnsynced = await database
    .get<Visitor>("visitors")
    .query(Q.where("visitor_sync_status", "not_synced"))
    .fetch();
  console.log(`🔎 Total unsynced records: ${allUnsynced.length}`);

  // Check current user's unsynced records
  const userUnsynced = await database
    .get<Visitor>("visitors")
    .query(
      Q.where("visitor_sync_status", "not_synced"),
      Q.where("created_by_user_id", currentUserId)
    )
    .fetch();
  console.log(`🔎 Current user unsynced: ${userUnsynced.length}`);
  console.log(`🔎 Current user ID: ${currentUserId}`);

  // Sample a few records to see their state
  allUnsynced.slice(0, 3).forEach((record, index) => {
    console.log(`🔎 Sample record ${index + 1}:`, {
      id: record.id,
      recordUuid: record.recordUuid,
      visitorSyncStatus: record.visitorSyncStatus,
      isSynced: record.isSynced,
      createdByUserId: record.createdByUserId,
      serverId: record.serverId,
    });
  });
};

/**
 * Syncs a single visitor record
//  */
// const syncVisitor = async (visitor: Visitor): Promise<boolean> => {
//   try {
//     console.log(
//       `[SYNC] Attempting to sync visitor record with local ID: ${visitor.id}`
//     );
//     let base64Data = "";

//     // Read image from file
//     if (visitor.visitorPhoto) {
//       const fileInfo = await FileSystem.getInfoAsync(visitor.visitorPhoto);
//       if (fileInfo.exists) {
//         base64Data = await FileSystem.readAsStringAsync(visitor.visitorPhoto, {
//           encoding: FileSystem.EncodingType.Base64,
//         });
//         // console.log(
//         //   `[SYNC] Read image for visitor ${visitor.id} from ${visitor.visitorPhoto}`
//         // );
//       } else {
//         // console.warn(
//         //   `[SYNC] Image file not found for visitor ${visitor.id} at ${visitor.visitorPhoto}`
//         // );
//       }
//     }

//     // Generate image name
//     const imageName = `visitor_${visitor.timestamp || Date.now()}.jpg`;

//     const photoObject = {
//       image_name: imageName,
//       image_base64: base64Data,
//     };

//     // Submit to API
//     console.log(
//       `[SYNC] Submitting visitor ${visitor.id} to API with payload:`,
//       {
//         visitor_name: visitor.visitorName,
//         photo: {
//           image_name: photoObject.image_name,
//           image_base64_length: photoObject.image_base64.length,
//         },
//         visitor_mobile_no: visitor.visitorMobileNo,
//         visiting_tenant_id: visitor.visitingTenantId,
//       }
//     );

//     const response = await axiosInstance.post(API_ENDPOINT, {
//       visitor_name: visitor.visitorName,
//       photo: photoObject,
//       visitor_mobile_no: visitor.visitorMobileNo,
//       visiting_tenant_id: visitor.visitingTenantId,
//       //timestamp: visitor.timestamp,
//     });

//     console.log(
//       `[SYNC] API response for visitor ${visitor.id}:`,
//       response.data
//     );
//     const filePath = visitor.visitorPhoto;

//     // Update the record and clean up
//     await database.write(async () => {
//       await visitor.update((v: Visitor) => {
//         v.isSynced = true;
//         v.serverId = response.data.id || null;
//         v.visitorPhoto = "";
//       });
//     });
//     console.log(`[SYNC] Visitor ${visitor.id} synced successfully.`);
//     if (filePath) {
//       try {
//         await FileSystem.deleteAsync(filePath, { idempotent: true });
//         // console.log(
//         //   `[SYNC] Deleted local image file for visitor ${visitor.id} at ${filePath}`
//         // );
//       } catch (err) {
//         console.error(
//           `[SYNC] Failed to delete local image file for visitor ${visitor.id}`,
//           err
//         );
//       }
//     }

//     return true;
//   } catch (error) {
//     console.error("Sync failed for visitor", visitor.id, error);
//     return false;
//   }
// };

/**
 * Syncs all unsynced visitor records with the API.
 * Processes in batches to avoid memory issues.
 */

const isDuplicateUuidError = (error: any): boolean => {
  return (
    error?.response?.data?.error?.uuid &&
    Array.isArray(error.response.data.error.uuid) &&
    error.response.data.error.uuid.some((msg: string) =>
      msg.toLowerCase().includes("uuid already exists")
    )
  );
};

export const syncVisitors = async (): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
}> => {
  try {
    const online = await isServerOnline();
    if (!online) {
      console.warn("🚫 Server is offline. Skipping sync for now.");
      return { success: false, syncedCount: 0, failedCount: 0 };
    }

    const currentUserId = await getCurrentUserId();

    // Query unsynced visitor records
    const unsyncedVisitors = await database
      .get<Visitor>("visitors")
      .query(
        Q.where("visitor_sync_status", "not_synced"),
        Q.where("created_by_user_id", currentUserId)
      )
      .fetch();

    if (unsyncedVisitors.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    console.log(`Found ${unsyncedVisitors.length} visitors to sync`);
    // ✅ Log sync start with details
    await AppLogger.info("Visitor sync started", {
      unsynced_count: unsyncedVisitors.length,
      user_id: currentUserId,
    });

    let syncedCount = 0;
    let failedCount = 0;
    const failedVisitors: any[] = [];
    // Process in batches of 5 to avoid memory issues
    const totalRecords = unsyncedVisitors.length;
    const BATCH_SIZE = totalRecords > 100 ? 20 : totalRecords > 50 ? 10 : 5;

    for (let i = 0; i < unsyncedVisitors.length; i += BATCH_SIZE) {
      const batch = unsyncedVisitors.slice(i, i + BATCH_SIZE);

      // Process each visitor individually
      const syncPromises = batch.map(async (visitor) => {
        // Skip if backoff period hasn't elapsed
        const now = Date.now();
        //for the rate per limit handleing we have to comment the below code out! for large number of records
        // if (
        //   visitor.lastSyncAttempt &&
        //   now - visitor.lastSyncAttempt < 2 * 60_000
        // ) {
        //   console.log(`Skipping ${visitor.recordUuid} due to back-off`);
        //   return false;
        // }

        // Skip if too many retries (prevent infinite loops)
        // if ((visitor.syncRetryCount ?? 0) >= 5) {
        //   console.log(
        //     `Max retries reached for ${visitor.recordUuid}, retrying anyway`
        //   );
        //   await new Promise((resolve) =>
        //     setTimeout(resolve, (visitor.syncRetryCount ?? 0) * 2000)
        //   );
        // }
        if ((visitor.syncRetryCount ?? 0) >= 5) {
          console.log(
            `Max retries reached for ${visitor.recordUuid}, will still retry later`
          );
          // Don’t block, just use longer backoff
        }
        const startTime = Date.now();
        let requestSucceeded = false;
        try {
          const visitorData = await prepareVisitorForSync(visitor);
          if (!visitorData) {
            console.warn(
              `[SYNC] Skipping visitor ${visitor.id} due to invalid payload`
            );
            await AppLogger.error("Invalid visitor payload for sync", {
              record_uuid: visitor.recordUuid,
              visitor_name: visitor.visitorName,
            });
            return false;
          }

          console.log(
            `[SYNC] Sending visitor ${visitor.recordUuid} with data:`,
            {
              created_datetime: visitorData.created_datetime,
              //  base64Length: visitorData.photo?.image_base64?.length,
            }
          );
          const ownerId = visitor.createdByUserId;

          // Send to API
          const response = await axiosInstance.post(
            API_ENDPOINT,
            visitorData,
            {}
          );
          const responseTime = Date.now() - startTime;
          requestSucceeded = response.status === 200 || response.status === 201;
          //   NetworkManager.reportRequestResult(requestSucceeded, responseTime);

          if (response.status === 200 || response.status === 201) {
            const serverId =
              response.data?.id ||
              response.data?.visitor_id ||
              response.data?.data?.id ||
              null;

            // Mark as synced
            await database.write(async () => {
              await visitor.update((v: Visitor) => {
                v.visitorSyncStatus = "synced";
                v.isSynced = true;
                v.syncRetryCount = 0;
                v.lastSyncAttempt = null;
                if (serverId) v.serverId = serverId;
              });
            });
            const updatedVisitor = await database
              .get<Visitor>("visitors")
              .find(visitor.id);
            await AppLogger.reportSyncIssues([
              {
                uuid: updatedVisitor.recordUuid,
                name: updatedVisitor.visitorName,
                mobile: updatedVisitor.visitorMobileNo,
                created: updatedVisitor.createdDatetime,
                corporateParkId: getCorporateParkId(),
                buildingId: getBuildingId(),
                tenantId: updatedVisitor.visitingTenantId,
                syncStatus: updatedVisitor.visitorSyncStatus,
                synced: updatedVisitor.isSynced,
                syncedDatetime: new Date().toISOString(),
              },
            ]);
            console.log("🏢 corporateParkId :", getCorporateParkId());
            console.log("🏢 building ID:", getBuildingId());
            return true;
          } else {
            throw new Error(
              `Unexpected status ${response.status} for ${visitor.recordUuid}`
            );
          }
        } catch (error: any) {
          const responseTime = Date.now() - startTime;
          // NetworkManager.reportRequestResult(false, responseTime);
          console.error(
            `❌ [SYNC ERROR] Visitor ${visitor.recordUuid}:`,
            error
          );

          // ✅ Handle UUID already exists - this is actually SUCCESS
          if (isDuplicateUuidError(error)) {
            console.log(
              `🎯 Visitor ${visitor.recordUuid} already exists on server - marking as synced`
            );

            await database.write(async () => {
              await visitor.update((v: Visitor) => {
                v.visitorSyncStatus = "synced";
                v.isSynced = true;
                v.syncRetryCount = 0;
                v.lastSyncAttempt = null;
              });
            });
            await AppLogger.info("Visitor already exists on server", {
              record_uuid: visitor.recordUuid,
              visitor_name: visitor.visitorName,
            });

            return true; // This is a success!
          }

          // For other errors, record retry attempt
          await database.write(async () => {
            await visitor.update((v) => {
              v.syncRetryCount = (v.syncRetryCount ?? 0) + 1;
              v.lastSyncAttempt = Date.now();
            });
          });

          const axiosError = error as {
            response?: { data?: any; status?: number };
            message: string;
          };
          await AppLogger.error("Visitor sync failed", {
            record_uuid: visitor.recordUuid,
            visitor_name: visitor.visitorName,
            tenant_id: visitor.visitingTenantId,
            retry_count: (visitor.syncRetryCount ?? 0) + 1,
            error_code: axiosError.response?.status || "NETWORK_ERROR",
            error_message: axiosError.message,
            error_data: JSON.stringify(axiosError.response?.data),
          });

          // ✅ Collect for reportSyncIssues
          failedVisitors.push({
            uuid: visitor.recordUuid,
            name: visitor.visitorName,
            mobile: visitor.visitorMobileNo,
            tenantId: visitor.visitingTenantId,
            created: visitor.createdDatetime,
            syncStatus: "error",
            synced: false,
          });

          const errors = axiosError.response?.data?.errors;
          if (Array.isArray(errors)) {
            errors.forEach((err: any) => {
              const msg =
                typeof err.error === "string"
                  ? err.error
                  : JSON.stringify(err, null, 2);

              console.error(
                `[SYNC ERROR] Visitor ${err.uuid || visitor.recordUuid}: ${msg}`
              );
            });
          } else {
            console.error(
              `[SYNC ERROR] Visitor ${visitor.recordUuid}:`,
              axiosError.response?.data ?? axiosError.message
            );
          }
          return false;
        }
      });

      // Wait for all sync operations to complete
      const results = await Promise.all(syncPromises);

      // Count successes and failures
      results.forEach((r) => (r ? syncedCount++ : failedCount++));

      // Allow a small delay between batches to prevent UI freezing
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Clean up old images after sync is complete
    await cleanupOldImages();

    console.log(
      `🏁 Sync completed: ${syncedCount} synced, ${failedCount} failed`
    );
    await AppLogger.info("Visitor sync completed", {
      total_attempted: unsyncedVisitors.length,
      synced_count: syncedCount,
      failed_count: failedCount,
      batch_size: BATCH_SIZE,
    });

    if (failedVisitors.length > 0) {
      await AppLogger.reportSyncIssues(failedVisitors);
    }

    return { success: true, syncedCount, failedCount };
  } catch (error) {
    console.error("Error during visitor sync:", error);
    // ✅ Log overall sync process failure
    await AppLogger.error("Visitor sync process failed", {
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });

    return { success: false, syncedCount: 0, failedCount: 0 };
  }
};

/**
 * Cleans up old image files that are no longer needed
 */
/**
 * Cleans up old image files that are no longer referenced by any visitor record.
 * Only deletes files that are not in use and have not been modified in the last hour.
 */
export const cleanupOldImages = async (): Promise<void> => {
  try {
    // Fetch all visitor records that have a non-empty visitorPhoto field.
    // (Synced records have visitorPhoto cleared to an empty string.)
    const visitorsWithImages = await database
      .get<Visitor>("visitors")
      .query(
        Q.and(
          Q.where("visitor_photo", Q.notEq(null)),
          Q.where("visitor_photo", Q.notEq(""))
        )
      )
      .fetch();

    // Build a list of active file paths that are still referenced.
    const activeFilePaths = visitorsWithImages
      .map((visitor) => visitor.visitorPhoto)
      .filter((path) => path && path.length > 0);

    // console.log("[CLEANUP] Active file paths in use:", activeFilePaths);

    // Get all image files in the visitor images directory.
    const files = await FileSystem.readDirectoryAsync(VISITOR_IMAGES_DIR);
    const imagePaths = files.map((file) => `${VISITOR_IMAGES_DIR}/${file}`);
    // console.log("[CLEANUP] All image files in directory:", imagePaths);

    // Define a cutoff time (files older than 1 hour will be considered for deletion).
    const cutoff = Date.now() - 24 * 3600000;
    const filesToDelete: string[] = [];

    // Check each file
    for (const path of imagePaths) {
      // Skip files still referenced by synced visitors
      if (!activeFilePaths.includes(path)) {
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists && fileInfo.modificationTime! < cutoff) {
          filesToDelete.push(path);
        }
      }
    }

    // Delete safely
    for (const filePath of filesToDelete) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log(`[CLEANUP] Deleted old unused file: ${filePath}`);
    }

    console.log(
      `[CLEANUP] Cleaned up ${filesToDelete.length} old image file(s)`
    );
  } catch (error) {
    console.error("[CLEANUP] Error cleaning up old images:", error);
  }
};
/**
 * Purges old synced visitor records to prevent database bloat
 * Keeps records for the specified number of days
 */
export const purgeOldRecords = async (): Promise<number> => {
  try {
    // Calculate the start of the current day
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    // Find old synced records (records from previous days that are synced)
    const oldRecords = await database
      .get<Visitor>("visitors")
      .query(
        Q.and(
          Q.where("visitor_sync_status", "synced"), // Changed from is_synced to sync_status
          Q.where("timestamp", Q.lt(startOfToday))
        )
      )
      .fetch();

    if (oldRecords.length === 0) {
      return 0;
    }

    // Delete old records and their associated image files
    await database.write(async () => {
      for (const record of oldRecords) {
        // Delete associated image file if it exists
        if (record.visitorPhoto) {
          const fileInfo = await FileSystem.getInfoAsync(record.visitorPhoto);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(record.visitorPhoto, {
              idempotent: true,
            });
          }
        }

        // Delete the database record
        await record.destroyPermanently();
      }
    });

    console.log(`Purged ${oldRecords.length} old visitor records`);
    return oldRecords.length;
  } catch (error) {
    console.error("Error purging old records:", error);
    return 0;
  }
};
