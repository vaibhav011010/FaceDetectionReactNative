// loadTestRunner.ts
import { submitVisitor, syncVisitors } from '../../app/api/visitorForm';
import { generateMockVisitors, generateLargeMockVisitors, generateMockVisitorsWithPatterns } from '../helpers/generateVisitors';
import database from '../../app/database';
import Visitor from '../../app/database/models/Visitor';
import { Q } from '@nozbe/watermelondb';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

interface LoadTestConfig {
  visitorCount: number;
  testType: 'offline' | 'online' | 'sync' | 'mixed' | 'stress';
  delayBetweenSubmissions: number;
  expectedTimeout: number;
  description: string;
}

interface LoadTestResult {
  config: LoadTestConfig;
  startTime: number;
  endTime: number;
  duration: number;
  successCount: number;
  failureCount: number;
  dataIntegrityPassed: boolean;
  performancePassed: boolean;
  errors: string[];
  details: {
    submissionTime: number;
    syncTime?: number;
    databaseRecords: number;
    syncedRecords: number;
    unsyncedRecords: number;
  };
}

class LoadTestRunner {
  private mockAxiosInstance: any;
  private mockNetInfo: any;
  private results: LoadTestResult[] = [];

  constructor() {
    this.setupMocks();
  }

  private setupMocks() {
    this.mockAxiosInstance = {
      post: jest.fn()
    };
    
    this.mockNetInfo = NetInfo.fetch as jest.Mock;
    (axios.create as jest.Mock).mockReturnValue(this.mockAxiosInstance);
  }

  private async clearDatabase() {
    await database.write(async () => {
      const allVisitors = await database.get<Visitor>('visitors').query().fetch();
      for (const visitor of allVisitors) {
        await visitor.destroyPermanently();
      }
    });
  }

  private async runOfflineTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    console.log(`\n🚀 Starting OFFLINE load test: ${config.description}`);
    console.log(`📊 Target: ${config.visitorCount} visitors`);

    // Mock offline state
    this.mockNetInfo.mockResolvedValue({ isConnected: false });
    
    const mockVisitors = generateMockVisitors(config.visitorCount);
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    const submissionStartTime = Date.now();

