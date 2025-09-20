// NO MOCKING - This will call your real API
import { submitVisitor, syncVisitors } from "../../app/api/visitorForm";

describe("REAL API Test - Actually Sending Data to Server", () => {
  it("should send 50 REAL visitors to your server", async () => {
    console.log("🚀 Sending 50 REAL visitors to your server...");
    
    // Generate real test data
    const visitors = Array.from({ length: 50 }, (_, i) => ({
      visitorName: `RealTest_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 5), // 5 different companies
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`, // 1KB test image
      timestamp: Date.now() + (i * 5000), // 5 second gaps
    }));

    let onlineCount = 0;
    let offlineCount = 0;
    let failedCount = 0;

    console.log("📡 Submitting visitors to REAL API...");
    
    // Submit each visitor to your REAL API
    for (let i = 0; i < visitors.length; i++) {
      const visitor = visitors[i];
      
      if (i % 10 === 0) {
        console.log(`📊 Progress: ${i}/${visitors.length} visitors submitted`);
      }
      
      try {
        console.log(` Submitting: ${visitor.visitorName}`);
        
        const result = await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        );

        if (result.success) {
          onlineCount++;
          console.log(`✅ Success: ${visitor.visitorName} sent online`);
        } else if (result.error?.includes("stored locally")) {
          offlineCount++;
          console.log(` Offline: ${visitor.visitorName} stored locally`);
        } else {
          failedCount++;
          console.log(`❌ Failed: ${visitor.visitorName} - ${result.error}`);
        }
      } catch (error) {
        failedCount++;
        console.log(`❌ Error: ${visitor.visitorName} - ${error}`);
      }

      // Wait 1 second between submissions to avoid overwhelming your server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(` REAL API Results:`);
    console.log(`   - Total visitors: ${visitors.length}`);
    console.log(`   - Sent online: ${onlineCount}`);
    console.log(`   - Stored offline: ${offlineCount}`);
    console.log(`   - Failed: ${failedCount}`);

    // If there are offline visitors, try to sync them
    if (offlineCount > 0) {
      console.log(`🔄 Syncing ${offlineCount} offline visitors...`);
      
      try {
        const syncResult = await syncVisitors();
        console.log(`📊 Sync Results:`);
        console.log(`   - Successfully synced: ${syncResult.syncedCount}`);
        console.log(`   - Failed to sync: ${syncResult.failedCount}`);
        
        const totalSynced = onlineCount + syncResult.syncedCount;
        console.log(` Final Results:`);
        console.log(`   - Total synced to server: ${totalSynced}`);
        console.log(`   - Total failed: ${syncResult.failedCount + failedCount}`);
        console.log(`   - Success rate: ${((totalSynced / visitors.length) * 100).toFixed(2)}%`);
      } catch (error) {
        console.log(`❌ Sync failed: ${error}`);
      }
    }

    // Check your admin panel now - you should see visitors with names like:
    // RealTest_001, RealTest_002, etc.
    console.log("🎯 Check your admin panel - you should see the test visitors!");
  }, 300000); // 5 minute timeout
}); 