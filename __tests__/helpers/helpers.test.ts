import { mockUnsyncedVisitors, mockDB, resetMocks } from "./helpers";

describe("Test Helpers", () => {
  it("should have mock data", () => {
    expect(mockUnsyncedVisitors).toBeDefined();
    expect(mockDB).toBeDefined();
    expect(resetMocks).toBeDefined();
  });
}); 