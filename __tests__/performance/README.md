# Load Testing Suite for Visitor Management System

This directory contains comprehensive load tests for the Visitor Management System, designed to verify that the system properly handles high volumes of visitor data submissions in both online and offline scenarios.

## Overview

The load tests verify:
- **Offline Storage**: Data is properly stored locally when there's no internet connection
- **Online API**: Data is successfully sent to the API when internet is available
- **Sync Functionality**: Offline data is properly synced when coming back online
- **Data Integrity**: All visitor information (name, mobile, company, photo) is preserved
- **Performance**: System handles load within acceptable time limits

## Test Scenarios

### 1. Offline Storage Test (No Internet)
- **50 visitors**: Tests basic offline storage capacity
- **100 visitors**: Tests larger offline storage capacity
- **Purpose**: Verifies that when there's no internet, all visitor data is stored locally without loss

### 2. Online API Test (With Internet)
- **50 visitors**: Tests direct API submission when internet is available
- **Purpose**: Verifies that when online, data goes directly to the API

### 3. Offline to Online Sync Test
- **50 visitors**: Tests the complete offline-to-online workflow
- **Purpose**: Verifies that offline data is properly synced when internet becomes available

### 4. Mixed Online/Offline Test
- **75 visitors**: Tests mixed scenarios (25 online + 50 offline, then sync)
- **Purpose**: Verifies system handles real-world mixed connectivity scenarios

### 5. Data Integrity Test
- **50 visitors**: Verifies all visitor data fields are preserved
- **Purpose**: Ensures no data corruption during load testing

### 6. Performance Test
- **50 visitors**: Measures submission and sync performance
- **Purpose**: Ensures system meets performance requirements

## Environment Setup (Required)

**⚠️ IMPORTANT**: These tests use REAL API calls with your actual credentials. You must set up environment variables before running.

### Step 1: Get Your API Credentials
1. Log into your Visitor Management System as a security guard
2. Get your access token and refresh token from the authentication system
3. These tokens should have permission to submit visitor data

### Step 2: Set Environment Variables
```bash
# Option 1: Export directly in terminal
export TEST_ACCESS_TOKEN="your_actual_access_token_here"
export TEST_REFRESH_TOKEN="your_actual_refresh_token_here"

# Option 2: Use the example script
cp test-env-example.sh test-env.sh
# Edit test-env.sh with your real tokens
source test-env.sh

# Option 3: Create a .env file (if supported)
echo "TEST_ACCESS_TOKEN=your_token" > .env
echo "TEST_REFRESH_TOKEN=your_refresh_token" >> .env
```

### Step 3: Verify Setup
```bash
# Check if environment variables are set
echo "Access Token: ${TEST_ACCESS_TOKEN:0:20}..."
echo "Refresh Token: ${TEST_REFRESH_TOKEN:0:20}..."
```

## Running the Tests

### Quick Test (Recommended for first run)
```bash
npm run test:load:quick
```
- Tests with 50 visitors
- Good for verifying setup and basic functionality
- Takes ~2-5 minutes

### Stress Test
```bash
npm run test:load:stress
```
- Tests with 100 visitors
- Good for performance validation
- Takes ~5-10 minutes

### All Tests
```bash
npm run test:load:all
```
- Runs all test scenarios
- Comprehensive validation
- Takes ~15-30 minutes

### Custom Test Runner
```bash
npm run test:load:runner
```
- Uses the LoadTestRunner class
- More detailed reporting
- Good for CI/CD integration

## Test Results Interpretation

### Success Indicators
- ✅ **Offline Storage**: `Stored offline` count > 0 when offline
- ✅ **Online API**: `Online success` count > 0 when online
- ✅ **Sync**: `Synced count` > 0 after coming online
- ✅ **Data Integrity**: All visitor fields preserved correctly
- ✅ **Performance**: Within time limits (configurable)

### Common Issues
- ❌ **No offline storage**: Check if `submitVisitor` properly handles network errors
- ❌ **API failures**: Verify tokens are valid and API is accessible
- ❌ **Sync failures**: Check if `syncVisitors` function works correctly
- ❌ **Performance issues**: Adjust timeouts or optimize database operations

## Test Data

The tests use `generateMockVisitors()` from `../helpers/generateVisitors.ts` which creates realistic test data:
- Realistic names and phone numbers
- Valid company IDs
- Mock image data
- Configurable visitor counts

## Architecture

### Mock Strategy
- **Database**: In-memory mock that simulates WatermelonDB behavior
- **Network**: Mocked NetInfo to simulate online/offline states
- **File System**: Mocked to avoid native dependencies
- **API**: REAL calls using your actual credentials

### Key Functions Tested
- `submitVisitor()`: Core submission logic
- `syncVisitors()`: Offline-to-online sync
- Database operations: Create, read, update
- Network state handling: Online vs offline

## Troubleshooting

### "No logged-in user" Error
- Ensure `TEST_ACCESS_TOKEN` is set and valid
- Check if the token has expired
- Verify the token has proper permissions

### "Network Error" in Online Tests
- Check your internet connection
- Verify the API server is running
- Check if the API endpoint is correct

### Database Errors
- The tests use mocked database - real database issues won't appear here
- Check the mock implementation in the test file

### Performance Issues
- Adjust timeouts in the test file
- Check your system resources
- Consider reducing visitor counts for testing

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use realistic data and scenarios
3. Add proper error handling
4. Include performance measurements
5. Update this README

## Notes

- These tests are designed to work with your actual API
- They will create real visitor records in your system
- Consider running in a test environment first
- The tests include delays to prevent overwhelming your API
- All console output is logged for debugging purposes
