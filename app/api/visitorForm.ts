import axiosInstance from "../api/axiosInstance";
import database from "../database";
import Visitor from "../database/models/Visitor";
import { Q } from "@nozbe/watermelondb";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

// Use the relative endpoint as baseURL is set in axiosInstance
const API_ENDPOINT = "/visitors/add_visitor/";
const VISITOR_IMAGES_DIR = `${FileSystem.documentDirectory}visitor_images`;

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

    console.log(
      `Compressed image from ${base64Data.length} to ${compressedBase64.length} characters`
    );
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
    });
    console.log("API Response Status:", response.status);
    console.log("API Response Headers:", JSON.stringify(response.headers));
    console.log("API Response Data:", JSON.stringify(response.data));

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
          visitor.isSynced = true;
          console.log("Setting timestamp");
          visitor.timestamp = Date.now();
          console.log("Setting serverId");
          visitor.serverId = responseId;
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
        await database.write(async () => {
          await database.get<Visitor>("visitors").create((visitor) => {
            visitor.visitorName = visitorName;
            visitor.visitorMobileNo = visitorMobileNo;
            visitor.visitingTenantId = visitingTenantId;
            visitor.visitorPhoto = visitorPhotoBase64;
            visitor.timestamp = Date.now();
            visitor.isSynced = false;
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
 * Syncs a single visitor record
 */
const syncVisitor = async (visitor: Visitor): Promise<boolean> => {
  try {
    let base64Data = "";

    // Read image from file
    if (visitor.visitorPhoto) {
      const fileInfo = await FileSystem.getInfoAsync(visitor.visitorPhoto);
      if (fileInfo.exists) {
        base64Data = await FileSystem.readAsStringAsync(visitor.visitorPhoto, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }

    // Generate image name
    const imageName = `visitor_${visitor.timestamp || Date.now()}.jpg`;

    const photoObject = {
      image_name: imageName,
      image_base64: base64Data,
    };

    // Submit to API
    const response = await axiosInstance.post(API_ENDPOINT, {
      visitor_name: visitor.visitorName,
      photo: photoObject,
      visitor_mobile_no: visitor.visitorMobileNo,
      visiting_tenant_id: visitor.visitingTenantId,
      timestamp: visitor.timestamp,
    });

    // Update the record and clean up
    await database.write(async () => {
      await visitor.update((v: Visitor) => {
        v.isSynced = true;
        v.serverId = response.data.id || null;
      });
    });

    console.log(`Visitor ${visitor.id} synced successfully.`);
    return true;
  } catch (error) {
    console.error("Sync failed for visitor", visitor.id, error);
    return false;
  }
};

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
      .query(Q.where("is_synced", false))
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
      const results = await Promise.all(
        batch.map((visitor) => syncVisitor(visitor))
      );

      results.forEach((result) => {
        if (result) syncedCount++;
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
export const cleanupOldImages = async (): Promise<void> => {
  try {
    // Get all synced visitors
    const syncedVisitors = await database
      .get<Visitor>("visitors")
      .query(Q.where("is_synced", true))
      .fetch();

    // Get file paths that are still in use
    const activeFilePaths = syncedVisitors
      .map((visitor) => visitor.visitorPhoto)
      .filter(Boolean);

    // Get all image files
    const files = await FileSystem.readDirectoryAsync(VISITOR_IMAGES_DIR);
    const imagePaths = files.map((file) => `${VISITOR_IMAGES_DIR}/${file}`);

    // Find files that are no longer needed
    const oneHourAgo = Date.now() - 3600000; // 1 hour in milliseconds
    const filesToDelete = [];

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

    // Delete unused files
    for (const filePath of filesToDelete) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }

    console.log(`Cleaned up ${filesToDelete.length} old image files`);
  } catch (error) {
    console.error("Error cleaning up old images:", error);
  }
};

/**
 * Purges old synced visitor records to prevent database bloat
 * Keeps records for the specified number of days
 */
export const purgeOldRecords = async (keepDays = 30): Promise<number> => {
  try {
    const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

    // Find old synced records
    const oldRecords = await database
      .get<Visitor>("visitors")
      .query(
        Q.and(
          Q.where("is_synced", true),
          Q.where("timestamp", Q.lt(cutoffTime))
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
