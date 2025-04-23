import { Model } from "@nozbe/watermelondb";
import { field, readonly } from "@nozbe/watermelondb/decorators";

export default class Visitor extends Model {
  static table = "visitors";

  @field("visitor_name") visitorName!: string;
  @field("visitor_mobile_no") visitorMobileNo!: string;
  @field("visiting_tenant_id") visitingTenantId!: number;
  @field("visitor_photo") visitorPhoto!: string;
  @field("timestamp") timestamp!: number;
  @field("is_synced") isSynced!: boolean;
  @field("server_id") serverId: string | number | null | undefined;
  // ✅ Add these two fields for sync handling
  @field("record_uuid") recordUuid!: string;
  @field("visitor_sync_status") visitorSyncStatus!: "synced" | "not_synced";
  @field("visitor_photo_name") visitorPhotoName!: string;
}
