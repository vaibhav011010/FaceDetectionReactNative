import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class Company extends Model {
  static table = "companies";

  @field("tenant_id") tenantId!: number; // Store tenant ID
  @text("tenant_name") tenantName!: string;
  @text("user_id") userId!: string;
}
