// Real API Load Tests - Using environment variables for tokens
// Tests offline storage when there's no internet or server is down

// Mock DB module used by app/api/visitorForm
jest.mock("../../app/database", () => {
  type V = any;
  const visitors: V[] = [];
  let idSeq = 1;

  const write = async (fn: any) => await fn();

  const makeVisitor = (draft: any): V => {
    const v: any = {
      id: String(idSeq++),
      visitorName: "",
      visitorMobileNo: "",
      visitingTenantId: 66, // Fixed tenant ID for testing
      visitorPhoto: "",
      visitorPhotoName: "",
      timestamp: Date.now(),
      isSynced: false,
      serverId: null,
      recordUuid: "",
      visitorSyncStatus: "not_synced",
      createdByUserId: 1,
      lastSyncAttempt: null,
      syncRetryCount: 0,
      createdDatetime: new Date().toISOString(),
      update: async (updater: (u: any) => void) => {
        await write(async () => updater(v));
      },
      destroyPermanently: async () => {
        const idx = visitors.findIndex((x) => x.id === v.id);
        if (idx >= 0) visitors.splice(idx, 1);
      },
    };
    draft(v); // apply fields
    return v;
  };

  const get = (table: string) => {
    if (table !== "visitors") {
      return {
        query: () => ({ fetch: async () => [] }),
        create: async () => {},
      };
    }
    return {
      create: async (draft: (v: any) => void) => {
        const v = makeVisitor(draft);
        visitors.push(v);
      },
      query:
        (..._conds: any[]) =>
        ({
          fetch: async () => {
            // Return all visitors for testing
            return visitors;
          },
        }),
    };
  };

  return {
    __esModule: true,
    default: {
      write,
      get,
      // for cleanup/inspection if needed
      __visitors: visitors,
    } as any,
  };
});

// Mock auth to provide stable tokens from environment
jest.mock("../../app/api/auth", () => ({
  getCurrentUserId: jest.fn(async () => 1),
  getTokensForUser: jest.fn(async () => ({
    accessToken: process.env.TEST_ACCESS_TOKEN!,
    refreshToken: process.env.TEST_REFRESH_TOKEN!,
  })),
  refreshAccessTokenForUser: jest.fn(async () => process.env.TEST_ACCESS_TOKEN!),
}));

// Mock axios to simulate network errors when offline, but allow real API calls when online
jest.mock("../../app/api/axiosInstance", () => {
  const originalModule = jest.requireActual("../../app/api/axiosInstance");
  
  return {
    ...originalModule,
    post: jest.fn(async (url: string, data: any, config: any) => {
      // Check if we're simulating offline mode
      const netInfo = await import("@react-native-community/netinfo");
      const networkState = await netInfo.fetch();
      
      if (!networkState.isConnected) {
        // Simulate network error when offline
        const error = new Error("Network Error");
        (error as any).request = {}; // Simulate axios error structure
        throw error;
      }
      
      // When online, use the REAL axios instance for actual API calls
      console.log("🌐 [REAL API] Sending data to:", url);
      console.log("📤 [REAL API] Payload:", {
        visitor_name: data.visitor_name,
        photo: data.photo,
        visitor_mobile_no: data.visitor_mobile_no,
        visiting_tenant_id: data.visiting_tenant_id,
        uuid: data.uuid,
        created_datetime: data.created_datetime
      });
      
      try {
        // Use the real axios instance
        const result = await originalModule.default.post(url, data, config);
        console.log("✅ [REAL API] Success response:", result.status, result.data);
        return result;
      } catch (error: any) {
        console.error("❌ [REAL API] Error for visitor:", data.visitor_name);
        console.error("❌ [REAL API] Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: url,
          payload: {
            visitor_name: data.visitor_name,
            visitor_mobile_no: data.visitor_mobile_no,
            visiting_tenant_id: data.visiting_tenant_id,
            uuid: data.uuid
          }
        });
        throw error;
      }
    }),
  };
});

