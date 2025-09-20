// __tests__/apiConnection.test.ts

// ---------------------
import { v4 as uuidv4 } from "uuid";

// Mock WatermelonDB & native dependencies
// ---------------------
jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    where: jest.fn(),
    and: jest.fn(),
    notEq: jest.fn(),
    lt: jest.fn(),
  },
}));

jest.mock("react-native-get-random-values", () => ({}));

jest.mock("../../app/database", () => ({
  get: jest.fn(),
  write: jest.fn(),
}));

// ---------------------
// Mock auth with hardcoded token
// ---------------------
const photoObject = {
  image_name: "dummy.png",
  image_base64:"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"

}

// TODO: Paste your real API token below:
const REAL_API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU1MjU1MjM0LCJpYXQiOjE3NTUxNjg4MzQsImp0aSI6IjhjMWI0NGE3ZDg3NTRlNzBhYWMxOWNlZDYyZTIyYzJjIiwidXNlcl9pZCI6NH0.IR2U2zjV3_PKDbnZ2n27wHAqlZgqc9zk1YEo1i_cAz4";

jest.mock("../../app/api/auth", () => ({
  getCurrentUserId: jest.fn(async () => 1),
  getTokensForUser: jest.fn(async () => ({
    accessToken: REAL_API_TOKEN,
    refreshToken: "mock-refresh-token",
  })),
  refreshAccessTokenForUser: jest.fn(async () => REAL_API_TOKEN),
  getAccessToken: jest.fn(async () => REAL_API_TOKEN),
}));

// ---------------------
// Mock NetInfo
// ---------------------
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(async () => ({ isConnected: true })),
  addEventListener: jest.fn(() => () => {}),
}));

// ---------------------
// The actual test
// ---------------------
describe("API Connection Test", () => {
  it("should send a test visitor to the live API", async () => {
    const axiosInstance = require("../../app/api/axiosInstance").default;
    const { getAccessToken } = require("../../app/api/auth");

    console.log("🔍 Getting token from mock auth...");
    const realToken = await getAccessToken();

    if (!realToken || realToken === "PASTE-YOUR-REAL-TOKEN-HERE") {
      console.error("❌ No valid token found. Please paste a real API token in REAL_API_TOKEN constant.");
      return;
    }

    console.log("✅ Using token:", realToken.substring(0, 20) + "...");

    // Attach token to Axios headers
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${realToken}`;

    // Test visitor payload
    const testVisitor = {
      visitor_name: "TestVisitor_001",
      visitor_mobile_no: "98765000001",
      visiting_tenant_id: 100,
      photo: {
        image_name: "dummy.png",
        image_base64: photoObject,
      },
      uuid: uuidv4(),
      created_datetime: new Date().toISOString(),
    };

    try {
      console.log("📤 Sending test visitor to API...");
      const response = await axiosInstance.post("/visitors/add_visitor/", testVisitor);
      console.log("✅ Test visitor sent successfully:", response.status);
      console.log("   Response data:", response.data);
    } catch (error: any) {
      console.error("❌ Test visitor failed:");
      console.error("   Status:", error.response?.status);
      console.error("   Data:", error.response?.data);

      if (error.response?.status === 401) {
        console.error("🔑 Token might be expired or invalid. Please paste a fresh token.");
      }
    }
  }, 30000); // 30s timeout for live API
});
