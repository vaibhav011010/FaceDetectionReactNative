import { submitVisitor, syncVisitors } from "../../app/api/visitorForm";

describe("Real Integration Test - Sending Actual Data", () => {
  let realVisitors: any[] = [];

  beforeAll(() => {
    // Generate real test data
    realVisitors = Array.from({ length: 10 }, (_, i) => ({
      visitorName: `TestVisitor_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 5),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`, // 1KB test image
      timestamp: Date.now() + (i * 5000), // 5 second gaps
    }));
  });

  it("should send 10 real visitors to your server", async () => {
    console.log("🚀 Sending 10 REAL visitors to your server...");
    
    const results = await Promise.allSettled(
      realVisitors.map((visitor, index) => {
        console.log(`�� Sending visitor ${index + 1}: ${visitor.visitorName}`);
        return submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        );
      })
    );

    // Check results
    const successful = results.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === true
    );

    const offlineStored = results.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === false && 
      (result as any).value.error?.includes("stored locally")
    );

    console.log(`✅ Results: ${successful.length} sent online, ${offlineStored.length} stored offline`);
    
    // If some were stored offline, try to sync them
    if (offlineStored.length > 0) {
      console.log("🔄 Syncing offline visitors...");
      const syncResult = await syncVisitors();
      console.log(`🔄 Sync result: ${syncResult.syncedCount} synced, ${syncResult.failedCount} failed`);
    }

    expect(results.length).toBe(10);
  }, 60000); // 1 minute timeout for real API calls

  it("should send 50 real visitors with progress tracking", async () => {
    const largeDataset = Array.from({ length: 50 }, (_, i) => ({
      visitorName: `LargeTest_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98766${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 200 + (i % 10),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000),
    }));

    console.log("🚀 Sending 50 REAL visitors to your server...");
    const startTime = Date.now();

    const results = await Promise.allSettled(
      largeDataset.map((visitor, index) => {
        if (index % 10 === 0) {
          console.log(`📊 Progress: ${index}/50 visitors sent`);
        }
        return submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        );
      })
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    const successful = results.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === true
    );

    const offlineStored = results.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === false && 
      (result as any).value.error?.includes("stored locally")
    );

    console.log(`✅ Large dataset results: ${successful.length} sent online, ${offlineStored.length} stored offline`);
    console.log(`⏱️ Total time: ${duration}ms`);

    // Sync any offline data
    if (offlineStored.length > 0) {
      console.log("🔄 Syncing remaining offline visitors...");
      const syncResult = await syncVisitors();
      console.log(`�� Final sync: ${syncResult.syncedCount} synced, ${syncResult.failedCount} failed`);
    }

    expect(results.length).toBe(50);
  }, 120000); // 2 minute timeout
}); 