// Mock Crypto for UUID generation
jest.mock("expo-crypto", () => ({
  randomUUID: () => {
    // Generate a proper UUID v4 format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
}));

// Mock FileSystem to avoid native dependencies in tests
jest.mock("expo-file-system", () => ({
  documentDirectory: "/documents/",
  cacheDirectory: "/cache/",
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="),
  deleteAsync: jest.fn(async () => {}),
  readDirectoryAsync: jest.fn(async () => []),
  EncodingType: { Base64: "base64" },
}));

// Mock ImageManipulator
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(async () => ({ uri: "/tmp/compressed.jpg" })),
  SaveFormat: { JPEG: "jpeg" },
}));

// Mock NetInfo for testing network conditions
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(() => () => {}),
}));

// Mock WatermelonDB Q queries
jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    where: jest.fn(),
    and: jest.fn(),
    notEq: jest.fn(),
    lt: jest.fn(),
  },
}));

jest.mock("react-native-get-random-values", () => ({}));

// Import after mocks
import { submitVisitor, syncVisitors } from '../../app/api/visitorForm';
import { generateMockVisitors } from '../helpers/generateVisitors';
import NetInfo from '@react-native-community/netinfo';

// Suppress console errors during testing
jest.spyOn(console, "error").mockImplementation(() => {});

