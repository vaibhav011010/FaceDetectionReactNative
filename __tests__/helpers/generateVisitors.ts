// helpers/generateVisitors.ts

interface MockVisitor {
  id: string;
  visitorName: string;
  visitorMobileNo: string;
  visitingTenantId: number;
  visitorPhoto: string;
  visitorPhotoName: string;
  timestamp: number;
  recordUuid: string;
  createdDatetime: string;
  isSynced: boolean;
  visitorSyncStatus: 'synced' | 'not_synced';
  createdByUserId?: number;
  serverId?: string | number | null;
  lastSyncAttempt?: number | null;
  syncRetryCount?: number | null;
}

// Realistic company names for testing
const COMPANY_NAMES = [
  'TechCorp Solutions',
  'Global Innovations Ltd',
  'Digital Dynamics Inc',
  'Future Systems Corp',
  'Smart Solutions Group',
  'Innovation Hub LLC',
  'Tech Pioneers Ltd',
  'Digital Excellence Corp',
  'NextGen Technologies',
  'Advanced Systems Inc',
  'Creative Solutions Ltd',
  'Modern Tech Group',
  'Elite Innovations Corp',
  'Strategic Partners LLC',
  'Visionary Systems Inc'
];

// Realistic first names for testing
const FIRST_NAMES = [
  'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica',
  'William', 'Ashley', 'Christopher', 'Amanda', 'Daniel', 'Stephanie', 'James',
  'Nicole', 'Matthew', 'Elizabeth', 'Joshua', 'Megan', 'Andrew', 'Lauren',
  'Ryan', 'Rachel', 'Brandon', 'Kayla', 'Justin', 'Amber', 'Tyler', 'Samantha',
  'Kevin', 'Danielle', 'Brian', 'Brittany', 'Steven', 'Victoria', 'Timothy',
  'Courtney', 'Jeffrey', 'Rebecca', 'Mark', 'Michelle', 'Paul', 'Tiffany',
  'Donald', 'Heather', 'Kenneth', 'Melissa', 'Ronald', 'Christina', 'Anthony',
  'Kimberly', 'Jason', 'Crystal', 'Edward', 'Erin', 'Brian', 'Katherine'
];

// Realistic last names for testing
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
  'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz'
];

// Generate a random phone number
const generatePhoneNumber = (): string => {
  const areaCode = Math.floor(Math.random() * 900) + 100; // 100-999
  const prefix = Math.floor(Math.random() * 900) + 100; // 100-999
  const lineNumber = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  return `${areaCode}${prefix}${lineNumber}`;
};

// Generate a random name
const generateRandomName = (): string => {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
};

// Generate a random company ID
const generateCompanyId = (): number => {
  return Math.floor(Math.random() * 50) + 1; // 1-50
};

// Generate a realistic base64 image placeholder
const generateMockImageData = (): string => {
  // This is a minimal valid JPEG base64 string (1x1 pixel)
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
};

export function generateMockVisitors(count: number): MockVisitor[] {
  const baseTime = Date.now();
  const visitors: MockVisitor[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = baseTime + i * 5000; // 5 sec gap between each visitor
    const recordUuid = `test-uuid-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
    
    visitors.push({
      id: `${i + 1}`,
      visitorName: generateRandomName(),
      visitorMobileNo: generatePhoneNumber(),
      visitingTenantId: generateCompanyId(),
      visitorPhoto: `/path/to/image${i + 1}.jpg`,
      visitorPhotoName: `visitor_${timestamp}_${i + 1}.jpg`,
      timestamp: timestamp,
      recordUuid: recordUuid,
      createdDatetime: new Date(timestamp).toISOString(),
      isSynced: false,
      visitorSyncStatus: 'not_synced',
      createdByUserId: 1, // Default user ID for testing
      serverId: null,
      lastSyncAttempt: null,
      syncRetryCount: 0
    });
  }

  return visitors;
}

// Generate visitors with specific patterns for testing edge cases
export function generateMockVisitorsWithPatterns(count: number, pattern: 'duplicate_names' | 'duplicate_phones' | 'duplicate_companies' | 'mixed' = 'mixed'): MockVisitor[] {
  const baseTime = Date.now();
  const visitors: MockVisitor[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = baseTime + i * 5000;
    const recordUuid = `test-uuid-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
    
    let visitorName: string;
    let visitorMobileNo: string;
    let visitingTenantId: number;

    switch (pattern) {
      case 'duplicate_names':
        visitorName = 'John Smith'; // Same name for all
        visitorMobileNo = generatePhoneNumber();
        visitingTenantId = generateCompanyId();
        break;
      case 'duplicate_phones':
        visitorName = generateRandomName();
        visitorMobileNo = '1234567890'; // Same phone for all
        visitingTenantId = generateCompanyId();
        break;
      case 'duplicate_companies':
        visitorName = generateRandomName();
        visitorMobileNo = generatePhoneNumber();
        visitingTenantId = 1; // Same company for all
        break;
      default: // mixed
        visitorName = generateRandomName();
        visitorMobileNo = generatePhoneNumber();
        visitingTenantId = generateCompanyId();
    }

    visitors.push({
      id: `${i + 1}`,
      visitorName,
      visitorMobileNo,
      visitingTenantId,
      visitorPhoto: `/path/to/image${i + 1}.jpg`,
      visitorPhotoName: `visitor_${timestamp}_${i + 1}.jpg`,
      timestamp: timestamp,
      recordUuid: recordUuid,
      createdDatetime: new Date(timestamp).toISOString(),
      isSynced: false,
      visitorSyncStatus: 'not_synced',
      createdByUserId: 1,
      serverId: null,
      lastSyncAttempt: null,
      syncRetryCount: 0
    });
  }

  return visitors;
}

