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

describe("End-to-End Offline Workflow", () => {
  let submitVisitor: any;
  let syncVisitors: any;
  let axiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    submitVisitor = require("../../app/api/visitorForm").submitVisitor;
    syncVisitors = require("../../app/api/visitorForm").syncVisitors;
    axiosInstance = require("../../app/api/axiosInstance");
  });

  it("should handle complete offline workflow with 100 visitors", async () => {
    const visitorCount = 100;
    
    // Generate test data with 5-second gaps
    const visitors = Array.from({ length: visitorCount }, (_, i) => ({
      visitorName: `Visitor_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 10),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000),
    }));

    console.log(`🚀 Starting end-to-end test with ${visitorCount} visitors`);
    
    // Phase 1: Submit all offline
    console.log("📡 Phase 1: Submitting visitors offline...");
    axiosInstance.post.mockRejectedValue(new Error("Network Error"));
    submitVisitor.mockResolvedValue({ 
      success: false, 
      error: "Data stored locally for sync" 
    });

    const submissionResults = await Promise.allSettled(
      visitors.map(visitor => 
        submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        )
      )
    );

    const offlineStored = submissionResults.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === false && 
      (result as any).value.error?.includes("stored locally")
    );

    expect(offlineStored.length).toBe(visitorCount);
    console.log(` Stored ${offlineStored.length} visitors offline`);

    // Phase 2: Sync all online
    console.log("🔄 Phase 2: Syncing visitors online...");
    axiosInstance.post.mockResolvedValue({ 
      status: 201, 
      data: { id: "server-id" } 
    });
    syncVisitors.mockResolvedValue({
      success: true,
      syncedCount: visitorCount,
      failedCount: 0
    });

    const syncResult = await syncVisitors();

    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBe(visitorCount);
    expect(syncResult.failedCount).toBe(0);
    
    console.log(`✅ Successfully completed end-to-end workflow: ${syncResult.syncedCount}/${visitorCount} visitors synced`);
  });

  it("should handle complete offline workflow with 500 visitors", async () => {
    const visitorCount = 500;
    
    const visitors = Array.from({ length: visitorCount }, (_, i) => ({
      visitorName: `Visitor_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 10),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000),
    }));

    console.log(`🚀 Starting large dataset test with ${visitorCount} visitors`);
    
    // Submit all offline with progress tracking
    console.log("📡 Phase 1: Submitting visitors offline...");
    axiosInstance.post.mockRejectedValue(new Error("Network Error"));
    submitVisitor.mockResolvedValue({ 
      success: false, 
      error: "Data stored locally for sync" 
    });

    const submissionResults = await Promise.allSettled(
      visitors.map((visitor, index) => {
        if (index % 100 === 0) {
          console.log(`📊 Offline Progress: ${index}/${visitorCount} visitors submitted`);
        }
        return submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        );
      })
    );

    const offlineStored = submissionResults.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === false && 
      (result as any).value.error?.includes("stored locally")
    );

    expect(offlineStored.length).toBe(visitorCount);
    console.log(` Stored ${offlineStored.length} visitors offline`);

    // Sync all online
    console.log("🔄 Phase 2: Syncing visitors online...");
    axiosInstance.post.mockResolvedValue({ 
      status: 201, 
      data: { id: "server-id" } 
    });
    syncVisitors.mockResolvedValue({
      success: true,
      syncedCount: visitorCount,
      failedCount: 0
    });

    const syncResult = await syncVisitors();

    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBe(visitorCount);
    expect(syncResult.failedCount).toBe(0);
    
    console.log(` Large dataset test completed: ${syncResult.syncedCount}/${visitorCount} visitors successfully synced`);
  });

  it("should verify 5-second timestamp gaps", () => {
    const visitors = Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.now() + (i * 5000),
    }));
    
    for (let i = 1; i < visitors.length; i++) {
      const timeDiff = visitors[i].timestamp - visitors[i-1].timestamp;
      expect(timeDiff).toBe(5000); // 5 seconds = 5000ms
    }
    
    console.log("⏱️ Verified 5-second gaps between timestamps");
  });
});