import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import schema from "../../app/database/schema";
import Visitor from "../../app/database/models/Visitor";
import User from "../../app/database/models/User";
import Company from "../../app/database/models/Company";

const adapter = new LokiJSAdapter({
	schema,
	useWebWorker: false,
	useIncrementalIndexedDB: false,
	dbName: "jest-db",
});

const database = new Database({
	adapter,
	modelClasses: [Visitor, User, Company],
});

export default database; 