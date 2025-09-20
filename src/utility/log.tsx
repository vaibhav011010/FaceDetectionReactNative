import database from "../../app/database/index";
import Visitor from "../../app/database/models/Visitor";
import { Q } from "@nozbe/watermelondb";

export const logAllVisitors = async () => {
  try {
    const allVisitors = await database.get<Visitor>("visitors").query().fetch();
    console.log("===== VISITORS IN DB =====");
    allVisitors.forEach((v) => {
      console.log({
        id: v.id,
        uuid: v.recordUuid,
        name: v.visitorName,
        mobile: v.visitorMobileNo,
        synced: v.isSynced,
        syncStatus: v.visitorSyncStatus,
        serverId: v.serverId,
        created: v.createdDatetime,
      });
    });
    console.log("===========================");
  } catch (err) {
    console.error("Error fetching visitors:", err);
  }
};
