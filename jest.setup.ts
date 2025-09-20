import "@testing-library/jest-native/extend-expect";
import fetchMock from "jest-fetch-mock";

fetchMock.enableMocks();

// Mock React Native native modules
jest.mock("react-native", () => ({
  Platform: { OS: "web" },
  Dimensions: { get: jest.fn(() => ({ width: 375, height: 667 })) },
  NativeModules: {
    WMDatabaseBridge: {
      initialize: jest.fn(),
      batch: jest.fn(),
      getLocal: jest.fn(),
      setLocal: jest.fn(),
      removeLocal: jest.fn(),
      getAllKeys: jest.fn(),
      multiGet: jest.fn(),
      multiSet: jest.fn(),
      multiRemove: jest.fn(),
      clear: jest.fn(),
    },
  },
}));

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(() => () => {}),
}));

// Mock Expo modules
jest.mock("expo-modules-core", () => ({
  NativeModulesProxy: {},
  EventEmitter: jest.fn(),
}));

// Mock other React Native modules
jest.mock("react-native-get-random-values", () => ({}));

// Mock WatermelonDB native modules
jest.mock("@nozbe/watermelondb/utils/common/randomId/randomId.native", () => ({
  default: () => Math.random().toString(36).substr(2, 9),
}));

// Mock FileSystem
jest.mock("expo-file-system", () => ({
  documentDirectory: "/mock/document/directory/",
  cacheDirectory: "/mock/cache/directory/",
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  readAsStringAsync: jest.fn(() => Promise.resolve("mock-base64-data")),
  deleteAsync: jest.fn(() => Promise.resolve()),
  readDirectoryAsync: jest.fn(() => Promise.resolve([])),
}));

// Mock ImageManipulator
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(() => Promise.resolve({ uri: "/mock/compressed/image.jpg" })),
}));

// Mock Crypto
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-" + Math.random().toString(36).substr(2, 9)),
}));

// Mock axiosBase
jest.mock("./app/api/axiosBase", () => ({
  default: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
