import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const visitorSchema = tableSchema({
  name: "visitors",
  columns: [
    { name: "visitor_name", type: "string" },
    { name: "visitor_mobile_no", type: "string" },
    { name: "visiting_tenant_id", type: "number" },
    { name: "visitor_photo", type: "string", isOptional: true },
    { name: "timestamp", type: "number" },
    { name: "is_synced", type: "boolean" },
  ],
});
const schema = appSchema({
  version: 3, // bumped version
  tables: [
    visitorSchema,
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
