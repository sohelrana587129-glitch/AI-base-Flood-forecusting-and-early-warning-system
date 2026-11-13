import {
  TelemetryPoint,
  TrainedFloodModel,
  ModelPrediction,
  SessionUser,
  SosAlertMessage,
  UserRole,
} from '../types';

export interface StationConfig {
  id: string;
  name: string;
  region: 'sylhet' | 'dhaka' | 'sunamganj' | 'dinajpur';
  center: [number, number];
  baseLevelMeters: number;
  alertThreshold: number;
  alarmThreshold: number;
  totalRainfallMm: number;
  maxRainfall30m: number;
  satellitePassTime: string;
  sarInundationPct: number;
  timelineRise: Record<string, number>;
  points1d: TelemetryPoint[];
}

interface StoredAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}

const DEFAULT_ACCOUNTS: StoredAccount[] = [
  {
    id: 'acc_admin_01',
    firstName: 'System',
    lastName: 'Administrator',
    email: 'admin@floodguard.gov.bd',
    phone: '01711000001',
    password: 'FG-Admin#2026!',
    role: 'Admin',
  },
  {
    id: 'acc_forecast_01',
    firstName: 'Karim',
    lastName: 'Ahmed',
    email: 'forecast@floodguard.gov.bd',
    phone: '01711000222',
    password: 'FG-Forecast#2026!',
    role: 'Forecast Officer',
  },
  {
    id: 'acc_volunteer_01',
    firstName: 'Sohel',
    lastName: 'Rana',
    email: 'volunteer@floodguard.gov.bd',
    phone: '01711000444',
    password: 'FG-Volunteer#2026!',
    role: 'Volunteer',
  },
  {
    id: 'acc_disaster_01',
    firstName: 'Sadia',
    lastName: 'Islam',
    email: 'disaster@floodguard.gov.bd',
    phone: '01711000333',
    password: 'FG-Disaster#2026!',
    role: 'Authority',
  },
];

const DEFAULT_SOS_MESSAGES: SosAlertMessage[] = [
  {
    id: 'sos_msg_1',
    senderName: 'Samia Akter',
    senderPhone: '01712345678',
    location: 'Dhaka (Kamrangirchar Low-lying Ward)',
    emergencyType: 'Flood Rescue',
    message:
      'URGENT SOS: Ground floor submerged 1.4m near river embankment. 4 family members stranded on rooftop, need rescue boat immediately.',
    status: 'Pending',
    timestamp: '10:12 AM',
  },
  {
    id: 'sos_msg_2',
    senderName: 'Sohel Mia',
    senderPhone: '01819876543',
    location: 'Sylhet (Companiganj Riverbank)',
    emergencyType: 'Emergency Help',
    message:
      'URGENT SOS: Surma River water entered village road. Elderly patient requires immediate evacuation to Companiganj High School shelter.',
    status: 'Pending',
    timestamp: '10:18 AM',
  },
  {
    id: 'sos_msg_3',
    senderName: 'Mim Chowdhury',
    senderPhone: '01911223344',
    location: 'Sunamganj (Tahirpur Haor)',
    emergencyType: 'Food Support',
    message:
      'SOS Relief Alert: 35 displaced families at Tahirpur shelter require dry food packets and clean drinking water.',
    status: 'Completed',
    timestamp: '09:45 AM',
  },
];