// Generate visitors for stress testing with very large datasets
export function generateLargeMockVisitors(count: number): MockVisitor[] {
  const baseTime = Date.now();
  const visitors: MockVisitor[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = baseTime + i * 1000; // 1 sec gap for faster generation
    const recordUuid = `stress-uuid-${i}-${Math.random().toString(36).substr(2, 9)}`;
    
    visitors.push({
      id: `${i + 1}`,
      visitorName: `Stress_Test_Visitor_${String(i + 1).padStart(6, '0')}`,
      visitorMobileNo: `999${String(i + 1).padStart(7, '0')}`,
      visitingTenantId: (i % 10) + 1, // Cycle through 10 companies
      visitorPhoto: `/stress/test/image${i + 1}.jpg`,
      visitorPhotoName: `stress_visitor_${i + 1}.jpg`,
      timestamp: timestamp,
      recordUuid: recordUuid,
      createdDatetime: new Date(timestamp).toISOString(),
      isSynced: false,
      visitorSyncStatus: 'not_synced',
      createdByUserId: 1,
      serverId: null,
      lastSyncAttempt: null,
      syncRetryCount: 0
    });
  }

  return visitors;
}

// Generate visitors with specific data for validation testing
export function generateValidationTestVisitors(): MockVisitor[] {
  const baseTime = Date.now();
  
  return [
    // Valid visitor
    {
      id: '1',
      visitorName: 'John Doe',
      visitorMobileNo: '1234567890',
      visitingTenantId: 1,
      visitorPhoto: '/path/to/image1.jpg',
      visitorPhotoName: 'visitor_1.jpg',
      timestamp: baseTime,
      recordUuid: 'valid-uuid-1',
      createdDatetime: new Date(baseTime).toISOString(),
      isSynced: false,
      visitorSyncStatus: 'not_synced',
      createdByUserId: 1,
      serverId: null,
      lastSyncAttempt: null,
      syncRetryCount: 0
    },
    // Visitor with long name
    {
      id: '2',
      visitorName: 'Very Long Name That Exceeds Normal Length Limits For Testing Purposes',
      visitorMobileNo: '9876543210',
      visitingTenantId: 2,
      visitorPhoto: '/path/to/image2.jpg',
      visitorPhotoName: 'visitor_2.jpg',
      timestamp: baseTime + 5000,
      recordUuid: 'valid-uuid-2',
      createdDatetime: new Date(baseTime + 5000).toISOString(),
      isSynced: false,
      visitorSyncStatus: 'not_synced',
      createdByUserId: 1,
      serverId: null,
      lastSyncAttempt: null,
      syncRetryCount: 0
    },
    // Visitor with special characters
    {
      id: '3',
      visitorName: 'José María O\'Connor-Smith',
      visitorMobileNo: '5551234567',
      visitingTenantId: 3,
      visitorPhoto: '/path/to/image3.jpg',
      visitorPhotoName: 'visitor_3.jpg',
      timestamp: baseTime + 10000,
      recordUuid: 'valid-uuid-3',
      createdDatetime: new Date(baseTime + 10000).toISOString(),
      isSynced: false,
      visitorSyncStatus: 'not_synced',
      createdByUserId: 1,
      serverId: null,
      lastSyncAttempt: null,
      syncRetryCount: 0
    }
  ];
}
