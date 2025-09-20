// runLoadTests.ts
import LoadTestRunner from './loadTestRunner';

async function runLoadTests() {
  console.log('🚀 Visitor Management System - Load Test Suite');
  console.log('='.repeat(60));
  
  const runner = new LoadTestRunner();
  
  try {
    // Run all tests
    await runner.runAllTests();
    
    // Get results for further analysis
    const results = runner.getResults();
    
    // Export results to JSON for external analysis
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = `./load-test-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📄 Results saved to: ${resultsPath}`);
    
  } catch (error) {
    console.error('❌ Load test suite failed:', error);
    process.exit(1);
  }
}

// Run specific test types
async function runSpecificTests() {
  console.log('🎯 Running Specific Load Tests');
  console.log('='.repeat(60));
  
  const runner = new LoadTestRunner();
  
  // Test configurations
  const testConfigs = [
    {
      visitorCount: 50,
      testType: 'offline' as const,
      delayBetweenSubmissions: 100,
      expectedTimeout: 10000,
      description: 'Quick Offline Test - 50 Visitors'
    },
    {
      visitorCount: 100,
      testType: 'sync' as const,
      delayBetweenSubmissions: 50,
      expectedTimeout: 20000,
      description: 'Comprehensive Sync Test - 100 Visitors'
    }
  ];
  
  for (const config of testConfigs) {
    try {
      await runner.runTest(config);
    } catch (error) {
      console.error(`❌ Test failed: ${config.description}`, error);
    }
  }
  
  runner.printSummary();
}

// Run stress test
async function runStressTest() {
  console.log('🔥 Running Stress Test');
  console.log('='.repeat(60));
  
  const runner = new LoadTestRunner();
  
  const stressConfig = {
    visitorCount: 200,
    testType: 'mixed' as const,
    delayBetweenSubmissions: 25,
    expectedTimeout: 30000,
    description: 'Stress Test - 200 Visitors (Mixed Online/Offline)'
  };
  
  try {
    await runner.runTest(stressConfig);
  } catch (error) {
    console.error('❌ Stress test failed:', error);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  switch (args[0]) {
    case 'all':
      runLoadTests();
      break;
    case 'specific':
      runSpecificTests();
      break;
    case 'stress':
      runStressTest();
      break;
    default:
      console.log('Usage:');
      console.log('  npm run test:load:all      - Run all load tests');
      console.log('  npm run test:load:specific - Run specific load tests');
      console.log('  npm run test:load:stress   - Run stress test');
      console.log('');
      console.log('Running default comprehensive test suite...');
      runLoadTests();
  }
}

export { runLoadTests, runSpecificTests, runStressTest };