const DEFAULT_STATIONS: Record<string, StationConfig> = {
  station_01: {
    id: 'station_01',
    name: 'Surma River - Sylhet Bridge Point',
    region: 'sylhet',
    center: [24.89, 91.87],
    baseLevelMeters: 8.5,
    alertThreshold: 2.2,
    alarmThreshold: 2.5,
    totalRainfallMm: 300.6,
    maxRainfall30m: 54.8,
    satellitePassTime: 'Sentinel-1 SAR · 14 mins ago',
    sarInundationPct: 28.4,
    timelineRise: { '0': 0.0, '6': 0.4, '12': 0.9, '24': 1.6 },
    points1d: [
      { time: '10:16', waterLevel: 0.83, rainfall: 0, soilMoisture: 68 },
      { time: '10:33', waterLevel: 0.82, rainfall: 0, soilMoisture: 69 },
      { time: '10:50', waterLevel: 0.87, rainfall: 14, soilMoisture: 74 },
      { time: '11:07', waterLevel: 0.91, rainfall: 14, soilMoisture: 78 },
      { time: '11:25', waterLevel: 0.85, rainfall: 0, soilMoisture: 76 },
      { time: '11:42', waterLevel: 0.87, rainfall: 0, soilMoisture: 77 },
      { time: '11:59', waterLevel: 0.83, rainfall: 18, soilMoisture: 82 },
      { time: '09:23', waterLevel: 1.65, rainfall: 54.8, soilMoisture: 94 },
    ],
  },
  station_02: {
    id: 'station_02',
    name: 'Buriganga River - Dhaka Mill Barrack',
    region: 'dhaka',
    center: [23.71, 90.4],
    baseLevelMeters: 6.2,
    alertThreshold: 2.2,
    alarmThreshold: 2.5,
    totalRainfallMm: 312.4,
    maxRainfall30m: 42.0,
    satellitePassTime: 'Sentinel-1 SAR · 22 mins ago',
    sarInundationPct: 19.2,
    timelineRise: { '0': 0.1, '6': 0.5, '12': 1.1, '24': 1.7 },
    points1d: [
      { time: '10:16', waterLevel: 0.78, rainfall: 4, soilMoisture: 64 },
      { time: '10:33', waterLevel: 0.84, rainfall: 8, soilMoisture: 67 },
      { time: '10:50', waterLevel: 0.92, rainfall: 16, soilMoisture: 72 },
      { time: '11:07', waterLevel: 1.05, rainfall: 22, soilMoisture: 79 },
      { time: '11:25', waterLevel: 1.18, rainfall: 12, soilMoisture: 81 },
      { time: '11:42', waterLevel: 1.34, rainfall: 28, soilMoisture: 86 },
      { time: '11:59', waterLevel: 1.49, rainfall: 42, soilMoisture: 90 },
      { time: '09:23', waterLevel: 1.58, rainfall: 18, soilMoisture: 91 },
    ],
  },
  station_03: {
    id: 'station_03',
    name: 'Surma River - Sunamganj Point',
    region: 'sunamganj',
    center: [25.065, 91.395],
    baseLevelMeters: 7.8,
    alertThreshold: 2.2,
    alarmThreshold: 2.5,
    totalRainfallMm: 524.0,
    maxRainfall30m: 62.5,
    satellitePassTime: 'MODIS / Sentinel-1 · 9 mins ago',
    sarInundationPct: 34.8,
    timelineRise: { '0': 0.2, '6': 0.7, '12': 1.3, '24': 1.9 },
    points1d: [
      { time: '10:16', waterLevel: 0.95, rainfall: 10, soilMoisture: 75 },
      { time: '10:33', waterLevel: 1.04, rainfall: 18, soilMoisture: 79 },
      { time: '10:50', waterLevel: 1.16, rainfall: 25, soilMoisture: 84 },
      { time: '11:07', waterLevel: 1.29, rainfall: 32, soilMoisture: 88 },
      { time: '11:25', waterLevel: 1.42, rainfall: 40, soilMoisture: 92 },
      { time: '11:42', waterLevel: 1.56, rainfall: 62.5, soilMoisture: 95 },
      { time: '11:59', waterLevel: 1.68, rainfall: 48, soilMoisture: 96 },
      { time: '09:23', waterLevel: 1.74, rainfall: 35, soilMoisture: 97 },
    ],
  },
  station_04: {
    id: 'station_04',
    name: 'Punarbhaba River - Dinajpur Point',
    region: 'dinajpur',
    center: [25.627, 88.633],
    baseLevelMeters: 32.5,
    alertThreshold: 2.2,
    alarmThreshold: 2.5,
    totalRainfallMm: 198.2,
    maxRainfall30m: 24.0,
    satellitePassTime: 'Sentinel-2 Optical · 38 mins ago',
    sarInundationPct: 8.5,
    timelineRise: { '0': 0.0, '6': 0.2, '12': 0.45, '24': 0.85 },
    points1d: [
      { time: '10:16', waterLevel: 0.62, rainfall: 0, soilMoisture: 52 },
      { time: '10:33', waterLevel: 0.65, rainfall: 2, soilMoisture: 54 },
      { time: '10:50', waterLevel: 0.7, rainfall: 8, soilMoisture: 58 },
      { time: '11:07', waterLevel: 0.74, rainfall: 12, soilMoisture: 61 },
      { time: '11:25', waterLevel: 0.79, rainfall: 24, soilMoisture: 66 },
      { time: '11:42', waterLevel: 0.88, rainfall: 10, soilMoisture: 68 },
      { time: '11:59', waterLevel: 0.94, rainfall: 4, soilMoisture: 69 },
      { time: '09:23', waterLevel: 1.02, rainfall: 0, soilMoisture: 67 },
    ],
  },
};

