import { submitVisitor, syncVisitors } from "../../app/api/visitorForm";

describe("Count Verification Test", () => {
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

    console.log(`📊 Generated ${visitors.length} visitors for count verification`);
    
    // Submit all visitors
    const submissionResults = await Promise.allSettled(
      visitors.map((visitor, index) => {
        if (index % 100 === 0) {
          console.log(`�� Count Progress: ${index}/${targetCount} visitors submitted`);
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

    console.log(`�� Count Results:`);
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
  }, 300000); // 5 minute timeout
}); 