import { schemaMigrations } from "@nozbe/watermelondb/Schema/migrations";

// Start with version 5 as the base for future migrations
export default schemaMigrations({
  migrations: [
    // Future migrations will be added here
    // Example of what a future migration might look like:
    // {
    //   toVersion: 6,
    //   steps: [
    //     // Migration steps when you update schema to version 6
    //   ]
    // }
  ],
});
