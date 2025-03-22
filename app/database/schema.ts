import { appSchema, tableSchema } from "@nozbe/watermelondb";

// Visitor Schema
export const visitorSchema = tableSchema({
  name: "visitors",
  columns: [
    { name: "visitor_name", type: "string" },
    { name: "visitor_mobile_no", type: "string" },
    { name: "visiting_tenant_id", type: "number" },
    { name: "visitor_photo", type: "string", isOptional: true },
    { name: "timestamp", type: "number" },
    { name: "is_synced", type: "boolean" },
    { name: "server_id", type: "number", isOptional: true },
  ],
});

//companies
export const companiesSchema = tableSchema({
  name: "companies",
  columns: [
    { name: "tenant_id", type: "number" },
    { name: "tenant_name", type: "string" },
  ],
});

// Final Schema
const schema = appSchema({
  version: 6, // Increment version
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
      ],
    }),
  ],
});

export default schema;