    // Submit all visitors while offline
    for (let i = 0; i < mockVisitors.length; i++) {
      const visitor = mockVisitors[i];
      try {
        const result = await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          'mock-base64-image-data'
        );
        results.push(result);
        
        if (result.success === false && result.error?.includes('stored locally')) {
          successCount++;
        } else if (result.success === false) {
          failureCount++;
          errors.push(`Visitor ${i + 1}: ${result.error}`);
        }
        
        // Add delay between submissions
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenSubmissions));
      } catch (error) {
        failureCount++;
        errors.push(`Visitor ${i + 1}: ${error}`);
      }
    }

    const submissionTime = Date.now() - submissionStartTime;

    // Check database for stored records
    const storedVisitors = await database
      .get<Visitor>('visitors')
      .query(Q.where('visitor_sync_status', 'not_synced'))
      .fetch();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify data integrity
    let dataIntegrityPassed = true;
    if (storedVisitors.length !== config.visitorCount) {
      dataIntegrityPassed = false;
      errors.push(`Data integrity failed: Expected ${config.visitorCount} records, found ${storedVisitors.length}`);
    }

    // Check performance
    const performancePassed = duration <= config.expectedTimeout;

    return {
      config,
      startTime,
      endTime,
      duration,
      successCount,
      failureCount,
      dataIntegrityPassed,
      performancePassed,
      errors,
      details: {
        submissionTime,
        databaseRecords: storedVisitors.length,
        syncedRecords: 0,
        unsyncedRecords: storedVisitors.length
      }
    };
  }

  private async runOnlineTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    console.log(`\n🌐 Starting ONLINE load test: ${config.description}`);
    console.log(`📊 Target: ${config.visitorCount} visitors`);

    // Mock online state
    this.mockNetInfo.mockResolvedValue({ isConnected: true });
    this.mockAxiosInstance.post.mockResolvedValue({
      status: 201,
      data: { id: 'mock-server-id', success: true }
    });

    const mockVisitors = generateMockVisitors(config.visitorCount);
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    const submissionStartTime = Date.now();

    // Submit all visitors while online
    for (let i = 0; i < mockVisitors.length; i++) {
      const visitor = mockVisitors[i];
      try {
        const result = await submitVisitor(
          visitor.visitorName,
          visitor.visitorMobileNo,
          visitor.visitingTenantId,
          'mock-base64-image-data'
        );
        results.push(result);
        
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          errors.push(`Visitor ${i + 1}: ${result.error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenSubmissions));
      } catch (error) {
        failureCount++;
        errors.push(`Visitor ${i + 1}: ${error}`);
      }
    }

    const submissionTime = Date.now() - submissionStartTime;

    // Check database for synced records
    const syncedVisitors = await database
      .get<Visitor>('visitors')
      .query(Q.where('visitor_sync_status', 'synced'))
      .fetch();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify data integrity
    let dataIntegrityPassed = true;
    if (syncedVisitors.length !== config.visitorCount) {
      dataIntegrityPassed = false;
      errors.push(`Data integrity failed: Expected ${config.visitorCount} synced records, found ${syncedVisitors.length}`);
    }

    // Check performance
    const performancePassed = duration <= config.expectedTimeout;

    return {
      config,
      startTime,
      endTime,
      duration,
      successCount,
      failureCount,
      dataIntegrityPassed,
      performancePassed,
      errors,
      details: {
        submissionTime,
        databaseRecords: syncedVisitors.length,
        syncedRecords: syncedVisitors.length,
        unsyncedRecords: 0
      }
    };
  }

  private async runSyncTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    console.log(`\n🔄 Starting SYNC load test: ${config.description}`);
    console.log(`📊 Target: ${config.visitorCount} visitors`);

    // Step 1: Submit all visitors offline
    this.mockNetInfo.mockResolvedValue({ isConnected: false });
    
    const mockVisitors = generateMockVisitors(config.visitorCount);
    const submissionStartTime = Date.now();

    for (let i = 0; i < mockVisitors.length; i++) {
      const visitor = mockVisitors[i];
      await submitVisitor(
        visitor.visitorName,
        visitor.visitorMobileNo,
        visitor.visitingTenantId,
        'mock-base64-image-data'
      );
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenSubmissions));
    }

    const submissionTime = Date.now() - submissionStartTime;

    // Verify offline storage
    const offlineVisitors = await database
      .get<Visitor>('visitors')
      .query(Q.where('visitor_sync_status', 'not_synced'))
      .fetch();

    if (offlineVisitors.length !== config.visitorCount) {
      errors.push(`Offline storage failed: Expected ${config.visitorCount}, found ${offlineVisitors.length}`);
    }

    // Step 2: Switch to online and sync
    this.mockNetInfo.mockResolvedValue({ isConnected: true });
    this.mockAxiosInstance.post.mockResolvedValue({
      status: 201,
      data: { id: 'mock-server-id', success: true }
    });

    const syncStartTime = Date.now();
    const syncResult = await syncVisitors();
    const syncTime = Date.now() - syncStartTime;

    // Verify sync results
    const syncedVisitors = await database
      .get<Visitor>('visitors')
      .query(Q.where('visitor_sync_status', 'synced'))
      .fetch();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify data integrity
    let dataIntegrityPassed = true;
    if (syncedVisitors.length !== config.visitorCount) {
      dataIntegrityPassed = false;
      errors.push(`Sync data integrity failed: Expected ${config.visitorCount} synced records, found ${syncedVisitors.length}`);
    }

    if (!syncResult.success || syncResult.syncedCount !== config.visitorCount) {
      dataIntegrityPassed = false;
      errors.push(`Sync operation failed: ${JSON.stringify(syncResult)}`);
    }

    // Check performance
    const performancePassed = duration <= config.expectedTimeout;

    return {
      config,
      startTime,
      endTime,
      duration,
      successCount: syncResult.syncedCount,
      failureCount: syncResult.failedCount,
      dataIntegrityPassed,
      performancePassed,
      errors,
      details: {
        submissionTime,
        syncTime,
        databaseRecords: syncedVisitors.length,
        syncedRecords: syncedVisitors.length,
        unsyncedRecords: 0
      }
    };
  }

  private async runMixedTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    console.log(`\n🔄 Starting MIXED load test: ${config.description}`);
    console.log(`📊 Target: ${config.visitorCount} visitors`);

    const onlineCount = Math.floor(config.visitorCount * 0.3); // 30% online
    const offlineCount = config.visitorCount - onlineCount;
    const mockVisitors = generateMockVisitors(config.visitorCount);

    let successCount = 0;
    let failureCount = 0;

    // Step 1: Submit first batch online
    this.mockNetInfo.mockResolvedValue({ isConnected: true });
    this.mockAxiosInstance.post.mockResolvedValue({
      status: 201,
      data: { id: 'mock-server-id', success: true }
    });

    for (let i = 0; i < onlineCount; i++) {
      const visitor = mockVisitors[i];
      const result = await submitVisitor(
        visitor.visitorName,
        visitor.visitorMobileNo,
        visitor.visitingTenantId,
        'mock-base64-image-data'
      );
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        errors.push(`Online visitor ${i + 1}: ${result.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenSubmissions));
    }

    // Step 2: Submit remaining batch offline
    this.mockNetInfo.mockResolvedValue({ isConnected: false });

    for (let i = onlineCount; i < config.visitorCount; i++) {
      const visitor = mockVisitors[i];
      const result = await submitVisitor(
        visitor.visitorName,
        visitor.visitorMobileNo,
        visitor.visitingTenantId,
        'mock-base64-image-data'
      );
      
      if (result.success === false && result.error?.includes('stored locally')) {
        successCount++;
      } else {
        failureCount++;
        errors.push(`Offline visitor ${i + 1}: ${result.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenSubmissions));
    }

    // Step 3: Sync offline records
    this.mockNetInfo.mockResolvedValue({ isConnected: true });
    this.mockAxiosInstance.post.mockResolvedValue({
      status: 201,
      data: { id: 'mock-server-id', success: true }
    });

    const syncResult = await syncVisitors();
    successCount += syncResult.syncedCount;
    failureCount += syncResult.failedCount;

    // Verify final state
    const allVisitors = await database.get<Visitor>('visitors').query().fetch();
    const syncedVisitors = await database
      .get<Visitor>('visitors')
      .query(Q.where('visitor_sync_status', 'synced'))
      .fetch();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify data integrity
    let dataIntegrityPassed = true;
    if (allVisitors.length !== config.visitorCount) {
      dataIntegrityPassed = false;
      errors.push(`Data integrity failed: Expected ${config.visitorCount} total records, found ${allVisitors.length}`);
    }

    if (syncedVisitors.length !== config.visitorCount) {
      dataIntegrityPassed = false;
      errors.push(`Sync integrity failed: Expected ${config.visitorCount} synced records, found ${syncedVisitors.length}`);
    }

    // Check performance
    const performancePassed = duration <= config.expectedTimeout;

    return {
      config,
      startTime,
      endTime,
      duration,
      successCount,
      failureCount,
      dataIntegrityPassed,
      performancePassed,
      errors,
      details: {
        submissionTime: duration,
        databaseRecords: allVisitors.length,
        syncedRecords: syncedVisitors.length,
        unsyncedRecords: allVisitors.length - syncedVisitors.length
      }
    };
  }

  async runTest(config: LoadTestConfig): Promise<LoadTestResult> {
    await this.clearDatabase();

    let result: LoadTestResult;

    switch (config.testType) {
      case 'offline':
        result = await this.runOfflineTest(config);
        break;
      case 'online':
        result = await this.runOnlineTest(config);
        break;
      case 'sync':
        result = await this.runSyncTest(config);
        break;
      case 'mixed':
        result = await this.runMixedTest(config);
        break;
      default:
        throw new Error(`Unknown test type: ${config.testType}`);
    }

    this.results.push(result);
    this.printTestResult(result);
    return result;
  }

  private printTestResult(result: LoadTestResult) {
    console.log('\n' + '='.repeat(60));
    console.log(`📋 TEST RESULT: ${result.config.description}`);
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${result.duration}ms`);
    console.log(`✅ Success: ${result.successCount}`);
    console.log(`❌ Failures: ${result.failureCount}`);
    console.log(`📊 Data Integrity: ${result.dataIntegrityPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`⚡ Performance: ${result.performancePassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`💾 Database Records: ${result.details.databaseRecords}`);
    console.log(`🔄 Synced Records: ${result.details.syncedRecords}`);
    console.log(`📱 Unsynced Records: ${result.details.unsyncedRecords}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    console.log('='.repeat(60) + '\n');
  }

  async runAllTests(): Promise<void> {
    const testConfigs: LoadTestConfig[] = [
      {
        visitorCount: 50,
        testType: 'offline',
        delayBetweenSubmissions: 100,
        expectedTimeout: 10000,
        description: 'Offline Load Test - 50 Visitors'
      },
      {
        visitorCount: 100,
        testType: 'offline',
        delayBetweenSubmissions: 50,
        expectedTimeout: 15000,
        description: 'Offline Load Test - 100 Visitors'
      },
      {
        visitorCount: 50,
        testType: 'online',
        delayBetweenSubmissions: 100,
        expectedTimeout: 10000,
        description: 'Online Load Test - 50 Visitors'
      },
      {
        visitorCount: 100,
        testType: 'online',
        delayBetweenSubmissions: 50,
        expectedTimeout: 15000,
        description: 'Online Load Test - 100 Visitors'
      },
      {
        visitorCount: 50,
        testType: 'sync',
        delayBetweenSubmissions: 50,
        expectedTimeout: 15000,
        description: 'Sync Load Test - 50 Visitors'
      },
      {
        visitorCount: 100,
        testType: 'sync',
        delayBetweenSubmissions: 30,
        expectedTimeout: 20000,
        description: 'Sync Load Test - 100 Visitors'
      },
      {
        visitorCount: 75,
        testType: 'mixed',
        delayBetweenSubmissions: 75,
        expectedTimeout: 18000,
        description: 'Mixed Load Test - 75 Visitors'
      }
    ];

    console.log('🚀 Starting Comprehensive Load Test Suite');
    console.log(`📊 Total tests to run: ${testConfigs.length}`);

    for (const config of testConfigs) {
      try {
        await this.runTest(config);
      } catch (error) {
        console.error(`❌ Test failed: ${config.description}`, error);
      }
    }

    this.printSummary();
  }

  public printSummary() {
    console.log('\n' + '🎯'.repeat(20));
    console.log('📊 LOAD TEST SUMMARY');
    console.log('🎯'.repeat(20));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.dataIntegrityPassed && r.performancePassed).length;
    const failedTests = totalTests - passedTests;

    console.log(`📈 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.dataIntegrityPassed || !r.performancePassed)
        .forEach(result => {
          console.log(`   - ${result.config.description}`);
          if (!result.dataIntegrityPassed) console.log(`     Data Integrity: FAILED`);
          if (!result.performancePassed) console.log(`     Performance: FAILED`);
        });
    }

    console.log('\n📈 Performance Summary:');
    this.results.forEach(result => {
      console.log(`   ${result.config.description}: ${result.duration}ms`);
    });

    console.log('🎯'.repeat(20) + '\n');
  }

  getResults(): LoadTestResult[] {
    return this.results;
  }
}

export default LoadTestRunner;