const DEFAULT_MODEL: TrainedFloodModel = {
  modelId: 'model_default_lstm_sar_v2',
  fileName: 'floodguard_lstm_sar_ensemble.json',
  format: 'JSON / Hybrid LSTM-XGBoost Weights',
  architecture: 'Bi-LSTM + Sentinel-1 SAR Hydrological Ensemble',
  fileSizeBytes: 184320,
  uploadedAt: new Date().toISOString(),
  accuracy: 94.2,
  f1Score: 0.931,
  weights: {
    waterLevelWeight: 0.52,
    rainfall30mWeight: 0.018,
    soilMoistureWeight: 0.008,
    sarInundationWeight: 0.012,
    bias: 0.15,
  },
  notes:
    'Pre-calibrated on Bangladesh BWDB river gauge stations (Surma, Buriganga, Sunamganj, Dinajpur) and Sentinel-1 SAR backscatter.',
};

function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem('fg_accounts_v1');
    if (!raw) return [...DEFAULT_ACCOUNTS];
    const parsed = JSON.parse(raw) as StoredAccount[];
    // Ensure default role accounts are always present
    const merged = [...DEFAULT_ACCOUNTS];
    for (const acc of parsed) {
      if (!merged.some((d) => d.email.toLowerCase() === acc.email.toLowerCase())) {
        merged.push(acc);
      }
    }
    return merged;
  } catch {
    return [...DEFAULT_ACCOUNTS];
  }
}

function saveStoredAccounts(accounts: StoredAccount[]) {
  try {
    localStorage.setItem('fg_accounts_v1', JSON.stringify(accounts));
  } catch {
    // ignore storage quota errors
  }
}

export function getStoredSosMessages(): SosAlertMessage[] {
  try {
    const raw = localStorage.getItem('fg_sos_messages_v1');
    if (!raw) return [...DEFAULT_SOS_MESSAGES];
    return JSON.parse(raw);
  } catch {
    return [...DEFAULT_SOS_MESSAGES];
  }
}

function saveStoredSosMessages(msgs: SosAlertMessage[]) {
  try {
    localStorage.setItem('fg_sos_messages_v1', JSON.stringify(msgs));
  } catch {
    // ignore
  }
}

function getStoredModel(): TrainedFloodModel {
  try {
    const raw = localStorage.getItem('fg_trained_model_v1');
    if (!raw) return DEFAULT_MODEL;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MODEL;
  }
}

function saveStoredModel(model: TrainedFloodModel) {
  try {
    localStorage.setItem('fg_trained_model_v1', JSON.stringify(model));
  } catch {
    // ignore
  }
}

export function runLocalModelInference(
  input: {
    waterLevel: number;
    rainfall30m: number;
    soilMoisture: number;
    sarInundationPct: number;
  },
  model: TrainedFloodModel = getStoredModel()
): ModelPrediction {
  const { weights } = model;
  const riskScoreRaw =
    input.waterLevel * weights.waterLevelWeight +
    input.rainfall30m * weights.rainfall30mWeight +
    input.soilMoisture * weights.soilMoistureWeight +
    input.sarInundationPct * weights.sarInundationWeight +
    weights.bias;

  const probabilityPct = Math.min(
    99.4,
    Math.max(5.0, Number(((riskScoreRaw / 3.2) * 100).toFixed(1)))
  );
  const predictedSurge6h = Number(
    (input.waterLevel + input.rainfall30m * 0.007 + input.soilMoisture * 0.002).toFixed(3)
  );
  const predictedSurge24h = Number(
    (input.waterLevel + input.rainfall30m * 0.015 + input.soilMoisture * 0.005).toFixed(3)
  );

  let riskClass: 'Low' | 'Medium' | 'High' = 'Low';
  if (predictedSurge24h >= 1.6 || probabilityPct >= 75) {
    riskClass = 'High';
  } else if (predictedSurge24h >= 1.2 || probabilityPct >= 45) {
    riskClass = 'Medium';
  }

  return {
    modelId: model.modelId,
    fileName: model.fileName,
    architecture: model.architecture,
    floodProbabilityPct: probabilityPct,
    predictedLevel6h: predictedSurge6h,
    predictedLevel24h: predictedSurge24h,
    riskClass,
  };
}

