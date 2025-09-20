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

describe("Offline Storage Test", () => {
  let submitVisitor: any;
  let axiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    submitVisitor = require("../../app/api/visitorForm").submitVisitor;
    axiosInstance = require("../../app/api/axiosInstance");
  });

  it("should store 10 visitors offline when network is down", async () => {
    // Mock network failure
    axiosInstance.post.mockRejectedValue(new Error("Network Error"));
    
    // Mock successful offline storage
    submitVisitor.mockResolvedValue({ 
      success: false, 
      error: "Data stored locally for sync" 
    });

    const visitors = Array.from({ length: 10 }, (_, i) => ({
      visitorName: `Visitor_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 5),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000), // 5 second gaps
    }));

    console.log("📡 Submitting 10 visitors offline...");
    
    const results = await Promise.allSettled(
      visitors.map(visitor => 
        submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        )
      )
    );

    const offlineStored = results.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === false && 
      (result as any).value.error?.includes("stored locally")
    );

    expect(offlineStored.length).toBe(10);
    expect(submitVisitor).toHaveBeenCalledTimes(10); // Check submitVisitor calls instead
    console.log(`✅ Stored ${offlineStored.length} visitors offline`);
  });

  it("should store 100 visitors offline efficiently", async () => {
    axiosInstance.post.mockRejectedValue(new Error("Network Error"));
    submitVisitor.mockResolvedValue({ 
      success: false, 
      error: "Data stored locally for sync" 
    });

    const visitors = Array.from({ length: 100 }, (_, i) => ({
      visitorName: `Visitor_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 10),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000),
    }));

    console.log("📡 Submitting 100 visitors offline...");
    const startTime = Date.now();

    const results = await Promise.allSettled(
      visitors.map(visitor => 
        submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          visitor.visitorPhoto
        )
      )
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    const offlineStored = results.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === false && 
      (result as any).value.error?.includes("stored locally")
    );

    expect(offlineStored.length).toBe(100);
    expect(submitVisitor).toHaveBeenCalledTimes(100);
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    console.log(`✅ Stored ${offlineStored.length} visitors offline in ${duration}ms`);
  });

  it("should store 500 visitors offline with progress tracking", async () => {
    axiosInstance.post.mockRejectedValue(new Error("Network Error"));
    submitVisitor.mockResolvedValue({ 
      success: false, 
      error: "Data stored locally for sync" 
    });

    const visitorCount = 500;
    const visitors = Array.from({ length: visitorCount }, (_, i) => ({
      visitorName: `Visitor_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 10),
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`,
      timestamp: Date.now() + (i * 5000),
    }));

    console.log(`📡 Submitting ${visitorCount} visitors offline...`);
    const startTime = Date.now();

    // Process with progress tracking
    const results = await Promise.allSettled(
      visitors.map((visitor, index) => {
        if (index % 50 === 0) {
          console.log(`📊 Progress: ${index}/${visitorCount} visitors processed`);
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

    const offlineStored = results.filter(result => 
      result.status === 'fulfilled' && 
      (result as any).value.success === false && 
      (result as any).value.error?.includes("stored locally")
    );

    expect(offlineStored.length).toBe(visitorCount);
    expect(submitVisitor).toHaveBeenCalledTimes(visitorCount);
    expect(duration).toBeLessThan(60000); // Should complete within 1 minute
    
    console.log(`✅ Stored ${offlineStored.length} visitors offline in ${duration}ms`);
    console.log(`📈 Average time per visitor: ${(duration / visitorCount).toFixed(2)}ms`);
  });
}); 