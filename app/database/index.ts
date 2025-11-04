import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { Platform } from "react-native";
import schema from "./schema";
import UserModel from "./models/User";
import Company from "./models/Company";
import migrations from "./migrations";
import VisitorModel from "./models/Visitor"; // Import Visitor model
import LogModel from "./models/LogModel";

// SQLite adapter configuration with platform-specific settings
const adapter = new SQLiteAdapter({
  schema,
  // migrations,      *use this when changing something in the data base*
  dbName: "VisitorDB",
  jsi: Platform.OS !== "web",
  onSetUpError: (error) => {
    console.error("Database setup error:", error);
  },
});

// Create the database instance
const database = new Database({
  adapter,
  modelClasses: [UserModel, VisitorModel, Company, LogModel],
});

export default database;
