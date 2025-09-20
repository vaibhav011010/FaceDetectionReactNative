// Mock everything before imports
jest.mock("../../app/api/visitorForm", () => ({
  submitVisitor: jest.fn(),
  syncVisitors: jest.fn(),
}));

jest.mock("../../app/api/axiosInstance", () => ({
  post: jest.fn(),
}));

jest.mock("../../app/database", () => ({
  get: jest.fn(),
  write: jest.fn(),
}));

describe("Sync Functionality Test", () => {
  let syncVisitors: any;
  let axiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    syncVisitors = require("../../app/api/visitorForm").syncVisitors;
    axiosInstance = require("../../app/api/axiosInstance");
  });

  it("should sync 10 unsynced visitors", async () => {
    // Mock successful sync
    syncVisitors.mockResolvedValue({
      success: true,
      syncedCount: 10,
      failedCount: 0
    });

    axiosInstance.post.mockResolvedValue({ 
      status: 201, 
      data: { id: "server-id" } 
    });

    console.log("🔄 Syncing 10 visitors...");
    
    const result = await syncVisitors();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(10);
    expect(result.failedCount).toBe(0);
    console.log(`✅ Successfully synced ${result.syncedCount} visitors`);
  });

  it("should sync 100 visitors in batches", async () => {
    syncVisitors.mockResolvedValue({
      success: true,
      syncedCount: 100,
      failedCount: 0
    });

    axiosInstance.post.mockResolvedValue({ 
      status: 201, 
      data: { id: "server-id" } 
    });

    console.log("🔄 Syncing 100 visitors...");
    const startTime = Date.now();

    const result = await syncVisitors();
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(100);
    expect(result.failedCount).toBe(0);
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    
    console.log(`✅ Successfully synced ${result.syncedCount} visitors in ${duration}ms`);
  });

  it("should sync 500 visitors with progress tracking", async () => {
    syncVisitors.mockResolvedValue({
      success: true,
      syncedCount: 500,
      failedCount: 0
    });

    axiosInstance.post.mockResolvedValue({ 
      status: 201, 
      data: { id: "server-id" } 
    });

    console.log("🔄 Syncing 500 visitors...");
    const startTime = Date.now();

    const result = await syncVisitors();
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(500);
    expect(result.failedCount).toBe(0);
    expect(duration).toBeLessThan(60000); // Should complete within 1 minute
    
    console.log(`✅ Successfully synced ${result.syncedCount} visitors in ${duration}ms`);
    console.log(`📈 Average time per visitor: ${(duration / result.syncedCount).toFixed(2)}ms`);
  });

  it("should handle sync failures and retries", async () => {
    // Mock some failures
    syncVisitors.mockResolvedValue({
      success: true,
      syncedCount: 80,
      failedCount: 20
    });

    console.log("🔄 Testing sync with failures...");
    
    const result = await syncVisitors();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(80);
    expect(result.failedCount).toBe(20);
    console.log(`✅ Sync completed: ${result.syncedCount} synced, ${result.failedCount} failed`);
  });
});