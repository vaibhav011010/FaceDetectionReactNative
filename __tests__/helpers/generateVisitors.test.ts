import { generateMockVisitors } from "./generateVisitors";

describe("Generate Visitors", () => {
  it("should generate mock visitors", () => {
    const visitors = generateMockVisitors(5);
    expect(visitors).toHaveLength(5);
    expect(visitors[0]).toHaveProperty('visitorName');
  });
}); 