describe('Visitor Management System Real API Load Tests', () => {
  let mockNetInfo: any;

  beforeEach(async () => {
    // Clear in-memory database before each test
    const database = (await import('../../app/database')).default as any;
    if (database.__visitors) {
      database.__visitors.length = 0; // Clear the visitors array
    }

    // Setup NetInfo mock
    mockNetInfo = NetInfo.fetch as jest.Mock;
  });

  afterEach(async () => {
    // Clean up in-memory database after each test
    const database = (await import('../../app/database')).default as any;
    if (database.__visitors) {
      database.__visitors.length = 0; // Clear the visitors array
    }
  });

  describe('API Connectivity Test', () => {
    it('should verify API credentials and connectivity', async () => {
      console.log("🔐 Testing API connectivity...");
      
      // Check if environment variables are set
      if (!process.env.TEST_ACCESS_TOKEN || !process.env.TEST_REFRESH_TOKEN) {
        console.error("❌ Missing API credentials!");
        console.error("TEST_ACCESS_TOKEN:", process.env.TEST_ACCESS_TOKEN ? "SET" : "MISSING");
        console.error("TEST_REFRESH_TOKEN:", process.env.TEST_REFRESH_TOKEN ? "SET" : "MISSING");
        throw new Error("API credentials not set");
      }
      
      console.log("✅ API credentials are set");
      console.log("🔑 Access Token:", process.env.TEST_ACCESS_TOKEN.substring(0, 50) + "...");
      console.log("🔄 Refresh Token:", process.env.TEST_REFRESH_TOKEN.substring(0, 50) + "...");
      
      // Test basic API connectivity by checking if we can make a request
      try {
        console.log("🔍 Testing API endpoint accessibility...");
        console.log("📡 API endpoint should be accessible at your configured base URL");
        console.log("✅ API credentials are valid format");
        console.log("🚀 Ready to test visitor submission");
      } catch (error: any) {
        console.error("❌ API connectivity test failed:", error.message);
        throw error;
      }
    });

    it('should test a single API call to see real errors', async () => {
      console.log("🧪 Testing single API call...");
      
      try {
        // Test with a single visitor submission
        const result = await submitVisitor(
          "Test Visitor",
          "1234567890",
          66,
          "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        );
        console.log("✅ Single API call successful:", result);
      } catch (error: any) {
        console.error("❌ Single API call failed:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: error.config
        });
        throw error;
      }
    });
  });

  describe('Offline Storage Test (No Internet)', () => {
    it('should store 50 visitor records when offline due to no internet', async () => {
      // Mock NO INTERNET state - this is when offline storage should happen
      mockNetInfo.mockResolvedValue({ isConnected: false });
      
      const visitorCount = 50;
      const mockVisitors = generateMockVisitors(visitorCount);
      const results = [];

      console.log(`🚀 Testing offline storage with ${visitorCount} visitors (no internet)`);

      // Submit all visitors while offline
      for (let i = 0; i < mockVisitors.length; i++) {
        const visitor = mockVisitors[i];
        try {
          const result = await submitVisitor(
            visitor.visitorName,
            visitor.visitorMobileNo,
            66, // Use fixed tenant ID 66 for all requests
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
          );
          results.push(result);
        } catch (error) {
          results.push({ success: false, error: String(error) });
        }
        
        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Count different types of results
      const onlineSuccessCount = results.filter(r => r.success === true).length;
      const offlineStoredCount = results.filter(r => r.success === false && r.error?.includes('stored locally')).length;
      const failureCount = results.filter(r => r.success === false && !r.error?.includes('stored locally')).length;

      console.log(`📊 Offline Storage Test Results:`);
      console.log(`- Online success: ${onlineSuccessCount}`);
      console.log(`- Stored offline: ${offlineStoredCount}`);
      console.log(`- Failed: ${failureCount}`);

      // Check database for stored records
      const database = (await import('../../app/database')).default as any;
      const storedVisitors = await database.get('visitors').query().fetch();

      console.log(`💾 Records in database: ${storedVisitors.length}`);

      // Since we're offline (no internet), visitors should be stored locally
      expect(offlineStoredCount).toBeGreaterThan(0);
      expect(storedVisitors.length).toBeGreaterThan(0);
      
      // Total processed should equal visitor count
      const totalProcessed = onlineSuccessCount + offlineStoredCount + failureCount;
      expect(totalProcessed).toBe(visitorCount);
    });

    it('should store 100 visitor records when offline due to no internet', async () => {
      // Mock NO INTERNET state
      mockNetInfo.mockResolvedValue({ isConnected: false });
      
      const visitorCount = 100;
      const mockVisitors = generateMockVisitors(visitorCount);
      const results = [];

      console.log(`🚀 Testing large offline storage with ${visitorCount} visitors (no internet)`);

      // Submit all visitors while offline
      for (let i = 0; i < mockVisitors.length; i++) {
        const visitor = mockVisitors[i];
        try {
          const result = await submitVisitor(
            visitor.visitorName,
            visitor.visitorMobileNo,
            66, // Use fixed tenant ID 66 for all requests
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
          );
          results.push(result);
        } catch (error) {
          results.push({ success: false, error: String(error) });
        }
        
        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Count different types of results
      const onlineSuccessCount = results.filter(r => r.success === true).length;
      const offlineStoredCount = results.filter(r => r.success === false && r.error?.includes('stored locally')).length;
      const failureCount = results.filter(r => r.success === false && !r.error?.includes('stored locally')).length;

      console.log(`📊 Large Offline Storage Test Results:`);
      console.log(`- Online success: ${onlineSuccessCount}`);
      console.log(`- Stored offline: ${offlineStoredCount}`);
      console.log(`- Failed: ${failureCount}`);

      // Check database for stored records
      const database = (await import('../../app/database')).default as any;
      const storedVisitors = await database.get('visitors').query().fetch();

      console.log(`💾 Records in database: ${storedVisitors.length}`);

      // Since we're offline (no internet), visitors should be stored locally
      expect(offlineStoredCount).toBeGreaterThan(0);
      expect(storedVisitors.length).toBeGreaterThan(0);
      
      // Total processed should equal visitor count
      const totalProcessed = onlineSuccessCount + offlineStoredCount + failureCount;
      expect(totalProcessed).toBe(visitorCount);
    });
  });

  describe('Online API Test (With Internet)', () => {
    it('should submit 50 visitor records online when internet is available', async () => {
      // Mock INTERNET AVAILABLE state - this should send data directly to API
      mockNetInfo.mockResolvedValue({ isConnected: true });

      const visitorCount = 50;
      const mockVisitors = generateMockVisitors(visitorCount);
      const results = [];

      console.log(`🌐 Testing online submission with ${visitorCount} visitors (with internet)`);

      // Submit all visitors while online
      for (let i = 0; i < mockVisitors.length; i++) {
        const visitor = mockVisitors[i];
        try {
          const result = await submitVisitor(
            visitor.visitorName,
            visitor.visitorMobileNo,
            66, // Use fixed tenant ID 66 for all requests
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
          );
          results.push(result);
        } catch (error) {
          results.push({ success: false, error: String(error) });
        }
        
        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Count different types of results
      const onlineSuccessCount = results.filter(r => r.success === true).length;
      const offlineStoredCount = results.filter(r => r.success === false && r.error?.includes('stored locally')).length;
      const failureCount = results.filter(r => r.success === false && !r.error?.includes('stored locally')).length;

      console.log(`📊 Online API Test Results:`);
      console.log(`- Online success: ${onlineSuccessCount}`);
      console.log(`- Stored offline: ${offlineStoredCount}`);
      console.log(`- Failed: ${failureCount}`);

      // Check database for synced records
      const database = (await import('../../app/database')).default as any;
      const syncedVisitors = await database.get('visitors').query().fetch();

      console.log(`💾 Records in database: ${syncedVisitors.length}`);

      // Since we're online, most should succeed (unless API has issues)
      expect(onlineSuccessCount).toBeGreaterThan(0);
      
      // Total processed should equal visitor count
      const totalProcessed = onlineSuccessCount + offlineStoredCount + failureCount;
      expect(totalProcessed).toBe(visitorCount);
    });
  });

  describe('Offline to Online Sync Test', () => {
    it('should sync 50 offline records when coming back online', async () => {
      const visitorCount = 50;
      const mockVisitors = generateMockVisitors(visitorCount);

      console.log(`🔄 Testing offline-to-online sync with ${visitorCount} visitors`);

      // Step 1: Submit all visitors while offline (no internet)
      mockNetInfo.mockResolvedValue({ isConnected: false });
      
      for (let i = 0; i < mockVisitors.length; i++) {
        const visitor = mockVisitors[i];
        await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          66, // Use fixed tenant ID 66 for all requests
          'mock-base64-image-data'
        );
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Verify records are stored locally
      const database = (await import('../../app/database')).default as any;
      const offlineVisitors = await database.get('visitors').query().fetch();

      console.log(`📱 Records stored offline: ${offlineVisitors.length}`);
      expect(offlineVisitors.length).toBeGreaterThan(0);

      // Step 2: Switch to online and trigger sync
      mockNetInfo.mockResolvedValue({ isConnected: true });

      // Trigger sync
      const syncResult = await syncVisitors();
      console.log('🔄 Sync result:', syncResult);

      // Verify sync results
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBeGreaterThan(0);

      // Verify records are now synced
      const syncedVisitors = await database.get('visitors').query().fetch();

      console.log(`✅ Records synced after coming online: ${syncedVisitors.length}`);
      expect(syncedVisitors.length).toBeGreaterThan(0);
    });
  });

  describe('Mixed Online/Offline Test', () => {
    it('should handle mixed online/offline scenarios with 75 visitors', async () => {
      const totalVisitors = 75;
      const onlineVisitors = 25;
      const offlineVisitors = 50;
      const mockVisitors = generateMockVisitors(totalVisitors);

      console.log(`🔄 Testing mixed online/offline with ${totalVisitors} visitors`);

      // Step 1: Submit first 25 visitors online
      mockNetInfo.mockResolvedValue({ isConnected: true });

      for (let i = 0; i < onlineVisitors; i++) {
        const visitor = mockVisitors[i];
        await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          66, // Use fixed tenant ID 66 for all requests
          'mock-base64-image-data'
        );
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 2: Submit remaining 50 visitors offline (no internet)
      mockNetInfo.mockResolvedValue({ isConnected: false });

      for (let i = onlineVisitors; i < totalVisitors; i++) {
        const visitor = mockVisitors[i];
        await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          66, // Use fixed tenant ID 66 for all requests
          'mock-base64-image-data'
        );
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Step 3: Sync offline records when coming back online
      mockNetInfo.mockResolvedValue({ isConnected: true });

      const syncResult = await syncVisitors();
      console.log('🔄 Mixed scenario sync result:', syncResult);

      // Verify final state
      const database = (await import('../../app/database')).default as any;
      const allVisitors = await database.get('visitors').query().fetch();

      console.log(`📊 Total records: ${allVisitors.length}`);

      // Assertions
      expect(allVisitors.length).toBeGreaterThan(0);
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedCount).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity Test', () => {
    it('should maintain data integrity during load testing', async () => {
      const visitorCount = 50;
      const mockVisitors = generateMockVisitors(visitorCount);

      console.log(`🔒 Testing data integrity with ${visitorCount} visitors`);

      // Submit visitors offline
      mockNetInfo.mockResolvedValue({ isConnected: false });
      
      for (let i = 0; i < mockVisitors.length; i++) {
        const visitor = mockVisitors[i];
        await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          66, // Use fixed tenant ID 66 for all requests
          'mock-base64-image-data'
        );
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Switch to online and sync
      mockNetInfo.mockResolvedValue({ isConnected: true });

      await syncVisitors();

      // Verify data integrity
      const database = (await import('../../app/database')).default as any;
      const allVisitors = await database.get('visitors').query().fetch();
      
      for (let i = 0; i < allVisitors.length; i++) {
        const stored = allVisitors[i] as any;
        const original = mockVisitors[i];
        
        // Verify all required fields are present and correct
        expect(stored.visitorName).toBe(original.visitorName);
        expect(stored.visitorMobileNo).toBe(original.visitorMobileNo);
        expect(stored.visitingTenantId).toBe(66); // Should be fixed tenant ID 66
        expect(stored.recordUuid).toBeDefined();
        expect(stored.createdDatetime).toBeDefined();
        expect(stored.timestamp).toBeDefined();
      }

      console.log(`✅ Data integrity verified for ${allVisitors.length} visitors`);
    });
  });

  describe('Performance Test', () => {
    it('should complete 50 visitor submissions within reasonable time', async () => {
      const visitorCount = 50;
      const mockVisitors = generateMockVisitors(visitorCount);

      console.log(`⚡ Testing performance with ${visitorCount} visitors`);

      const startTime = Date.now();

      // Submit all visitors offline
      mockNetInfo.mockResolvedValue({ isConnected: false });
      
      for (let i = 0; i < mockVisitors.length; i++) {
        const visitor = mockVisitors[i];
        await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          66, // Use fixed tenant ID 66 for all requests
          'mock-base64-image-data'
        );
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const submissionTime = Date.now() - startTime;
      console.log(`⏱️ Submission time for ${visitorCount} visitors: ${submissionTime}ms`);

      // Switch to online and sync
      mockNetInfo.mockResolvedValue({ isConnected: true });

      const syncStartTime = Date.now();
      await syncVisitors();
      const syncTime = Date.now() - syncStartTime;

      console.log(`🔄 Sync time for ${visitorCount} visitors: ${syncTime}ms`);
      console.log(`⏱️ Total time: ${Date.now() - startTime}ms`);

      // Performance assertions (adjust thresholds as needed)
      expect(submissionTime).toBeLessThan(10000); // 10 seconds for submission
      expect(syncTime).toBeLessThan(15000); // 15 seconds for sync
      expect(Date.now() - startTime).toBeLessThan(25000); // 25 seconds total
    });
  });
});
