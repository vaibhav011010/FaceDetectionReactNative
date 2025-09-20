#!/bin/bash

# Test Environment Setup for Load Tests
# This script shows how to set the required environment variables for real API testing

# Required: Set your actual API credentials here
export TEST_ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzU1OTU0OTg4LCJpYXQiOjE3NTU4Njg1ODgsImp0aSI6IjlhZGEwMzljOGRhMDRiNWViYjg2MjdjYzZkYjljNWM2IiwidXNlcl9pZCI6ODR9.AlXLvn0auSrZaf5TjDU3T6gfq1GftrVD86XrjR4bavk"
export TEST_REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NzQwNDU4OCwiaWF0IjoxNzU1ODY4NTg4LCJqdGkiOiIzMDNkNjgwZDM0NTQ0MzcwYmEzNTliZGQyOTI2N2M5MyIsInVzZXJfaWQiOjg0fQ.YpWjMhwiOleXqMPqCX6nFi3tziUcF7zLrzi1XqY_R_8"

# Optional: Set other test configuration
export TEST_API_BASE_URL="https://webapptest3.online"  # if different from default
export TEST_TIMEOUT="30000"  # 30 seconds timeout

echo "✅ Test environment variables set:"
echo "   TEST_ACCESS_TOKEN: ${TEST_ACCESS_TOKEN:0:20}..."
echo "   TEST_REFRESH_TOKEN: ${TEST_REFRESH_TOKEN:0:20}..."
echo "   TEST_API_BASE_URL: ${TEST_API_BASE_URL}"
echo "   TEST_TIMEOUT: ${TEST_TIMEOUT}ms"

echo ""
echo "🚀 Now you can run the load tests:"
echo "   npm run test:load:quick    # Quick test with 50 visitors"
echo "   npm run test:load:stress   # Stress test with 100 visitors"
echo "   npm run test:load:all      # All load tests"
echo ""
echo "⚠️  Make sure your API server is running and accessible!"
