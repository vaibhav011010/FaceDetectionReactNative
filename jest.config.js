const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(expo|@expo|react-native|@react-native|@react-navigation|react-native-.*|@react-native-.*|react-native-get-random-values|expo-modules-core)/)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@app/(.*)$": "<rootDir>/app/$1",
    "^@nozbe/watermelondb/adapters/sqlite$": "@nozbe/watermelondb/adapters/lokijs",
    "^(.*)/database$": "<rootDir>/__tests__/mocks/testDatabase",
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { isolatedModules: true }],
  },
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx|js)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testTimeout: 300000,
};