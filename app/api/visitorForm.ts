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

// Use the relative endpoint as baseURL is set in axiosInstance
const API_ENDPOINT = "/visitors/add_visitor/";
const VISITOR_IMAGES_DIR = `${FileSystem.documentDirectory}visitor_images`;

// Timer reference for sync
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

const SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
let appStateListener: any = null;

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
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  // Set up new interval
  syncIntervalId = setInterval(() => {
    console.log("Running periodic sync (15-minute interval)");
    syncVisitors();
  }, SYNC_INTERVAL);

  // Set up app state listener to handle background/foreground transitions
  if (!appStateListener) {
    appStateListener = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
  }

  console.log("Periodic sync started");
};

/**
 * Handle app state changes
 */
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (nextAppState === "active") {
    // App came to foreground, trigger a sync
    console.log("App came to foreground, triggering sync");
    syncVisitors();
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

  // Run the sync
  const result = await syncVisitors();

  // Start the periodic sync timer
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
export const submitVisitor = async (
  visitorName: string,
  visitorMobileNo: string,
  visitingTenantId: number,
  visitorPhotoBase64: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  warning?: string;
}> => {
  try {
    // Compress the image first
    const compressedPhotoBase64 = await compressImage(visitorPhotoBase64);

    console.log("Submitting payload:", {
      visitor_name: visitorName,
      visitor_mobile_no: visitorMobileNo,
      visiting_tenant_id: visitingTenantId,
      photoLength: compressedPhotoBase64.length,
    });

    // Generate a unique image name using timestamp
    const timestamp = new Date().getTime();
    const imageName = `visitor_${timestamp}.jpg`;

    console.log("About to generate UUID");

    // Add this: Generate UUID for this record
    const recordUuid = Crypto.randomUUID();
    console.log("Generated UUID:", recordUuid);

    const photoObject = {
      image_name: imageName,
      image_base64: compressedPhotoBase64,
    };

    // Save image to file system instead of directly to database
    const imageFilePath = await saveImageToFile(compressedPhotoBase64);

    // Send to server
    const response = await axiosInstance.post(API_ENDPOINT, {
      visitor_name: visitorName,
      photo: photoObject,
      visitor_mobile_no: visitorMobileNo,
      visiting_tenant_id: visitingTenantId,
      uuid: recordUuid,
    });
    console.log("About to send API request with data:", {
      visitor_name: visitorName,
      visitor_mobile_no: visitorMobileNo,
      visiting_tenant_id: visitingTenantId,
      record_uuid: recordUuid,
      // Don't log the full base64 image
      photo_size: photoObject.image_base64.length,
    });
    // console.log("API Response Status:", response.status);
    // console.log("API Response Headers:", JSON.stringify(response.headers));
    // console.log("API Response Data:", JSON.stringify(response.data));

    // Check if there's an ID field in the response - use consistent extraction
    const responseId =
      response.data?.id ||
      response.data?.visitor_id ||
      response.data?.data?.id ||
      null;

    console.log("Extracted server ID:", responseId);
    console.log("Saving to database with server ID:", responseId);

    // Database operation with better error handling
    try {
      await database.write(async () => {
        await database.get<Visitor>("visitors").create((visitor) => {
          console.log("Setting visitorName");
          visitor.visitorName = visitorName;
          console.log("Setting visitorMobileNo");
          visitor.visitorMobileNo = visitorMobileNo;
          console.log("Setting visitingTenantId");
          visitor.visitingTenantId = visitingTenantId;
          console.log("Setting visitorPhoto");
          visitor.visitorPhoto = imageFilePath;
          console.log("Setting isSynced");
          // visitor.visitorPhotoName = imageName;
          console.log("Setting imageName");
          visitor.isSynced = true;
          console.log("Setting timestamp");
          console.log("Setting syncStatus"); // Changed from isSynced
          visitor.visitorSyncStatus = "synced";
          visitor.timestamp = Date.now();
          console.log("Setting serverId");
          visitor.serverId = responseId;
          console.log("Setting recordUuid"); // Add this
          visitor.recordUuid = recordUuid;
        });
      });
      return { success: true, data: response.data };
    } catch (error: unknown) {
      console.error("Database write error details:", error);
      // Return partial success since API call worked but local storage failed
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: true,
        data: response.data,
        warning: "API success but local storage failed. Error: " + errorMessage,
      };
    }
  } catch (error: unknown) {
    // Detailed error logging
    console.error("=== SUBMIT VISITOR ERROR ===");
    console.error("Error type:", typeof error);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );

    const axiosError = error as any; // Type assertion for axios error properties

    if (axiosError.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("Error status:", axiosError.response.status);
      console.error(
        "Error headers:",
        JSON.stringify(axiosError.response.headers)
      );
      console.error("Error data:", JSON.stringify(axiosError.response.data));
    } else if (axiosError.request) {
      // The request was made but no response was received
      console.error("No response received. Request:", axiosError.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error(
        "Error in request setup:",
        error instanceof Error ? error.message : String(error)
      );
    }
    console.error("Error config:", axiosError.config);

    // Network error handling remains the same
    if (
      error instanceof Error &&
      error.message &&
      error.message.includes("Network Error")
    ) {
      console.log("Network error detected, storing locally");

      try {
        const imageFilePath = await saveImageToFile(visitorPhotoBase64);
        const imageName = `visitor_${Date.now()}.jpg`;

        await database.write(async () => {
          await database.get<Visitor>("visitors").create((visitor) => {
            visitor.visitorName = visitorName;
            visitor.visitorMobileNo = visitorMobileNo;
            visitor.visitingTenantId = visitingTenantId;
            visitor.visitorPhoto = imageFilePath;
            visitor.visitorPhotoName = imageName;
            visitor.timestamp = Date.now();
            visitor.isSynced = false;
            visitor.recordUuid = Crypto.randomUUID();
            visitor.visitorSyncStatus = "not_synced";
          });
        });
        console.log("Successfully stored locally for later sync");
        return { success: false, error: "Data stored locally for sync" };
      } catch (dbError: unknown) {
        console.error("Failed to store locally:", dbError);
        const dbErrorMessage =
          dbError instanceof Error ? dbError.message : String(dbError);
        return {
          success: false,
          error: "Network error and failed to store locally: " + dbErrorMessage,
        };
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || "Unknown error occurred" };
  }
};
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

  return {
    visitor_name: visitor.visitorName,
    photo: photoObject,
    visitor_mobile_no: visitor.visitorMobileNo,
    visiting_tenant_id: visitor.visitingTenantId,
    uuid: visitor.recordUuid,
  };
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
export const syncVisitors = async (): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
}> => {
  try {
    // Query unsynced visitor records
    const unsyncedVisitors = await database
      .get<Visitor>("visitors")
      .query(Q.where("visitor_sync_status", "not_synced"))
      .fetch();

    if (unsyncedVisitors.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    console.log(`Found ${unsyncedVisitors.length} visitors to sync`);

    let syncedCount = 0;
    let failedCount = 0;

    // Process in batches of 5 to avoid memory issues
    const BATCH_SIZE = 5;
    for (let i = 0; i < unsyncedVisitors.length; i += BATCH_SIZE) {
      const batch = unsyncedVisitors.slice(i, i + BATCH_SIZE);

      // Process each visitor individually
      const syncPromises = batch.map(async (visitor) => {
        try {
          const visitorData = await prepareVisitorForSync(visitor);
          if (!visitorData) {
            console.warn(
              `[SYNC] Skipping visitor ${visitor.id} due to invalid payload`
            );
            return false;
          }

          console.log(
            `[SYNC] Sending visitor ${visitor.recordUuid} with data:`,
            {
              ...visitorData,
              base64Length: visitorData.photo?.image_base64?.length,
            }
          );

          // Send to API
          const response = await axiosInstance.post(API_ENDPOINT, visitorData);

          // Check if UUID was processed successfully
          if (
            response.data &&
            Array.isArray(response.data.processed_uuids) &&
            response.data.processed_uuids.includes(visitor.recordUuid)
          ) {
            // Update the record
            await database.write(async () => {
              await visitor.update((v: Visitor) => {
                v.visitorSyncStatus = "synced";
              });
            });
            return true;
          } else if (response.data && response.data.errors) {
            console.warn(
              `Error syncing visitor ${visitor.recordUuid}:`,
              response.data.errors
            );
            return false;
          }
          return false;
        } catch (error: any) {
          const axiosError = error as {
            response?: { data?: any; status?: number };
            message: string;
          };
          const errors = axiosError.response?.data?.errors;

          if (Array.isArray(errors)) {
            errors.forEach((err: any) => {
              // If err.error is a string, show that; otherwise stringify the entire object
              const msg =
                typeof err.error === "string"
                  ? err.error
                  : JSON.stringify(err, null, 2);

              console.error(
                `[SYNC ERROR] Visitor ${err.uuid || visitor.recordUuid}: ${msg}`
              );
            });
          } else {
            // Nothing in response.data.errors, fall back to raw body or message
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
      results.forEach((success) => {
        if (success) syncedCount++;
        else failedCount++;
      });

      // Allow a small delay between batches to prevent UI freezing
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Clean up old images after sync is complete
    await cleanupOldImages();

    return { success: true, syncedCount, failedCount };
  } catch (error) {
    console.error("Error during visitor sync:", error);
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
    const oneHourAgo = Date.now() - 3600000;
    const filesToDelete: string[] = [];

    // Check each image file to see if it's not in use and is older than the cutoff.
    for (const path of imagePaths) {
      if (!activeFilePaths.includes(path)) {
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (
          fileInfo.exists &&
          fileInfo.modificationTime &&
          fileInfo.modificationTime < oneHourAgo
        ) {
          filesToDelete.push(path);
        }
      }
    }

    // Delete the unused files.
    for (const filePath of filesToDelete) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log(`[CLEANUP] Deleted unused file: ${filePath}`);
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
