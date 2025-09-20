// __tests__/helpers/helpers.ts
export const mockUnsyncedVisitors = [
  {
    id: "1",
    visitorName: "John Doe",
    visitorMobileNo: "9876543210",
    visitingTenantId: 101,
    visitorPhoto: "/path/to/image1.jpg",
    visitorPhotoName: "visitor_1.jpg",
    timestamp: 1692000000000,
    recordUuid: "uuid-111",
    createdDatetime: "2025-08-14T10:30:00.000Z",
    isSynced: false,
    visitorSyncStatus: "not_synced",
  },
  {
    id: "2",
    visitorName: "Jane Smith",
    visitorMobileNo: "9123456780",
    visitingTenantId: 102,
    visitorPhoto: "/path/to/image2.jpg",
    visitorPhotoName: "visitor_2.jpg",
    timestamp: 1692000100000,
    recordUuid: "uuid-222",
    createdDatetime: "2025-08-14T10:35:00.000Z",
    isSynced: false,
    visitorSyncStatus: "not_synced",
  },
];

export const mockDB = {
  getUnsyncedVisitors: jest.fn(() => mockUnsyncedVisitors),
  markAsSynced: jest.fn(),
  get: jest.fn(() => ({
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        fetch: jest.fn(() => mockUnsyncedVisitors)
      }))
    }))
  })),
  write: jest.fn(),
};

export const mockAxiosPost = jest.fn(() => Promise.resolve({ status: 201 }));

// Mock FileSystem so we return fake base64 instead of actually reading
jest.mock("expo-file-system", () => ({
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
  readAsStringAsync: jest.fn(() => Promise.resolve("fakeBase64Data")),
  EncodingType: { Base64: "base64" },
}));

export const resetMocks = () => {
  jest.clearAllMocks();
  mockUnsyncedVisitors.forEach((v) => (v.isSynced = false));
};
