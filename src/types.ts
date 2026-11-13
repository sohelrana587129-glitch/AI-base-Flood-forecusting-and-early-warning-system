export type AppTab =
  | 'monitor'
  | 'map'
  | 'forecast'
  | 'disaster'
  | 'volunteer'
  | 'shelter'
  | 'admin'
  | 'auth';

export type UserRole = 'Admin' | 'Forecast Officer' | 'Authority' | 'Volunteer' | 'Citizen';

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface SosAlertMessage {
  id: string;
  senderName: string;
  senderPhone: string;
  location: string;
  emergencyType: 'Flood Rescue' | 'Emergency Help' | 'Food Support' | 'Medical Aid';
  message: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  timestamp: string;
}

export interface TelemetryPoint {
  time: string;
  waterLevel: number;
  rainfall: number;
  soilMoisture: number;
}

export interface TrainedFloodModel {
  modelId: string;
  fileName: string;
  format: string;
  architecture: string;
  fileSizeBytes: number;
  uploadedAt: string;
  accuracy: number;
  f1Score: number;
  weights: {
    waterLevelWeight: number;
    rainfall30mWeight: number;
    soilMoistureWeight: number;
    sarInundationWeight: number;
    bias: number;
  };
  notes: string;
}

export interface ModelPrediction {
  modelId: string;
  fileName: string;
  architecture: string;
  floodProbabilityPct: number;
  predictedLevel6h: number;
  predictedLevel24h: number;
  riskClass: 'Low' | 'Medium' | 'High';
}

export interface ForecastItem {
  id: string;
  ownerId: string;
  location: string;
  waterLevel: number;
  rainfall: number;
  floodRisk: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Reviewed' | 'Approved' | 'Rejected' | 'Published';
  aiSummary: string;
}

export interface WarningItem {
  id: string;
  ownerId: string;
  location: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  warningStatus: 'Pending Review' | 'Published' | 'Cancelled';
  advisoryMessage: string;
}

export interface SosRequestItem {
  id: string;
  ownerId: string;
  requesterName: string;
  location: string;
  emergencyType: 'Flood Rescue' | 'Emergency Help' | 'Food Support' | 'Medical Aid';
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface ShelterItem {
  id: string;
  ownerId: string;
  name: string;
  district: 'sylhet' | 'dinajpur' | 'dhaka' | 'sunamganj';
  area: string;
  capacity: number;
  occupancy: number;
  elevation: number;
  status: 'Available' | 'Near Capacity' | 'Full';
}

export interface ManagedUserItem {
  id: string;
  ownerId: string;
  firstName: string;
  lastName: string;
  displayRole: UserRole;
  status: 'Active' | 'Suspended';
  email?: string;
  phone?: string;
}
