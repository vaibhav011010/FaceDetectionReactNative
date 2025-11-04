import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { Q } from "@nozbe/watermelondb";
import database from "../../../app/database";
import Log from "../../../app/database/models/LogModel";

const BASE_URL = "https://webapptest3.online/mobile";
const OLD_LOG_CUTOFF_DAYS = 30;
const MAX_RETRIES = 3;
const BATCH_SIZE = 200; // NEW: Prevent huge server payloads

interface LogMetadata {
  [key: string]: any;
}

interface SyncIssueRecord {
  uuid: string;
  name: string;
  mobile: string;
  corporateParkId: number;
  buildingId: number;
  tenantId: number;
  created: string;
  syncStatus: string;
  synced: boolean;
}

class Logger {
  private static instance: Logger;
  private isSyncing = false;
  private syncScheduled = false; // NEW: prevent sync spam

  static getInstance() {
    if (!Logger.instance) Logger.instance = new Logger();
    Logger.instance.registerListeners(); // NEW: triggers auto sync handling
    return Logger.instance;
  }

  // 🔄 NEW: Trigger sync when app is foreground or internet returns
  private registerListeners() {
    NetInfo.addEventListener((state) => {
      if (state.isConnected) this.scheduleSync();
    });

    AppState.addEventListener("change", (state) => {
      if (state === "active") this.scheduleSync();
    });
  }

  private scheduleSync() {
    if (this.syncScheduled) return;
    this.syncScheduled = true;
    setTimeout(() => {
      this.syncScheduled = false;
      this.trySyncLogs();
    }, 2000);
  }

  async info(message: string, metadata: LogMetadata = {}) {
    await this.saveLog("INFO", message, metadata);
  }

  async error(message: string, metadata: LogMetadata = {}) {
    await this.saveLog("ERROR", message, metadata);
  }

  async debug(message: string, metadata: LogMetadata = {}) {
    await this.saveLog("DEBUG", message, metadata);
  }

  private async saveLog(level: string, message: string, metadata: LogMetadata) {
    if (__DEV__) {
      console.log(`[DEV LOG][${level}]`, message, metadata);
    }

    const logCollection = database.get<Log>(Log.table);

    await database.write(async () => {
      await logCollection.create((log) => {
        log.level = level;
        log.message = message;
        log.timestamp = new Date().toISOString();
        log.metadata = JSON.stringify(metadata);
        log.synced = false;
      });
    });

    this.scheduleSync(); // 🔄 NEW: Debounced sync
  }

  private async trySyncLogs() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) return;

      let healthy = false;
      try {
        healthy = await this.checkServerHealth();
      } catch {}
      if (!healthy)
        console.warn("⚠️ Server unhealthy — will try syncing anyway");

      await this.syncAllLogs();
      await this.deleteOldLogs();
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncAllLogs(retryCount = 0): Promise<void> {
    const logCollection = database.get<Log>(Log.table);
    const unsyncedLogs = await logCollection
      .query(Q.where("synced", false))
      .fetch();

    if (!unsyncedLogs.length) return;

    // ✅ Upload in batches to avoid timeouts
    const batch = unsyncedLogs.slice(0, BATCH_SIZE);

    const payload = {
      logs: batch.map((log) => ({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp,
        metadata: JSON.parse(log.metadata || "{}"),
      })),
    };

    try {
      const res = await axios.post(`${BASE_URL}/logs/mobile/`, payload, {
        timeout: 8000,
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 200 && res.data.success) {
        await database.write(async () => {
          for (const log of batch) {
            await log.update((rec) => (rec.synced = true));
          }
        });

        console.log(`✅ Synced ${batch.length} logs`);

        if (unsyncedLogs.length > BATCH_SIZE) {
          // Continue next batch
          await this.syncAllLogs();
        }
      }
    } catch (err) {
      if (retryCount < MAX_RETRIES) {
        const delay = 2000 * 2 ** retryCount;
        console.log(`🔁 Retry in ${delay}ms`);
        setTimeout(() => this.syncAllLogs(retryCount + 1), delay);
      } else {
        console.log("❌ Log sync failed:", err);
      }
    }
  }

  private async checkServerHealth(): Promise<boolean> {
    try {
      const res = await axios.get(`${BASE_URL}/logs/health/`, {
        timeout: 4000,
      });
      return res.status === 200 && res.data.status === "healthy";
    } catch {
      return false;
    }
  }
  async reportSyncIssues(records: SyncIssueRecord[]) {
    if (__DEV__ || !records?.length) return;

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) return;

      // backend expects "visitorRecords", not "unsyncedRecords"
      const payload = { visitorRecords: records };

      const res = await axios.post(`${BASE_URL}/logs/sync-issues/`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 8000,
      });

      if (res.status === 200 || res.status === 201) {
        console.log("✅ Sync issues reported successfully");
      } else {
        console.warn(
          `⚠️ Unexpected response while reporting sync issues: ${res.status}`
        );
      }
    } catch (err: any) {
      console.warn("⚠️ Failed to report sync issues", err.message || err);
    }
  }

  async deleteOldLogs() {
    const logCollection = database.get<Log>(Log.table);
    const allLogs = await logCollection.query().fetch();
    const now = Date.now();
    const cutoff = OLD_LOG_CUTOFF_DAYS * 24 * 60 * 60 * 1000;

    const oldLogs = allLogs.filter(
      (log) => now - new Date(log.timestamp).getTime() > cutoff
    );

    if (oldLogs.length) {
      await database.write(async () => {
        for (const log of oldLogs) await log.destroyPermanently();
      });
      console.log(`🧹 Old logs deleted: ${oldLogs.length}`);
    }
  }
}

export const AppLogger = Logger.getInstance();
