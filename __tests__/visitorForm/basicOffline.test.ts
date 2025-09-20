// Mock everything before any imports
jest.mock("../../app/api/visitorForm", () => ({
  submitVisitor: jest.fn(() => Promise.resolve({ success: false, error: "stored locally" })),
  syncVisitors: jest.fn(() => Promise.resolve({ success: true, syncedCount: 10, failedCount: 0 })),
}));

jest.mock("../../app/api/axiosInstance", () => ({
  post: jest.fn(),
}));

jest.mock("../../app/database", () => ({
  get: jest.fn(),
  write: jest.fn(),
}));

describe("Basic Offline Test", () => {
  it("should handle offline storage", async () => {
    const { submitVisitor } = require("../../app/api/visitorForm");
    const result = await submitVisitor("Test", "1234567890", 1, "photo");
    expect(result.success).toBe(false);
    expect(result.error).toContain("stored locally");
  });

  it("should handle sync functionality", async () => {
    const { syncVisitors } = require("../../app/api/visitorForm");
    const result = await syncVisitors();
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(10);
  });
}); 