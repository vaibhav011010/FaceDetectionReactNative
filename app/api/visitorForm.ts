import axiosInstance from "../api/axiosInstance";
import database from "../database";
import Visitor from "../database/models/Visitor";
import { Q } from "@nozbe/watermelondb";

// Use the relative endpoint as baseURL is set in axiosInstance
const API_ENDPOINT = "/visitors/add_visitor/";

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
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const payload = {
      visitor_name: visitorName,
      visitor_photo: visitorPhotoBase64,
      visitor_mobile_no: visitorMobileNo,
      visiting_tenant_id: visitingTenantId,
    };
    console.log("Submitting payload:", {
      ...payload,
      visitor_photo: payload.visitor_photo.substring(0, 100) + "...",
      photoLength: payload.visitor_photo.length,
    });

    // Generate a unique image name using timestamp
    const timestamp = new Date().getTime();
    const imageName = `visitor_${timestamp}.jpg`;

    const photoObject = {
      image_name: imageName, // Dynamically generated image name
      image_base64: visitorPhotoBase64, // Send only base64 without `data:image/jpeg;base64,` prefix
    };

    const response = await axiosInstance.post(API_ENDPOINT, {
      visitor_name: visitorName,
      photo: photoObject,
      visitor_mobile_no: visitorMobileNo,
      visiting_tenant_id: visitingTenantId,
    });
    // On successful API call, store the record locally as synced.
    await database.write(async () => {
      await database.get<Visitor>("visitors").create((visitor) => {
        visitor.visitorName = visitorName;
        visitor.visitorMobileNo = visitorMobileNo;
        visitor.visitingTenantId = visitingTenantId;
        visitor.visitorPhoto = visitorPhotoBase64;
        visitor.isSynced = true;
      });
    });
    return { success: true, data: response.data };
  } catch (error: any) {
    // console.error(
    //   "submitVisitor error:",
    //   error.toJSON ? error.toJSON() : error
    // );
    // If it's a network error, store the record as unsynced.
    if (error.message && error.message.includes("Network Error")) {
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
      return { success: false, error: "Data stored locally for sync" };
    }
    throw error;
  }
};

/**
 * Syncs all unsynced visitor records with the API.
 * For each unsynced record, it posts the data to the API and marks the record as synced upon success.
 */
export const syncVisitors = async (): Promise<void> => {
  try {
    // Query unsynced visitor records
    const unsyncedVisitors = await database
      .get<Visitor>("visitors")
      .query(Q.where("is_synced", false))
      .fetch();

    for (const visitor of unsyncedVisitors) {
      try {
        const response = await axiosInstance.post(API_ENDPOINT, {
          visitor_name: visitor.visitorName,
          visitor_photo: visitor.visitorPhoto,
          visitor_mobile_no: visitor.visitorMobileNo,
          visiting_tenant_id: visitor.visitingTenantId,
          timestamp: visitor.timestamp,
        });
        // Mark record as synced if API call is successful
        await database.write(async () => {
          await visitor.update((v: Visitor) => {
            v.isSynced = true;
          });
        });
        console.log(`Visitor ${visitor.id} synced successfully.`);
      } catch (error) {
        console.error("Sync failed for visitor", visitor.id, error);
        // Optionally, implement retry/backoff logic here.
      }
    }
  } catch (error) {
    console.error("Error during visitor sync:", error);
  }
};
