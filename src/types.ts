export type AppTab =
  | 'monitor'
  | 'map'
  | 'user'
  | 'forecast'
  | 'disaster'
  | 'volunteer'
  | 'shelter'
  | 'admin'
  | 'auth';

export type UserRole = 'Admin' | 'Forecast Officer' | 'Authority' | 'Volunteer' | 'Citizen';

export type StaffAuthRole = UserRole;

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  token?: string;
}

export interface SosAlertMessage {
  id: string;
  senderName: string;
  senderPhone: string;
  senderEmail?: string;
  location: string;
  emergencyType: 'Flood Rescue' | 'Emergency Help' | 'Food Support' | 'Medical Aid';
  message: string;
  status: 'Pending' | 'Accepted' | 'In Progress' | 'Completed';
  assignedVolunteer?: string;
  isCritical?: boolean;
  timestamp: string;
  submittedAt?: string;
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
  requesterPhone?: string;
  requesterEmail?: string;
  location: string;
  emergencyType: 'Flood Rescue' | 'Emergency Help' | 'Food Support' | 'Medical Aid';
  description?: string;
  status: 'Pending' | 'Accepted' | 'In Progress' | 'Completed';
  assignedVolunteer?: string;
  isCritical?: boolean;
  submittedAt?: string;
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

export interface ShelterBookingItem {
  id: string;
  ownerId: string;
  shelterId: string;
  shelterName: string;
  bookerName: string;
  bookerPhone?: string;
  bookerEmail?: string;
  persons: number;
  status: 'Confirmed' | 'Cancelled';
  timestamp: string;
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
  district?: string;
  emailVerified?: boolean;
}

export type EmailDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
export type EmailType = 'SOS Alert' | 'SOS Status Update' | 'Emergency Broadcast' | 'Operational';
export type EmailPriority = 'Normal' | 'Critical';
export type EmailProviderName = 'resend' | 'sendgrid' | 'unconfigured';
export type EmailTemplateCategory =
  | 'Flood Warning'
  | 'Evacuation Order'
  | 'Shelter Info'
  | 'SOS Alert'
  | 'SOS Status Update'
  | 'Custom';

export interface EmailLogItem {
  id: string;
  ownerId: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'Citizen' | 'Volunteer' | 'Authority' | 'Forecast Officer' | 'Admin' | 'External';
  subject: string;
  message: string;
  emailType: EmailType;
  priority: EmailPriority;
  status: EmailDeliveryStatus;
  provider: EmailProviderName;
  providerMessageId: string;
  errorMessage: string;
  retryCount: number;
  district: string;
  relatedSosId: string;
  timestamp: string;
  updatedAt: string;
}

export interface EmailTemplateItem {
  id: string;
  ownerId: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
}

export interface EmailMetricsSummary {
  total: number;
  delivered: number;
  pending: number;
  failed: number;
  queued: number;
  sent: number;
  bounced: number;
}

export interface EmailSystemSettingsInfo {
  activeProvider: EmailProviderName;
  providerConfigured: boolean;
  fromAddress: string;
  rateLimitPerMinute: number;
  maxRetries: number;
  webhookConfigured: boolean;
  resendWebhookPath: string;
  sendgridWebhookPath: string;
}

export interface UserEmailPreferences {
  email: string;
  emailVerified: boolean;
  district: string;
  sosAlertsEnabled: boolean;
  statusUpdatesEnabled: boolean;
  broadcastsEnabled: boolean;
}

