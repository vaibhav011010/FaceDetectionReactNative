import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { Platform } from "react-native";
import schema from "./schema";
import UserModel from "./models/User";
import Company from "./models/Company";
import VisitorModel from "./models/Visitor"; // Import Visitor model

// SQLite adapter configuration with platform-specific settings
const adapter = new SQLiteAdapter({
  schema,
  dbName: "VisitorDB",
  jsi: Platform.OS !== "web",
  onSetUpError: (error) => {
    console.error("Database setup error:", error);
  },
});

// Create the database instance
const database = new Database({
  adapter,
  modelClasses: [UserModel, VisitorModel, Company],
});

export default database;
