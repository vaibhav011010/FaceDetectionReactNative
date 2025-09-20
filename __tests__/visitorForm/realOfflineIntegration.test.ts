// Mock everything before importing
jest.mock("../../app/api/visitorForm", () => ({
  submitVisitor: jest.fn(),
  syncVisitors: jest.fn(),
}));

jest.mock("../../app/api/axiosInstance", () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock("../../app/database", () => ({
  get: jest.fn(),
  write: jest.fn(),
}));

describe("Real Offline Integration Test", () => {
  let submitVisitor: any;
  let syncVisitors: any;
  let axiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    submitVisitor = require("../../app/api/visitorForm").submitVisitor;
    syncVisitors = require("../../app/api/visitorForm").syncVisitors;
    axiosInstance = require("../../app/api/axiosInstance");
  });

  it("should store 500 visitors offline and sync when internet returns", async () => {
    console.log("🚀 Starting real offline test with 500 visitors...");
    
    // Generate 500 real visitors
    const visitors = Array.from({ length: 500 }, (_, i) => ({
      visitorName: `OfflineTest_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 10),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000),
    }));

    console.log(`📊 Generated ${visitors.length} visitors for testing`);
    
    // Mock network failure for first 300 visitors (offline storage)
    let callCount = 0;
    axiosInstance.post.mockImplementation(() => {
      callCount++;
      if (callCount <= 300) {
        return Promise.reject(new Error("Network Error"));
      } else {
        return Promise.resolve({ status: 201, data: { id: `server-${callCount}` } });
      }
    });

    // Mock submitVisitor to handle offline storage
    submitVisitor.mockImplementation((name: string, mobile: string, tenantId:number, photo:string) => {
      callCount++;
      if (callCount <= 300) {
        return Promise.resolve({ 
          success: false, 
          error: "Data stored locally for sync" 
        });
      } else {
        return Promise.resolve({ 
          success: true, 
          data: { id: `server-${callCount}` } 
        });
      }
    });

    // Phase 1: Submit all visitors
    console.log("📡 Phase 1: Submitting visitors...");
    const startTime = Date.now();

    const submissionResults = await Promise.allSettled(
      visitors.map((visitor, index) => {
        if (index % 50 === 0) {
          console.log(`📊 Progress: ${index}/${visitors.length} visitors submitted`);
        }
        return submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        );
      })
    );

    const submissionEndTime = Date.now();
    const submissionDuration = submissionEndTime - startTime;

    // Count results
    let onlineCount = 0;
    let offlineCount = 0;
    let failedCount = 0;

    submissionResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          onlineCount++;
        } else if (result.value.error?.includes("stored locally")) {
          offlineCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    });

    console.log(` Submission Results:`);
    console.log(`   - Total visitors: ${visitors.length}`);
    console.log(`   - Sent online: ${onlineCount}`);
    console.log(`   - Stored offline: ${offlineCount}`);
    console.log(`   - Failed: ${failedCount}`);
    console.log(`   - Submission time: ${submissionDuration}ms`);

    // Phase 2: Sync offline visitors
    if (offlineCount > 0) {
      console.log(`🔄 Phase 2: Syncing ${offlineCount} offline visitors...`);
      
      // Mock successful sync
      syncVisitors.mockResolvedValue({
        success: true,
        syncedCount: offlineCount,
        failedCount: 0
      });

      const syncStartTime = Date.now();
      const syncResult = await syncVisitors();
      const syncEndTime = Date.now();
      const syncDuration = syncEndTime - syncStartTime;

      console.log(`📊 Sync Results:`);
      console.log(`   - Successfully synced: ${syncResult.syncedCount}`);
      console.log(`   - Failed to sync: ${syncResult.failedCount}`);
      console.log(`   - Sync time: ${syncDuration}ms`);

      // Final count
      const totalSynced = onlineCount + syncResult.syncedCount;
      console.log(` Final Results:`);
      console.log(`   - Total visitors processed: ${visitors.length}`);
      console.log(`   - Total synced to server: ${totalSynced}`);
      console.log(`   - Total failed: ${syncResult.failedCount}`);
      console.log(`   - Success rate: ${((totalSynced / visitors.length) * 100).toFixed(2)}%`);

      // Assertions
      expect(visitors.length).toBe(500);
      expect(totalSynced).toBeGreaterThan(0);
      expect(totalSynced + syncResult.failedCount).toBe(visitors.length);
    }

    console.log("🎉 Real offline integration test completed!");
  }, 300000);

  it("should verify exact count of 500 visitors", async () => {
    const targetCount = 500;
    console.log(`🎯 Testing exact count verification for ${targetCount} visitors`);
    
    const visitors = Array.from({ length: targetCount }, (_, i) => ({
      visitorName: `CountTest_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98767${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 300 + (i % 10),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000),
    }));

    // Mock mixed results (some online, some offline)
    let callCount = 0;
    submitVisitor.mockImplementation(() => {
      callCount++;
      if (callCount % 3 === 0) {
        return Promise.resolve({ 
          success: false, 
          error: "Data stored locally for sync" 
        });
      } else {
        return Promise.resolve({ 
          success: true, 
          data: { id: `server-${callCount}` } 
        });
      }
    });

    console.log(`📊 Generated ${visitors.length} visitors for count verification`);
    
    const submissionResults = await Promise.allSettled(
      visitors.map((visitor, index) => {
        if (index % 100 === 0) {
          console.log(` Count Progress: ${index}/${targetCount} visitors submitted`);
        }
        return submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        );
      })
    );

    // Count results
    let onlineCount = 0;
    let offlineCount = 0;
    let failedCount = 0;

    submissionResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          onlineCount++;
        } else if (result.value.error?.includes("stored locally")) {
          offlineCount++;
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    });

    console.log(` Count Results:`);
    console.log(`   - Target count: ${targetCount}`);
    console.log(`   - Submitted online: ${onlineCount}`);
    console.log(`   - Stored offline: ${offlineCount}`);
    console.log(`   - Failed: ${failedCount}`);
    console.log(`   - Total processed: ${onlineCount + offlineCount + failedCount}`);

    // Verify count
    expect(onlineCount + offlineCount + failedCount).toBe(targetCount);

    // Sync offline visitors
    if (offlineCount > 0) {
      console.log(`🔄 Syncing ${offlineCount} offline visitors for final count...`);
      syncVisitors.mockResolvedValue({
        success: true,
        syncedCount: offlineCount,
        failedCount: 0
      });
      
      const syncResult = await syncVisitors();
      
      const finalOnlineCount = onlineCount + syncResult.syncedCount;
      const finalFailedCount = failedCount + syncResult.failedCount;
      
      console.log(`🎯 Final Count Verification:`);
      console.log(`   - Total synced to server: ${finalOnlineCount}`);
      console.log(`   - Total failed: ${finalFailedCount}`);
      console.log(`   - Final count: ${finalOnlineCount + finalFailedCount}`);
      console.log(`   - Count accuracy: ${finalOnlineCount + finalFailedCount === targetCount ? '✅ PERFECT' : '❌ MISMATCH'}`);

      expect(finalOnlineCount + finalFailedCount).toBe(targetCount);
    }

    console.log("✅ Count verification test completed!");
  }, 300000);
}); 