import { mockUnsyncedVisitors, mockDB, resetMocks } from "../helpers/helpers";

// Generate large datasets for testing
export const generateLargeDataset = (count: number) => {
  const visitors = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    visitors.push({
      id: `${i + 1}`,
      visitorName: `Visitor_${String(i + 1).padStart(3, '0')}`,
      visitorMobileNo: `98765${String(i + 1).padStart(5, '0')}`,
      visitingTenantId: 100 + (i % 10), // 10 different companies
      visitorPhoto: `data:image/jpeg;base64,${'A'.repeat(1000)}`, // 1KB mock photo
      visitorPhotoName: `visitor_${i + 1}.jpg`,
      timestamp: baseTime + (i * 1000),
      recordUuid: `test-uuid-${i + 1}-${Date.now()}`,
      createdDatetime: new Date(baseTime + (i * 1000)).toISOString(),
      isSynced: false,
      visitorSyncStatus: "not_synced",
      createdByUserId: 1,
    });
  }

  return visitors;
};

// Setup all mocks for offline testing
export const setupOfflineMocks = () => {
  // Mock database
  jest.mock("../../app/database", () => ({
    get: jest.fn(() => mockDB),
    write: jest.fn(),
  }));

  // Mock axios
  jest.mock("../../app/api/axiosInstance", () => ({
    post: jest.fn(),
  }));

  // Mock FileSystem
  jest.mock("expo-file-system", () => ({
    getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
    readAsStringAsync: jest.fn(() => Promise.resolve("fakeBase64Data")),
    writeAsStringAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    deleteAsync: jest.fn(),
    EncodingType: { Base64: "base64" },
    documentDirectory: "/documents/",
    cacheDirectory: "/cache/",
  }));

  // Mock other dependencies
  jest.mock("expo-image-manipulator", () => ({
    manipulateAsync: jest.fn(() => Promise.resolve({ uri: "/temp/compressed.jpg" })),
    SaveFormat: { JPEG: "jpeg" },
  }));

  jest.mock("expo-crypto", () => ({
    randomUUID: jest.fn(() => "test-uuid"),
  }));

  jest.mock("../../app/api/auth", () => ({
    getCurrentUserId: jest.fn(() => Promise.resolve(1)),
  }));

  jest.mock("@react-native-community/netinfo", () => ({
    fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  }));
};

// Test result tracker
export class TestTracker {
  private results: any[] = [];

  trackResult(result: any) {
    this.results.push(result);
  }

  getSummary() {
    const total = this.results.length;
    const success = this.results.filter(r => r.success).length;
    const offline = this.results.filter(r => !r.success && r.error?.includes("stored locally")).length;
    const failed = this.results.filter(r => !r.success && !r.error?.includes("stored locally")).length;

    return { total, success, offline, failed };
  }

  clear() {
    this.results = [];
  }
}