export function loginLocalAccount(
  email: string,
  phone: string,
  password: string
): { ok: boolean; error?: string; sessionUser?: SessionUser; sosMessages?: SosAlertMessage[] } {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const accounts = getStoredAccounts();
  const account = accounts.find(
    (acc) => acc.email.toLowerCase() === normalizedEmail && acc.password === String(password)
  );

  if (!account) {
    return {
      ok: false,
      error:
        'Invalid credentials. Unauthorized access denied. Please check your role email and password or register an account first.',
    };
  }

  return {
    ok: true,
    sessionUser: {
      id: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: phone || account.phone,
      role: account.role,
    },
    sosMessages: getStoredSosMessages(),
  };
}

export function registerLocalAccount(payload: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  role: UserRole;
  rolePasscode?: string;
}): { ok: boolean; error?: string; sessionUser?: SessionUser; sosMessages?: SosAlertMessage[] } {
  const { firstName, lastName, email, phone, password, confirmPassword, role, rolePasscode } =
    payload;

  if (!firstName || !lastName || !email || !phone || !password) {
    return {
      ok: false,
      error: 'All registration fields (name, email, phone, password) are required.',
    };
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return { ok: false, error: 'Password and Confirm Password do not match.' };
  }

  if (
    role === 'Admin' &&
    rolePasscode !== 'FG-Admin#2026!' &&
    password !== 'FG-Admin#2026!'
  ) {
    return {
      ok: false,
      error: 'Admin registration requires the Admin authorization password (FG-Admin#2026!).',
    };
  }
  if (
    role === 'Forecast Officer' &&
    rolePasscode !== 'FG-Forecast#2026!' &&
    password !== 'FG-Forecast#2026!'
  ) {
    return {
      ok: false,
      error:
        'Forecast Officer registration requires the Forecast authorization password (FG-Forecast#2026!).',
    };
  }
  if (
    role === 'Volunteer' &&
    rolePasscode !== 'FG-Volunteer#2026!' &&
    password !== 'FG-Volunteer#2026!'
  ) {
    return {
      ok: false,
      error:
        'Volunteer registration requires the Volunteer authorization password (FG-Volunteer#2026!).',
    };
  }
  if (
    role === 'Authority' &&
    rolePasscode !== 'FG-Disaster#2026!' &&
    password !== 'FG-Disaster#2026!'
  ) {
    return {
      ok: false,
      error:
        'Disaster Authority registration requires the Authority authorization password (FG-Disaster#2026!).',
    };
  }

  const accounts = getStoredAccounts();
  const normalizedEmail = String(email).trim().toLowerCase();
  const newAcc: StoredAccount = {
    id: `acc_${Date.now()}`,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: normalizedEmail,
    phone: String(phone).trim(),
    password: String(password),
    role,
  };

  const idx = accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail);
  if (idx >= 0) {
    accounts[idx] = newAcc;
  } else {
    accounts.push(newAcc);
  }
  saveStoredAccounts(accounts);

  return {
    ok: true,
    sessionUser: {
      id: newAcc.id,
      firstName: newAcc.firstName,
      lastName: newAcc.lastName,
      email: newAcc.email,
      phone: newAcc.phone,
      role: newAcc.role,
    },
    sosMessages: getStoredSosMessages(),
  };
}

