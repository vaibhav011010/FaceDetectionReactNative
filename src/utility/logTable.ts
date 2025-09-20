import database from "../../app/database/index";

export const logTableData = async (tableName: string) => {
  try {
    const collection = database.collections.get(tableName);
    const records = await collection.query().fetch();

    console.log(`🔎 Table: ${tableName}`);
    console.log(`Total records: ${records.length}`);
    if (records.length > 0) {
      console.log("Sample record:", records[0]._raw); // full row data
    }
  } catch (error) {
    console.error(`Error reading ${tableName}:`, error);
  }
};
