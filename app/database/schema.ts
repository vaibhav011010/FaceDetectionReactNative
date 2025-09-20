import { appSchema, tableSchema } from "@nozbe/watermelondb";

// Visitor Schema
export const visitorSchema = tableSchema({
  name: "visitors",
  columns: [
    { name: "visitor_name", type: "string" },
    { name: "visitor_mobile_no", type: "string" },
    { name: "visiting_tenant_id", type: "number" },
    { name: "visitor_photo_name", type: "string", isOptional: true },
    { name: "visitor_photo", type: "string", isOptional: true },
    { name: "timestamp", type: "number" },
    { name: "is_synced", type: "boolean" },
    { name: "server_id", type: "number", isOptional: true },
    // ✅ New fields for sync handling
    { name: "visitor_sync_status", type: "string", isOptional: true },
    { name: "record_uuid", type: "string", isOptional: true },
    { name: "created_by_user_id", type: "number" },
    // schema.ts → visitorSchema.columns
    { name: "last_sync_attempt", type: "number", isOptional: true },
    { name: "sync_retry_count", type: "number", isOptional: true },
    { name: "created_datetime", type: "string", isOptional: true },
  ],
});

//companies
export const companiesSchema = tableSchema({
  name: "companies",
  columns: [
    { name: "tenant_id", type: "number" },
    { name: "tenant_name", type: "string" },
    { name: "tenant_unit_number", type: "string" },
    { name: "user_id", type: "string" },
  ],
});

// Final Schema
const schema = appSchema({
  version: 19, // Increment version
  tables: [
    visitorSchema,
    companiesSchema, // ✅ Add this
    tableSchema({
      name: "users",
      columns: [
        { name: "user_id", type: "number" },
        { name: "email", type: "string", isIndexed: true },
        { name: "corporate_park_id", type: "number" },
        { name: "corporate_park_name", type: "string" },
        { name: "role_id", type: "number" },
        { name: "role_name", type: "string" },
        { name: "permissions", type: "string" },
        { name: "access_token", type: "string" },
        { name: "refresh_token", type: "string" },
        { name: "is_logged_in", type: "boolean", isOptional: true },
        { name: "is_first_login", type: "boolean", isOptional: true },
        { name: "needs_password_change", type: "boolean" },
        // { name: "pending_server_logout", type: "boolean", isOptional: true },
      ],
    }),
  ],
});

export default schema;