export function addLocalSosMessage(payload: {
  senderName: string;
  senderPhone: string;
  location: string;
  emergencyType: 'Flood Rescue' | 'Emergency Help' | 'Food Support' | 'Medical Aid';
  message: string;
}): SosAlertMessage[] {
  const current = getStoredSosMessages();
  const newMsg: SosAlertMessage = {
    id: `sos_msg_${Date.now()}`,
    senderName: payload.senderName,
    senderPhone: payload.senderPhone,
    location: payload.location,
    emergencyType: payload.emergencyType,
    message: payload.message,
    status: 'Pending',
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
  const updated = [newMsg, ...current];
  saveStoredSosMessages(updated);
  return updated;
}

export function getLocalTelemetry(stationId: string = 'station_01', range: string = '1d') {
  const station = DEFAULT_STATIONS[stationId] || DEFAULT_STATIONS.station_01;
  let points = [...station.points1d];

  if (range === '7d') {
    points = [
      { time: 'Day 1', waterLevel: 0.72, rainfall: 12, soilMoisture: 60 },
      { time: 'Day 2', waterLevel: 0.81, rainfall: 28, soilMoisture: 65 },
      { time: 'Day 3', waterLevel: 0.89, rainfall: 45, soilMoisture: 72 },
      { time: 'Day 4', waterLevel: 1.04, rainfall: 64, soilMoisture: 78 },
      { time: 'Day 5', waterLevel: 1.22, rainfall: 82, soilMoisture: 84 },
      { time: 'Day 6', waterLevel: 1.41, rainfall: 110, soilMoisture: 90 },
      {
        time: 'Today',
        waterLevel: station.points1d[station.points1d.length - 1].waterLevel,
        rainfall: station.maxRainfall30m,
        soilMoisture: 94,
      },
    ];
  } else if (range === '30d') {
    points = [
      { time: 'Wk 1', waterLevel: 0.65, rainfall: 48, soilMoisture: 55 },
      { time: 'Wk 2', waterLevel: 0.79, rainfall: 92, soilMoisture: 64 },
      { time: 'Wk 3', waterLevel: 1.12, rainfall: 145, soilMoisture: 79 },
      {
        time: 'Wk 4',
        waterLevel: station.points1d[station.points1d.length - 1].waterLevel,
        rainfall: 123.6,
        soilMoisture: 94,
      },
    ];
  }

  const currentPoint = station.points1d[station.points1d.length - 1];
  const avgLevel =
    station.points1d.reduce((acc, item) => acc + item.waterLevel, 0) / station.points1d.length;

  let status: 'NORMAL' | 'WARNING' | 'ALERT' = 'NORMAL';
  if (currentPoint.waterLevel >= 2.2) {
    status = 'ALERT';
  }

  const activeModel = getStoredModel();
  const modelPrediction = runLocalModelInference(
    {
      waterLevel: currentPoint.waterLevel,
      rainfall30m: currentPoint.rainfall || station.maxRainfall30m,
      soilMoisture: currentPoint.soilMoisture,
      sarInundationPct: station.sarInundationPct,
    },
    activeModel
  );

  return {
    station,
    stationsList: Object.values(DEFAULT_STATIONS).map((s) => ({
      id: s.id,
      name: s.name,
      region: s.region,
      center: s.center,
    })),
    metrics: {
      currentLevel: Number(currentPoint.waterLevel.toFixed(3)),
      averageLevel: Number(avgLevel.toFixed(3)),
      totalRainfall: Number(station.totalRainfallMm.toFixed(1)),
      maxRainfall30m: Number(station.maxRainfall30m.toFixed(1)),
      status,
      lastUpdated: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    },
    points,
    modelPrediction,
    activeModel,
  };
}

export function ingestLocalSensor(
  stationId: string,
  waterLevel: number,
  rainfall: number,
  soilMoisture: number
) {
  const station = DEFAULT_STATIONS[stationId] || DEFAULT_STATIONS.station_01;
  const nowLabel = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  station.points1d.push({
    time: nowLabel,
    waterLevel,
    rainfall,
    soilMoisture,
  });
  if (station.points1d.length > 12) {
    station.points1d.shift();
  }

  station.totalRainfallMm = Number((station.totalRainfallMm + rainfall).toFixed(1));
  if (rainfall > station.maxRainfall30m) {
    station.maxRainfall30m = rainfall;
  }

  const delta = Math.max(0, waterLevel - 0.85);
  station.timelineRise = {
    '0': Number((delta * 0.4).toFixed(2)),
    '6': Number((0.4 + delta * 0.6).toFixed(2)),
    '12': Number((0.9 + delta * 0.85).toFixed(2)),
    '24': Number((1.6 + delta * 1.1).toFixed(2)),
  };

  const modelPrediction = runLocalModelInference({
    waterLevel,
    rainfall30m: rainfall,
    soilMoisture,
    sarInundationPct: station.sarInundationPct,
  });

  return {
    success: true,
    station,
    latestPoint: station.points1d[station.points1d.length - 1],
    modelPrediction,
  };
}

export function uploadLocalTrainedModel(payload: {
  fileName: string;
  fileSizeBytes: number;
  architecture: string;
  accuracy: number;
  f1Score: number;
  fileContentText?: string;
  customWeights?: TrainedFloodModel['weights'];
  notes?: string;
}) {
  const current = getStoredModel();
  let parsedWeights = payload.customWeights ? { ...payload.customWeights } : { ...current.weights };
  let parsedArch = payload.architecture || current.architecture;
  let parsedAcc = Number(payload.accuracy) || 95.4;
  let parsedF1 = Number(payload.f1Score) || 0.942;

  if (payload.fileContentText && payload.fileName.toLowerCase().endsWith('.json')) {
    try {
      const jsonObj = JSON.parse(payload.fileContentText);
      if (jsonObj.weights) {
        parsedWeights = {
          waterLevelWeight: Number(
            jsonObj.weights.waterLevelWeight ?? parsedWeights.waterLevelWeight
          ),
          rainfall30mWeight: Number(
            jsonObj.weights.rainfall30mWeight ?? parsedWeights.rainfall30mWeight
          ),
          soilMoistureWeight: Number(
            jsonObj.weights.soilMoistureWeight ?? parsedWeights.soilMoistureWeight
          ),
          sarInundationWeight: Number(
            jsonObj.weights.sarInundationWeight ?? parsedWeights.sarInundationWeight
          ),
          bias: Number(jsonObj.weights.bias ?? parsedWeights.bias),
        };
      }
      if (jsonObj.architecture) parsedArch = String(jsonObj.architecture);
      if (jsonObj.accuracy) parsedAcc = Number(jsonObj.accuracy);
      if (jsonObj.f1Score) parsedF1 = Number(jsonObj.f1Score);
    } catch {
      // ignore non-standard JSON
    }
  }

  const updated: TrainedFloodModel = {
    modelId: `model_${Date.now()}`,
    fileName: payload.fileName,
    format: payload.fileName.split('.').pop()?.toUpperCase() || 'CUSTOM',
    architecture: parsedArch,
    fileSizeBytes: payload.fileSizeBytes || 184320,
    uploadedAt: new Date().toISOString(),
    accuracy: parsedAcc,
    f1Score: parsedF1,
    weights: parsedWeights,
    notes:
      payload.notes ||
      `Uploaded custom trained model (${payload.fileName}) integrated with real-time satellite SAR & IoT river gauge pipeline.`,
  };

  saveStoredModel(updated);
  const sampleInference = runLocalModelInference(
    {
      waterLevel: 1.65,
      rainfall30m: 54.8,
      soilMoisture: 94,
      sarInundationPct: 28.4,
    },
    updated
  );

  return {
    success: true,
    activeModel: updated,
    sampleInference,
  };
}

export function getLocalFloodRiskMap(hoursAhead: string = '0', region: string = 'sylhet') {
  const station =
    Object.values(DEFAULT_STATIONS).find((s) => s.region === region) ||
    DEFAULT_STATIONS.station_01;
  const waterRise = station.timelineRise[hoursAhead] ?? 0.0;
  const totalWaterLevel = station.baseLevelMeters + waterRise;

  const getBaseFeatures = (reg: string) => {
    if (reg === 'dhaka') {
      return [
        {
          type: 'Feature',
          properties: {
            name: 'Zone A - Kamrangirchar Low-lying Settlement',
            elevation_meters: 6.4,
            type: 'residential',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [90.385, 23.718],
                [90.398, 23.718],
                [90.398, 23.708],
                [90.385, 23.708],
                [90.385, 23.718],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Zone B - Sadarghat Commercial Hub',
            elevation_meters: 7.0,
            type: 'commercial',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [90.402, 23.715],
                [90.415, 23.715],
                [90.415, 23.704],
                [90.402, 23.704],
                [90.402, 23.715],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Dhaka Collegiate Emergency Shelter',
            elevation_meters: 9.8,
            type: 'shelter',
          },
          geometry: { type: 'Point', coordinates: [90.408, 23.712] },
        },
      ];
    }
    if (reg === 'sunamganj') {
      return [
        {
          type: 'Feature',
          properties: {
            name: 'Zone A - Tahirpur Haor Settlement',
            elevation_meters: 8.1,
            type: 'residential',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [91.385, 25.072],
                [91.398, 25.072],
                [91.398, 25.06],
                [91.385, 25.06],
                [91.385, 25.072],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Zone B - Sunamganj Sadar Bazar',
            elevation_meters: 8.7,
            type: 'commercial',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [91.399, 25.075],
                [91.412, 25.075],
                [91.412, 25.063],
                [91.399, 25.063],
                [91.399, 25.075],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Sunamganj Govt Jubilee High School Shelter',
            elevation_meters: 11.5,
            type: 'shelter',
          },
          geometry: { type: 'Point', coordinates: [91.396, 25.068] },
        },
      ];
    }
    if (reg === 'dinajpur') {
      return [
        {
          type: 'Feature',
          properties: {
            name: 'Zone A - Biral Riverbank Ward',
            elevation_meters: 32.8,
            type: 'residential',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [88.622, 25.634],
                [88.634, 25.634],
                [88.634, 25.622],
                [88.622, 25.622],
                [88.622, 25.634],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Biral Pilot High School Shelter',
            elevation_meters: 36.0,
            type: 'shelter',
          },
          geometry: { type: 'Point', coordinates: [88.63, 25.629] },
        },
      ];
    }
    return [
      {
        type: 'Feature',
        properties: {
          name: 'Zone A - Low-lying Settlement (Companiganj / Riverbank)',
          elevation_meters: 8.8,
          type: 'residential',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [91.86, 24.89],
              [91.87, 24.89],
              [91.87, 24.88],
              [91.86, 24.88],
              [91.86, 24.89],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Zone B - Market Area (Zindabazar / Kazirbazar)',
          elevation_meters: 9.5,
          type: 'commercial',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [91.87, 24.9],
              [91.88, 24.9],
              [91.88, 24.89],
              [91.87, 24.89],
              [91.87, 24.9],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Zone C - Upashahar Residential Block',
          elevation_meters: 9.1,
          type: 'residential',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [91.872, 24.888],
              [91.884, 24.888],
              [91.884, 24.878],
              [91.872, 24.878],
              [91.872, 24.888],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Primary School Shelter (Sylhet Sadar)',
          elevation_meters: 11.2,
          type: 'shelter',
        },
        geometry: { type: 'Point', coordinates: [91.865, 24.895] },
      },
      {
        type: 'Feature',
        properties: {
          name: 'Companiganj Govt College Flood Shelter',
          elevation_meters: 12.0,
          type: 'shelter',
        },
        geometry: { type: 'Point', coordinates: [91.876, 24.893] },
      },
    ];
  };

  const features = getBaseFeatures(station.region).map((f) => {
    const props = { ...f.properties } as Record<string, unknown>;
    const elevation = Number(props.elevation_meters);
    if (props.type === 'shelter') {
      props.risk_level = 'Safe';
      props.water_depth = 0;
      props.description = `Designated Emergency Shelter (Elevation: ${elevation}m · River Level: ${totalWaterLevel.toFixed(2)}m)`;
    } else {
      const waterDepth = totalWaterLevel - elevation;
      props.water_depth = Number(Math.max(0, waterDepth).toFixed(2));
      if (waterDepth <= 0) {
        props.risk_level = 'Low';
        props.description = `Dry / Negligible Risk (Ground ${elevation}m vs River ${totalWaterLevel.toFixed(2)}m)`;
      } else if (waterDepth <= 0.5) {
        props.risk_level = 'Medium';
        props.description = `Waterlogging warning. Predicted Depth: ${waterDepth.toFixed(2)}m`;
      } else {
        props.risk_level = 'High';
        props.description = `CRITICAL FLOODING. Evacuate immediately. Predicted Depth: ${waterDepth.toFixed(2)}m`;
      }
    }
    return { ...f, properties: props };
  });

  return {
    type: 'FeatureCollection' as const,
    features,
    metadata: {
      stationName: station.name,
      region: station.region,
      center: station.center,
      hoursAhead,
      baseLevelMeters: station.baseLevelMeters,
      waterRiseMeters: waterRise,
      totalWaterLevelMeters: Number(totalWaterLevel.toFixed(2)),
    },
  };
}
