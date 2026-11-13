/**
 * Firestore Security Rules Verification Suite ("Dirty Dozen" Payloads)
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Forecast Create',
    collectionPath: '/forecasts/fc_01',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      ownerId: 'user_1',
      location: 'Dhaka',
      waterLevel: 7.5,
      rainfall: 120,
      floodRisk: 'High',
      status: 'Pending',
      aiSummary: 'Heavy monsoon surge',
      isVerifiedAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Warning Create',
    collectionPath: '/warnings/warn_01',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      ownerId: 'user_2',
      location: 'Sylhet',
      riskLevel: 'High',
      warningStatus: 'Pending Review',
      advisoryMessage: 'Evacuate low-lying areas',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Spoof Attack on Admin',
    collectionPath: '/warnings/warn_02',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'sohelrana587129@gmail.com', email_verified: false },
    payload: {
      ownerId: 'attacker_1',
      location: 'Sylhet',
      riskLevel: 'High',
      warningStatus: 'Published',
      advisoryMessage: 'Spoofed warning',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Lateral Read on User Private Subcollection',
    collectionPath: '/users/user_1/private/info',
    operation: 'get',
    auth: { uid: 'user_2', email: 'user2@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Blanket Unfiltered List Query on SOS Requests',
    collectionPath: '/sos_requests',
    operation: 'list',
    auth: { uid: 'user_2', email: 'user2@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning with Special Characters',
    collectionPath: '/forecasts/invalid$id!@#',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      ownerId: 'user_1',
      location: 'Dhaka',
      waterLevel: 7.5,
      rainfall: 120,
      floodRisk: 'High',
      status: 'Pending',
      aiSummary: 'Valid summary',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Denial-of-Wallet Oversized String on AI Summary',
    collectionPath: '/forecasts/fc_02',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      ownerId: 'user_1',
      location: 'Dhaka',
      waterLevel: 7.5,
      rainfall: 120,
      floodRisk: 'High',
      status: 'Pending',
      aiSummary: 'X'.repeat(2000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable ownerId Mutation on Shelter Update',
    collectionPath: '/shelters/sh_01',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      ownerId: 'user_2',
      occupancy: 120,
      status: 'Near Capacity',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery on Sensor Reading Create',
    collectionPath: '/sensor_readings/sr_01',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      ownerId: 'user_1',
      stationId: 'station_01',
      stationName: 'Surma River',
      timeLabel: '10:30',
      waterLevel: 1.65,
      rainfall: 54.8,
      soilMoisture: 88,
      status: 'ALERT',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Bypass on Completed SOS Request',
    collectionPath: '/sos_requests/sos_completed_01',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      status: 'Pending',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning on Forecast Status Update',
    collectionPath: '/forecasts/fc_01',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      status: 'HACKED_STATUS',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Role Escalation on User Profile Create',
    collectionPath: '/users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: {
      ownerId: 'user_1',
      firstName: 'Test',
      lastName: 'User',
      displayRole: 'Admin',
      status: 'Active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
