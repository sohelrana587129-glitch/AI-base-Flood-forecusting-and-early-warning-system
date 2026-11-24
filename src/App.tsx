import React, { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import {
  Droplets,
  Download,
  RefreshCw,
  TrendingUp,
  CloudRain,
  AlertTriangle,
  Wifi,
  Satellite,
  PlusCircle,
  ShieldAlert,
  MapPin,
  Cpu,
  LogIn,
  LogOut,
  CheckCircle2,
  Lock,
  BellRing,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  UserPlus,
  LayoutDashboard,
  Building2,
  Mail,
} from 'lucide-react';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AppTab,
  UserRole,
  StaffAuthRole,
  SessionUser,
  SosAlertMessage,
  TelemetryPoint,
  TrainedFloodModel,
  ModelPrediction,
  ForecastItem,
  WarningItem,
  SosRequestItem,
  ShelterItem,
  ShelterBookingItem,
  ManagedUserItem,
  EmailLogItem,
  UserEmailPreferences,
} from './types';
import { WaterMonitorChart } from './components/WaterMonitorChart';
import { FloodRiskMap } from './components/FloodRiskMap';
import { TrainedModelPanel } from './components/TrainedModelPanel';
import {
  EmailNotificationsPanel,
  syncEmailLogsToFirestore,
} from './components/EmailNotificationsPanel';
import {
  loginLocalAccount,
  registerLocalAccount,
  addLocalSosMessage,
  getStoredSosMessages,
  getLocalTelemetry,
  ingestLocalSensor,
  runLocalModelInference,
  formatRoleDisplay,
  getLocalManagedUsers,
  createLocalUserByAdmin,
  updateLocalUserByAdmin,
  deleteLocalUserByAdmin,
} from './services/localEngine';

const INITIAL_FORECASTS: ForecastItem[] = [
  {
    id: 'fc_dhaka',
    ownerId: 'local',
    location: 'Dhaka',
    waterLevel: 7.5,
    rainfall: 142.0,
    floodRisk: 'High',
    status: 'Pending',
    aiSummary: 'Buriganga basin surge detected (+1.6m in 24h) via Sentinel-1 SAR soil saturation (91%).',
  },
  {
    id: 'fc_sylhet',
    ownerId: 'local',
    location: 'Sylhet',
    waterLevel: 5.2,
    rainfall: 408.6,
    floodRisk: 'Medium',
    status: 'Pending',
    aiSummary: 'Surma River gauge rising steadily; 54.8mm 30-min peak rainfall recorded.',
  },
  {
    id: 'fc_sunamganj',
    ownerId: 'local',
    location: 'Sunamganj',
    waterLevel: 3.1,
    rainfall: 84.5,
    floodRisk: 'Low',
    status: 'Reviewed',
    aiSummary: 'Haor basin levels stabilizing below alert threshold.',
  },
];

const INITIAL_WARNINGS: WarningItem[] = [
  {
    id: 'warn_dhaka',
    ownerId: 'local',
    location: 'Dhaka',
    riskLevel: 'High',
    warningStatus: 'Pending Review',
    advisoryMessage: 'Evacuate low-lying riverfront wards and prepare emergency embankments.',
  },
  {
    id: 'warn_sylhet',
    ownerId: 'local',
    location: 'Sylhet',
    riskLevel: 'Medium',
    warningStatus: 'Published',
    advisoryMessage: 'Waterlogging alert issued for Companiganj, Jaintapur, and Surma riverbank.',
  },
  {
    id: 'warn_sunamganj',
    ownerId: 'local',
    location: 'Sunamganj',
    riskLevel: 'High',
    warningStatus: 'Pending Review',
    advisoryMessage: 'Flash flood alert for Tahirpur and low-lying haor settlements.',
  },
];

const INITIAL_SOS: SosRequestItem[] = [
  {
    id: 'sos_samia',
    ownerId: 'local',
    requesterName: 'Samia Sultana',
    requesterPhone: '01712345678',
    requesterEmail: 'samia.sultana@floodguard.gov.bd',
    location: 'Dhaka',
    emergencyType: 'Flood Rescue',
    description: 'Ground floor submerged 1.4m near river embankment. 4 family members stranded on rooftop.',
    status: 'Pending',
    isCritical: true,
    submittedAt: '10:12 AM',
  },
  {
    id: 'sos_sohel',
    ownerId: 'local',
    requesterName: 'Sohel Rana',
    requesterPhone: '01819876543',
    requesterEmail: 'user@floodguard.gov.bd',
    location: 'Sylhet',
    emergencyType: 'Emergency Help',
    description: 'Surma River water entered village road. Elderly patient requires immediate evacuation.',
    status: 'Pending',
    isCritical: true,
    submittedAt: '10:18 AM',
  },
  {
    id: 'sos_mim',
    ownerId: 'local',
    requesterName: 'Israt Mim',
    requesterPhone: '01911223344',
    requesterEmail: 'israt.mim@floodguard.gov.bd',
    location: 'Sunamganj',
    emergencyType: 'Food Support',
    description: '35 displaced families at Tahirpur shelter require dry food packets and clean drinking water.',
    status: 'Completed',
    assignedVolunteer: 'Sohel Rana (Volunteer & SOS)',
    isCritical: false,
    submittedAt: '09:45 AM',
  },
];

const INITIAL_SHELTERS: ShelterItem[] = [
  {
    id: 'sh_comp_1',
    ownerId: 'local',
    name: 'Companiganj High School',
    district: 'sylhet',
    area: 'companiganj',
    capacity: 450,
    occupancy: 280,
    elevation: 11.4,
    status: 'Available',
  },
  {
    id: 'sh_comp_2',
    ownerId: 'local',
    name: 'Companiganj Govt College',
    district: 'sylhet',
    area: 'companiganj',
    capacity: 600,
    occupancy: 410,
    elevation: 12.0,
    status: 'Available',
  },
  {
    id: 'sh_comp_3',
    ownerId: 'local',
    name: 'Community Flood Center',
    district: 'sylhet',
    area: 'companiganj',
    capacity: 350,
    occupancy: 315,
    elevation: 11.8,
    status: 'Near Capacity',
  },
  {
    id: 'sh_jain_1',
    ownerId: 'local',
    name: 'Jaintapur High School',
    district: 'sylhet',
    area: 'jaintapur',
    capacity: 500,
    occupancy: 210,
    elevation: 13.2,
    status: 'Available',
  },
  {
    id: 'sh_jain_2',
    ownerId: 'local',
    name: 'Jaintapur Govt Primary School',
    district: 'sylhet',
    area: 'jaintapur',
    capacity: 300,
    occupancy: 145,
    elevation: 12.5,
    status: 'Available',
  },
  {
    id: 'sh_jain_3',
    ownerId: 'local',
    name: 'Union Parishad Shelter',
    district: 'sylhet',
    area: 'jaintapur',
    capacity: 400,
    occupancy: 190,
    elevation: 12.8,
    status: 'Available',
  },
  {
    id: 'sh_biral_1',
    ownerId: 'local',
    name: 'Biral Pilot High School',
    district: 'dinajpur',
    area: 'biral',
    capacity: 500,
    occupancy: 175,
    elevation: 36.0,
    status: 'Available',
  },
  {
    id: 'sh_biral_2',
    ownerId: 'local',
    name: 'Biral College',
    district: 'dinajpur',
    area: 'biral',
    capacity: 650,
    occupancy: 230,
    elevation: 36.4,
    status: 'Available',
  },
  {
    id: 'sh_biral_3',
    ownerId: 'local',
    name: 'Biral Community Center',
    district: 'dinajpur',
    area: 'biral',
    capacity: 300,
    occupancy: 110,
    elevation: 35.8,
    status: 'Available',
  },
  {
    id: 'sh_biram_1',
    ownerId: 'local',
    name: 'Birampur High School',
    district: 'dinajpur',
    area: 'birampur',
    capacity: 450,
    occupancy: 160,
    elevation: 35.5,
    status: 'Available',
  },
  {
    id: 'sh_biram_2',
    ownerId: 'local',
    name: 'Birampur College',
    district: 'dinajpur',
    area: 'birampur',
    capacity: 550,
    occupancy: 205,
    elevation: 36.1,
    status: 'Available',
  },
  {
    id: 'sh_biram_3',
    ownerId: 'local',
    name: 'Flood Protection Shelter',
    district: 'dinajpur',
    area: 'birampur',
    capacity: 400,
    occupancy: 130,
    elevation: 36.8,
    status: 'Available',
  },
];

const INITIAL_USERS: ManagedUserItem[] = [
  {
    id: 'usr_rahim',
    ownerId: 'local',
    firstName: 'Rahim',
    lastName: 'Uddin',
    displayRole: 'Citizen',
    status: 'Active',
    email: 'rahim@gmail.com',
    phone: '01711000111',
  },
  {
    id: 'usr_karim',
    ownerId: 'local',
    firstName: 'Karim',
    lastName: 'Ahmed',
    displayRole: 'Forecast Officer',
    status: 'Active',
    email: 'forecast@floodguard.gov.bd',
    phone: '01711000222',
  },
  {
    id: 'usr_sadia',
    ownerId: 'local',
    firstName: 'Sadia',
    lastName: 'Islam',
    displayRole: 'Authority',
    status: 'Active',
    email: 'disaster@floodguard.gov.bd',
    phone: '01711000333',
  },
];

const VALID_TABS: AppTab[] = [
  'monitor',
  'map',
  'user',
  'forecast',
  'disaster',
  'volunteer',
  'shelter',
  'admin',
  'auth',
];

function getInitialTabFromHash(): AppTab {
  if (typeof window === 'undefined') return 'monitor';
  const raw = window.location.hash.replace(/^#\/?/, '').trim() as AppTab;
  return VALID_TABS.includes(raw) ? raw : 'monitor';
}

function getDashboardTabForRole(role: UserRole): AppTab {
  if (role === 'Citizen') return 'user';
  if (role === 'Forecast Officer') return 'forecast';
  if (role === 'Authority') return 'disaster';
  if (role === 'Volunteer') return 'volunteer';
  if (role === 'Admin') return 'admin';
  return 'monitor';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(getInitialTabFromHash);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Role-Based Session User & SOS Messages State (verified by backend)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('fg_session_v1');
      return saved ? (JSON.parse(saved) as SessionUser) : null;
    } catch {
      return null;
    }
  });
  const [sosMessages, setSosMessages] = useState<SosAlertMessage[]>([]);

  // Monitor Dashboard State
  const [stationId, setStationId] = useState('station_01');
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d'>('1d');
  const [stationsList, setStationsList] = useState<
    { id: string; name: string; region: string; center: [number, number] }[]
  >([]);
  const [metrics, setMetrics] = useState({
    currentLevel: 1.65,
    averageLevel: 0.953,
    totalRainfall: 300.6,
    maxRainfall30m: 54.8,
    status: 'NORMAL' as 'NORMAL' | 'WARNING' | 'ALERT',
    lastUpdated: '10:13:08 AM',
  });
  const [points, setPoints] = useState<TelemetryPoint[]>([
    { time: '10:16', waterLevel: 0.83, rainfall: 0, soilMoisture: 68 },
    { time: '10:33', waterLevel: 0.82, rainfall: 0, soilMoisture: 69 },
    { time: '10:50', waterLevel: 0.87, rainfall: 14, soilMoisture: 74 },
    { time: '11:07', waterLevel: 0.91, rainfall: 14, soilMoisture: 78 },
    { time: '11:25', waterLevel: 0.85, rainfall: 0, soilMoisture: 76 },
    { time: '11:42', waterLevel: 0.87, rainfall: 0, soilMoisture: 77 },
    { time: '11:59', waterLevel: 0.83, rainfall: 18, soilMoisture: 82 },
    { time: '09:23', waterLevel: 1.65, rainfall: 54.8, soilMoisture: 94 },
  ]);
  const [activeModel, setActiveModel] = useState<TrainedFloodModel | null>(null);
  const [modelPrediction, setModelPrediction] = useState<ModelPrediction | null>(null);

  // Incoming Sensor Ingestion Form State
  const [newSensorLevel, setNewSensorLevel] = useState('1.68');
  const [newSensorRain, setNewSensorRain] = useState('26.5');
  const [newSensorMoisture, setNewSensorMoisture] = useState('93');
  const [ingesting, setIngesting] = useState(false);

  // Role Dashboards Data State (synced with Firestore when authenticated)
  const [forecasts, setForecasts] = useState<ForecastItem[]>(INITIAL_FORECASTS);
  const [warnings, setWarnings] = useState<WarningItem[]>(INITIAL_WARNINGS);
  const [sosRequests, setSosRequests] = useState<SosRequestItem[]>(INITIAL_SOS);
  const [shelters, setShelters] = useState<ShelterItem[]>(INITIAL_SHELTERS);
  const [managedUsers, setManagedUsers] = useState<ManagedUserItem[]>(INITIAL_USERS);

  // Admin Create User Form State (Admin-only creation of Admin or Staff roles)
  const [showAdminCreateUser, setShowAdminCreateUser] = useState(false);
  const [adminNewFirstName, setAdminNewFirstName] = useState('');
  const [adminNewLastName, setAdminNewLastName] = useState('');
  const [adminNewEmail, setAdminNewEmail] = useState('');
  const [adminNewPhone, setAdminNewPhone] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminNewRole, setAdminNewRole] = useState<StaffAuthRole>('Forecast Officer');

  // Shelter Finder State (matches shelter_a4908dff.html)
  const [selectedDistrict, setSelectedDistrict] = useState<string>('sylhet');
  const [selectedArea, setSelectedArea] = useState<string>('companiganj');

  // Volunteer & SOS Shelter Capacity Management State
  const [volunteerShelterDistrict, setVolunteerShelterDistrict] = useState<string>('all');
  const [shelterDrafts, setShelterDrafts] = useState<
    Record<string, { capacity: string; occupancy: string }>
  >({});
  const [showAddShelter, setShowAddShelter] = useState(false);
  const [newShelterName, setNewShelterName] = useState('');
  const [newShelterDistrict, setNewShelterDistrict] = useState<
    'sylhet' | 'dinajpur' | 'dhaka' | 'sunamganj'
  >('sylhet');
  const [newShelterArea, setNewShelterArea] = useState('companiganj');
  const [newShelterCapacity, setNewShelterCapacity] = useState('400');
  const [newShelterOccupancy, setNewShelterOccupancy] = useState('0');
  const [newShelterElevation, setNewShelterElevation] = useState('12.5');

  // User Shelter Booking State (Minimum 2, Maximum 5 persons per booking)
  const [shelterBookings, setShelterBookings] = useState<ShelterBookingItem[]>([]);
  const [bookingShelterId, setBookingShelterId] = useState<string>('sh_comp_1');
  const [userBookingPersons, setUserBookingPersons] = useState<number>(2);
  const [userBookingName, setUserBookingName] = useState<string>('');
  const [userBookingPhone, setUserBookingPhone] = useState<string>('');
  const [bookingPersonsByShelter, setBookingPersonsByShelter] = useState<Record<string, number>>({});

  // New Warning / SOS Forms
  const [newWarnLocation, setNewWarnLocation] = useState('Sylhet');
  const [newWarnRisk, setNewWarnRisk] = useState<'Low' | 'Medium' | 'High'>('High');
  const [newWarnMsg, setNewWarnMsg] = useState(
    'River water level crossed 1.65m alert threshold. Move livestock and valuables to high ground.'
  );

  const [newSosName, setNewSosName] = useState('');
  const [newSosPhone, setNewSosPhone] = useState('');
  const [newSosLocation, setNewSosLocation] = useState('Sylhet');
  const [newSosType, setNewSosType] = useState<
    'Flood Rescue' | 'Emergency Help' | 'Food Support' | 'Medical Aid'
  >('Flood Rescue');
  const [newSosText, setNewSosText] = useState('');
  const [globalEmergencyStatus, setGlobalEmergencyStatus] = useState('In Progress');

  // Email Notifications Sync & Citizen Preferences State
  const [emailRefreshTrigger, setEmailRefreshTrigger] = useState(0);
  const [userEmailPrefs, setUserEmailPrefs] = useState<UserEmailPreferences | null>(null);
  const [savingUserPrefs, setSavingUserPrefs] = useState(false);

  // Login & Registration Form State with Role Selection Dropdown
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginRole, setLoginRole] = useState<StaffAuthRole>('Citizen');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole] = useState<'Citizen'>('Citizen');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const navigateToTab = useCallback((tab: AppTab) => {
    setAuthErrorMessage(null);
    setMobileMenuOpen(false);
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${tab}`;
    }
  }, []);

  // Sync browser hash changes (protects direct URL navigation)
  useEffect(() => {
    const onHashChange = () => {
      const next = getInitialTabFromHash();
      setActiveTab(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Check if current sessionUser has access to a given role-protected tab
  const hasRoleAccess = (requiredRole: UserRole) => {
    if (!sessionUser) return false;
    if (sessionUser.role === 'Admin') return true;
    return sessionUser.role === requiredRole;
  };

  // Persist sessionUser in sessionStorage
  useEffect(() => {
    try {
      if (sessionUser) {
        sessionStorage.setItem('fg_session_v1', JSON.stringify(sessionUser));
      } else {
        sessionStorage.removeItem('fg_session_v1');
      }
    } catch {
      // ignore storage errors
    }
  }, [sessionUser]);

  // Verify stored session token with backend on mount
  useEffect(() => {
    const verifyBackendSession = async () => {
      if (!sessionUser?.token) return;
      try {
        const res = await fetch('/api/v1/auth/session', {
          headers: { Authorization: `Bearer ${sessionUser.token}` },
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          if (res.status === 401) {
            setSessionUser(null);
            setSosMessages([]);
          } else if (res.ok) {
            const data = await res.json();
            if (data.sessionUser) {
              setSessionUser(data.sessionUser);
              setSosMessages(data.sosMessages || []);
            }
          }
        }
      } catch {
        // Offline / static hosting fallback retains local session
      }
    };
    verifyBackendSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch protected SOS messages ONLY when sessionUser has an authenticated session
  const fetchSosMessages = useCallback(
    async (user?: SessionUser | null) => {
      const active = user || sessionUser;
      if (!active) {
        setSosMessages([]);
        return;
      }
      try {
        const headers: Record<string, string> = {};
        if (active.token) {
          headers.Authorization = `Bearer ${active.token}`;
        }
        const res = await fetch('/api/v1/sos-messages', { headers });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          setSosMessages(data.sosMessages || []);
          if (!currentUser && Array.isArray(data.sosRequests) && data.sosRequests.length > 0) {
            setSosRequests(data.sosRequests);
          }
        } else if (!active.token) {
          setSosMessages(getStoredSosMessages());
        } else {
          setSosMessages([]);
        }
      } catch {
        setSosMessages(getStoredSosMessages());
      }
    },
    [sessionUser, currentUser]
  );

  // Fetch Admin user registry from backend when Admin is authenticated
  const fetchAdminUsers = useCallback(async (user?: SessionUser | null) => {
    const active = user || sessionUser;
    if (!active || active.role !== 'Admin') return;
    try {
      const res = await fetch('/api/v1/admin/users', {
        headers: active.token ? { Authorization: `Bearer ${active.token}` } : {},
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setManagedUsers(data.users);
          return;
        }
      }
      setManagedUsers(getLocalManagedUsers());
    } catch {
      setManagedUsers(getLocalManagedUsers());
    }
  }, [sessionUser]);

  const fetchShelterBookings = useCallback(async (user?: SessionUser | null) => {
    const active = user || sessionUser;
    if (!active) {
      setShelterBookings([]);
      return;
    }
    try {
      const res = await fetch('/api/v1/shelter-bookings', {
        headers: active.token ? { Authorization: `Bearer ${active.token}` } : {},
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.bookings)) {
          setShelterBookings(data.bookings);
        }
      }
    } catch {
      // ignore offline fallback
    }
  }, [sessionUser]);

  const fetchUserEmailPreferences = useCallback(async (user?: SessionUser | null) => {
    const active = user || sessionUser;
    if (!active?.token) {
      setUserEmailPrefs(null);
      return;
    }
    try {
      const res = await fetch('/api/v1/email-preferences', {
        headers: { Authorization: `Bearer ${active.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserEmailPrefs(data);
      }
    } catch {
      // ignore offline fallback
    }
  }, [sessionUser]);

  useEffect(() => {
    if (sessionUser) {
      fetchSosMessages(sessionUser);
      fetchShelterBookings(sessionUser);
      fetchUserEmailPreferences(sessionUser);
      if (sessionUser.role === 'Admin') {
        fetchAdminUsers(sessionUser);
      }
    } else {
      setSosMessages([]);
      setShelterBookings([]);
      setUserEmailPrefs(null);
    }
  }, [sessionUser, fetchSosMessages, fetchShelterBookings, fetchUserEmailPreferences, fetchAdminUsers]);

  const handleLogout = async () => {
    const token = sessionUser?.token;
    if (token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore network errors on logout
      }
    }
    setSessionUser(null);
    setSosMessages([]);
    setShelterBookings([]);
    setAuthErrorMessage(null);
    if (
      activeTab === 'user' ||
      activeTab === 'forecast' ||
      activeTab === 'disaster' ||
      activeTab === 'volunteer' ||
      activeTab === 'admin'
    ) {
      navigateToTab('monitor');
    }
    showToast('Successfully logged out. Protected dashboards and SOS stream locked.');
  };

  // Fetch telemetry from Express backend with automatic client-side fallback for Vercel static hosting
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/telemetry?stationId=${encodeURIComponent(stationId)}&range=${encodeURIComponent(timeRange)}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Fallback to local telemetry engine');
      }
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
      if (data.points) setPoints(data.points);
      if (data.stationsList) setStationsList(data.stationsList);
      if (data.activeModel) setActiveModel(data.activeModel);
      if (data.modelPrediction) setModelPrediction(data.modelPrediction);
    } catch {
      const localData = getLocalTelemetry(stationId, timeRange);
      setMetrics(localData.metrics);
      setPoints(localData.points);
      setStationsList(localData.stationsList);
      setActiveModel(localData.activeModel);
      setModelPrediction(localData.modelPrediction);
    }
  }, [stationId, timeRange]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Fetch live shelter capacities from Express backend
  const fetchShelters = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/shelters');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.shelters) && data.shelters.length > 0) {
          setShelters(data.shelters);
        }
      }
    } catch {
      // keep initial/Firestore shelters on offline fallback
    }
  }, []);

  useEffect(() => {
    fetchShelters();
  }, [fetchShelters]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Seed initial Firestore data for authenticated user if empty, and subscribe via onSnapshot
  useEffect(() => {
    if (!authReady || !currentUser) return;
    const uid = currentUser.uid;

    const seedAndSubscribe = async () => {
      try {
        const fcQuery = query(collection(db, 'forecasts'), where('ownerId', '==', uid));
        const fcSnap = await getDocs(fcQuery);
        if (fcSnap.empty) {
          for (const item of INITIAL_FORECASTS) {
            const docId = `${item.id}_${uid.slice(0, 8)}`;
            await setDoc(doc(db, 'forecasts', docId), {
              ownerId: uid,
              location: item.location,
              waterLevel: item.waterLevel,
              rainfall: item.rainfall,
              floodRisk: item.floodRisk,
              status: item.status,
              aiSummary: item.aiSummary,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const warnQuery = query(collection(db, 'warnings'), where('ownerId', '==', uid));
        const warnSnap = await getDocs(warnQuery);
        if (warnSnap.empty) {
          for (const item of INITIAL_WARNINGS) {
            const docId = `${item.id}_${uid.slice(0, 8)}`;
            await setDoc(doc(db, 'warnings', docId), {
              ownerId: uid,
              location: item.location,
              riskLevel: item.riskLevel,
              warningStatus: item.warningStatus,
              advisoryMessage: item.advisoryMessage,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const sosQuery = query(collection(db, 'sos_requests'), where('ownerId', '==', uid));
        const sosSnap = await getDocs(sosQuery);
        if (sosSnap.empty) {
          for (const item of INITIAL_SOS) {
            const docId = `${item.id}_${uid.slice(0, 8)}`;
            await setDoc(doc(db, 'sos_requests', docId), {
              ownerId: uid,
              requesterName: item.requesterName,
              location: item.location,
              emergencyType: item.emergencyType,
              status: item.status,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const shQuery = query(collection(db, 'shelters'), where('ownerId', '==', uid));
        const shSnap = await getDocs(shQuery);
        if (shSnap.empty) {
          for (const item of INITIAL_SHELTERS) {
            const docId = `${item.id}_${uid.slice(0, 8)}`;
            await setDoc(doc(db, 'shelters', docId), {
              ownerId: uid,
              name: item.name,
              district: item.district,
              area: item.area,
              capacity: item.capacity,
              occupancy: item.occupancy,
              elevation: item.elevation,
              status: item.status,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const usrQuery = query(collection(db, 'users'), where('ownerId', '==', uid));
        const usrSnap = await getDocs(usrQuery);
        if (usrSnap.empty) {
          for (const item of INITIAL_USERS) {
            const docId = `${item.id}_${uid.slice(0, 8)}`;
            await setDoc(doc(db, 'users', docId), {
              ownerId: uid,
              firstName: item.firstName,
              lastName: item.lastName,
              displayRole: item.displayRole,
              status: item.status,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.error('Initial Firestore seed error:', err);
      }
    };

    seedAndSubscribe();

    const unsubForecasts = onSnapshot(
      query(collection(db, 'forecasts'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          setForecasts(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ForecastItem, 'id'>),
            }))
          );
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'forecasts')
    );

    const unsubWarnings = onSnapshot(
      query(collection(db, 'warnings'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          setWarnings(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<WarningItem, 'id'>),
            }))
          );
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'warnings')
    );

    const unsubSos = onSnapshot(
      query(collection(db, 'sos_requests'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          setSosRequests(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<SosRequestItem, 'id'>),
            }))
          );
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sos_requests')
    );

    const unsubShelters = onSnapshot(
      query(collection(db, 'shelters'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          setShelters(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ShelterItem, 'id'>),
            }))
          );
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'shelters')
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('ownerId', '==', uid)),
      (snap) => {
        if (!snap.empty) {
          setManagedUsers(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ManagedUserItem, 'id'>),
            }))
          );
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      unsubForecasts();
      unsubWarnings();
      unsubSos();
      unsubShelters();
      unsubUsers();
    };
  }, [authReady, currentUser]);

  // Download CSV handler for Water Level & Rainfall Monitor
  const handleDownloadCsv = () => {
    const header = 'Time,Water Level (m),Rainfall (mm),Satellite Soil Moisture (%)\n';
    const rows = points
      .map((p) => `${p.time},${p.waterLevel.toFixed(3)},${p.rainfall.toFixed(1)},${p.soilMoisture}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `floodguard_telemetry_${stationId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded real-time Water Level & Rainfall CSV.');
  };

  // Ingest incoming sensor & satellite reading into backend + Firestore (Forecast Officer only)
  const handleIngestSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || sessionUser.role !== 'Forecast Officer') {
      showToast('Locked: Telemetry data cannot be edited or changed except by a Forecast Officer.');
      return;
    }

    setIngesting(true);
    try {
      let latestTimeLabel = 'Now';
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionUser.token) {
          headers.Authorization = `Bearer ${sessionUser.token}`;
        }
        const res = await fetch('/api/v1/ingest-sensor', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            stationId,
            waterLevel: Number(newSensorLevel),
            rainfall: Number(newSensorRain),
            soilMoisture: Number(newSensorMoisture),
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 403) {
          const errData = contentType.includes('application/json') ? await res.json() : {};
          showToast(
            errData.error ||
              'Locked: Only an authenticated Forecast Officer can edit or ingest sensor telemetry data.'
          );
          return;
        }
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error('Fallback to local sensor ingest');
        }
        const data = await res.json();
        latestTimeLabel = data.latestPoint?.time || 'Now';
      } catch {
        const localIngest = ingestLocalSensor(
          stationId,
          Number(newSensorLevel),
          Number(newSensorRain),
          Number(newSensorMoisture)
        );
        latestTimeLabel = localIngest.latestPoint?.time || 'Now';
      }

      await fetchTelemetry();

      const isFloodAlert = Number(newSensorLevel) >= 2.2;
      const statusVal: 'NORMAL' | 'WARNING' | 'ALERT' = isFloodAlert ? 'ALERT' : 'NORMAL';

      if (currentUser) {
        const readingId = `sr_${Date.now()}`;
        const stationName =
          stationsList.find((s) => s.id === stationId)?.name || 'Surma River';
        try {
          await setDoc(doc(db, 'sensor_readings', readingId), {
            ownerId: currentUser.uid,
            stationId,
            stationName: stationName.slice(0, 120),
            timeLabel: latestTimeLabel,
            waterLevel: Math.min(50, Math.max(0, Number(newSensorLevel))),
            rainfall: Math.min(2000, Math.max(0, Number(newSensorRain))),
            soilMoisture: Math.min(100, Math.max(0, Number(newSensorMoisture))),
            status: statusVal,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `sensor_readings/${readingId}`);
        }
      }
      if (isFloodAlert) {
        showToast(
          `WARNING! Water level is ${newSensorLevel}m (>= 2.2m). Flood Alert!`
        );
      } else {
        showToast(
          `Processed incoming sensor reading (${newSensorLevel}m — Status: NORMAL) & updated AI prediction.`
        );
      }
    } catch (err) {
      console.error('Sensor ingest failed:', err);
    } finally {
      setIngesting(false);
    }
  };

  // Run Gemini AI + Custom Trained Model Forecast
  const handleRunGeminiForecast = async (
    location: string,
    waterLevel: number,
    rainfall: number,
    soilMoisture: number
  ) => {
    try {
      let result: {
        location?: string;
        waterLevel?: number;
        rainfall?: number;
        floodRisk?: 'Low' | 'Medium' | 'High';
        aiSummary?: string;
      };

      try {
        const res = await fetch('/api/ai/predict-flood', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location,
            waterLevel,
            rainfall,
            soilMoisture,
            sarInundationPct: 28.4,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error('Fallback to local AI inference');
        }
        result = await res.json();
      } catch {
        const localPred = runLocalModelInference({
          waterLevel,
          rainfall30m: rainfall,
          soilMoisture,
          sarInundationPct: 28.4,
        });
        result = {
          location,
          waterLevel,
          rainfall,
          floodRisk: localPred.riskClass,
          aiSummary: `Trained model (${localPred.fileName}) predicts ${localPred.floodProbabilityPct}% flood probability and ${localPred.predictedLevel24h}m level in 24h based on ${rainfall}mm rainfall and ${soilMoisture}% SAR soil saturation.`,
        };
      }

      const newFcId = `fc_${Date.now()}`;
      const newItem: ForecastItem = {
        id: newFcId,
        ownerId: currentUser?.uid || 'local',
        location: String(result.location || location).slice(0, 100),
        waterLevel: Number(result.waterLevel ?? waterLevel),
        rainfall: Number(result.rainfall ?? rainfall),
        floodRisk: result.floodRisk || 'High',
        status: 'Pending',
        aiSummary: String(result.aiSummary || 'AI forecast generated.').slice(0, 500),
      };

      if (currentUser) {
        try {
          await setDoc(doc(db, 'forecasts', newFcId), {
            ownerId: currentUser.uid,
            location: newItem.location,
            waterLevel: newItem.waterLevel,
            rainfall: newItem.rainfall,
            floodRisk: newItem.floodRisk,
            status: newItem.status,
            aiSummary: newItem.aiSummary,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `forecasts/${newFcId}`);
        }
      } else {
        setForecasts((prev) => [newItem, ...prev]);
      }

      showToast(`Generated AI Forecast for ${location} (${newItem.floodRisk} Risk).`);
    } catch (err) {
      console.error('Failed to run AI forecast:', err);
    }
  };

  // Forecast Officer status update
  const handleUpdateForecastStatus = async (
    item: ForecastItem,
    newStatus: ForecastItem['status']
  ) => {
    if (item.status === 'Rejected') {
      showToast('Rejected forecasts are locked in terminal state.');
      return;
    }
    if (currentUser && item.ownerId === currentUser.uid) {
      try {
        await updateDoc(doc(db, 'forecasts', item.id), {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `forecasts/${item.id}`);
      }
    } else {
      setForecasts((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: newStatus } : f))
      );
    }
    showToast(`Forecast for ${item.location} marked as ${newStatus}.`);
  };

  // Disaster Management Warning status update
  const handleUpdateWarningStatus = async (
    item: WarningItem,
    newStatus: WarningItem['warningStatus']
  ) => {
    if (item.warningStatus === 'Cancelled') {
      showToast('Cancelled warnings are locked in terminal state.');
      return;
    }
    if (currentUser && item.ownerId === currentUser.uid) {
      try {
        await updateDoc(doc(db, 'warnings', item.id), {
          warningStatus: newStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `warnings/${item.id}`);
      }
    } else {
      setWarnings((prev) =>
        prev.map((w) => (w.id === item.id ? { ...w, warningStatus: newStatus } : w))
      );
    }
    showToast(`Warning for ${item.location} updated to ${newStatus}.`);
  };

  // Create & Publish New Disaster Warning
  const handleCreateWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    const warnId = `warn_${Date.now()}`;
    const newWarn: WarningItem = {
      id: warnId,
      ownerId: currentUser?.uid || 'local',
      location: newWarnLocation.slice(0, 100),
      riskLevel: newWarnRisk,
      warningStatus: 'Published',
      advisoryMessage: newWarnMsg.slice(0, 400),
    };

    if (currentUser) {
      try {
        await setDoc(doc(db, 'warnings', warnId), {
          ownerId: currentUser.uid,
          location: newWarn.location,
          riskLevel: newWarn.riskLevel,
          warningStatus: newWarn.warningStatus,
          advisoryMessage: newWarn.advisoryMessage,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `warnings/${warnId}`);
      }
    } else {
      setWarnings((prev) => [newWarn, ...prev]);
    }
    showToast(`Published early warning for ${newWarn.location}.`);
  };

  // Volunteer SOS Request status update (triggers automatic citizen status email)
  const handleUpdateSosStatus = async (
    item: SosRequestItem,
    newStatus: SosRequestItem['status']
  ) => {
    if (item.status === 'Completed' && sessionUser?.role !== 'Admin') {
      showToast('Completed SOS requests are locked in terminal state.');
      return;
    }

    let emailOutcomeNote = '';
    if (sessionUser?.token) {
      try {
        const res = await fetch(`/api/v1/sos-requests/${encodeURIComponent(item.id)}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionUser.token}`,
          },
          body: JSON.stringify({
            status: newStatus,
            requesterName: item.requesterName,
            requesterPhone: item.requesterPhone,
            requesterEmail: item.requesterEmail,
            location: item.location,
            emergencyType: item.emergencyType,
            description: item.description,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (!res.ok) {
            showToast(data.error || 'Failed to update SOS request status.');
            return;
          }
          if (Array.isArray(data.sosRequests) && !currentUser) {
            setSosRequests(data.sosRequests);
          }
          if (Array.isArray(data.sosMessages)) {
            setSosMessages(data.sosMessages);
          }
          if (data.emailLog) {
            const log = data.emailLog as EmailLogItem;
            await syncEmailLogsToFirestore([log], currentUser);
            emailOutcomeNote = ` · Status email ${log.status} to ${log.recipientEmail}`;
          } else if (data.skippedNotificationReason) {
            emailOutcomeNote = ` · ${data.skippedNotificationReason}`;
          }
          setEmailRefreshTrigger((n) => n + 1);
        }
      } catch {
        // offline fallback updates local/Firestore state below
      }
    }

    if (currentUser && item.ownerId === currentUser.uid) {
      try {
        await updateDoc(doc(db, 'sos_requests', item.id), {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `sos_requests/${item.id}`);
      }
    } else if (!sessionUser?.token || currentUser) {
      setSosRequests((prev) =>
        prev.map((s) =>
          s.id === item.id
            ? {
                ...s,
                status: newStatus,
                assignedVolunteer: sessionUser
                  ? `${sessionUser.firstName} ${sessionUser.lastName} (${formatRoleDisplay(sessionUser.role)})`
                  : s.assignedVolunteer,
              }
            : s
        )
      );
    }
    showToast(`SOS for ${item.requesterName} updated to ${newStatus}${emailOutcomeNote}.`);
  };

  // Citizen saves their own email notification preferences
  const handleSaveUserEmailPrefs = async (next: UserEmailPreferences) => {
    if (!sessionUser?.token) return;
    setSavingUserPrefs(true);
    try {
      const res = await fetch('/api/v1/email-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionUser.token}`,
        },
        body: JSON.stringify({
          district: next.district,
          sosAlertsEnabled: next.sosAlertsEnabled,
          statusUpdatesEnabled: next.statusUpdatesEnabled,
          broadcastsEnabled: next.broadcastsEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preferences) {
        setUserEmailPrefs(data.preferences);
        showToast('Updated your flood email notification preferences.');
      } else {
        showToast(data.error || 'Could not save preferences.');
      }
    } finally {
      setSavingUserPrefs(false);
    }
  };

  // Create new SOS Request & Broadcast SOS Message (requires verified authenticated session)
  const handleCreateSos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) {
      showToast('You must Register and Login first to send or receive SOS messages.');
      navigateToTab('auth');
      return;
    }
    const senderNameVal = newSosName.trim() || `${sessionUser.firstName} ${sessionUser.lastName}`;
    const sosId = `sos_${Date.now()}`;
    const isCriticalSos =
      newSosType === 'Flood Rescue' ||
      newSosType === 'Emergency Help' ||
      newSosText.toLowerCase().includes('critical') ||
      newSosText.toLowerCase().includes('trapped') ||
      newSosText.toLowerCase().includes('rooftop');

    const newSos: SosRequestItem = {
      id: sosId,
      ownerId: currentUser?.uid || 'local',
      requesterName: senderNameVal.slice(0, 100),
      requesterPhone: newSosPhone.trim() || sessionUser.phone,
      requesterEmail: sessionUser.email,
      location: newSosLocation.slice(0, 100),
      emergencyType: newSosType,
      description:
        newSosText.trim() ||
        `URGENT SOS (${newSosType}): Immediate assistance requested by ${senderNameVal} in ${newSosLocation}.`,
      status: 'Pending',
      isCritical: isCriticalSos,
      submittedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    const sosPayload = {
      sosId,
      senderName: senderNameVal,
      senderPhone: newSosPhone.trim() || sessionUser.phone,
      senderEmail: sessionUser.email,
      location: newSosLocation,
      emergencyType: newSosType,
      message: newSos.description || '',
    };

    let dispatchedEmailCount = 0;
    let sentOkCount = 0;
    let backendSyncedSos = false;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionUser.token) {
        headers.Authorization = `Bearer ${sessionUser.token}`;
      }
      const res = await fetch('/api/v1/sos-messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(sosPayload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setSosMessages(data.sosMessages || []);
        if (Array.isArray(data.sosRequests) && !currentUser) {
          setSosRequests(data.sosRequests);
          backendSyncedSos = true;
        }
        if (Array.isArray(data.emailDispatchResults) && data.emailDispatchResults.length > 0) {
          const logs = data.emailDispatchResults as EmailLogItem[];
          dispatchedEmailCount = logs.length;
          sentOkCount = logs.filter((l) => l.status !== 'failed').length;
          await syncEmailLogsToFirestore(logs, currentUser);
          setEmailRefreshTrigger((n) => n + 1);
        }
      } else {
        const updatedMsgs = addLocalSosMessage(sosPayload);
        setSosMessages(updatedMsgs);
      }
    } catch {
      const updatedMsgs = addLocalSosMessage(sosPayload);
      setSosMessages(updatedMsgs);
    }

    if (currentUser) {
      try {
        await setDoc(doc(db, 'sos_requests', sosId), {
          ownerId: currentUser.uid,
          requesterName: newSos.requesterName,
          location: newSos.location,
          emergencyType: newSos.emergencyType,
          status: newSos.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `sos_requests/${sosId}`);
      }
    } else if (!backendSyncedSos) {
      setSosRequests((prev) => [newSos, ...prev]);
    }
    setNewSosName('');
    setNewSosPhone('');
    setNewSosText('');
    const emailSummary =
      dispatchedEmailCount > 0
        ? ` Alert emails logged: ${dispatchedEmailCount} (${sentOkCount} sent, ${dispatchedEmailCount - sentOkCount} failed).`
        : '';
    showToast(`SOS logged for ${newSos.requesterName}.${emailSummary}`);
  };

  // Volunteer & SOS Shelter Finder Capacity Management (updates backend, Firestore, and live Shelter Finder)
  const handleUpdateShelterCapacity = async (
    sh: ShelterItem,
    rawCapacity: number,
    rawOccupancy: number,
    customToast?: string
  ) => {
    if (!sessionUser || !hasRoleAccess('Volunteer')) {
      showToast('Only authorized Volunteer & SOS or Admin accounts can manage shelter capacity.');
      return;
    }

    const nextCapacity = Math.min(50000, Math.max(1, Math.round(rawCapacity || sh.capacity)));
    const nextOccupancy = Math.min(
      nextCapacity,
      Math.max(0, Math.round(Number.isNaN(rawOccupancy) ? sh.occupancy : rawOccupancy))
    );
    const nextStatus: ShelterItem['status'] =
      nextOccupancy >= nextCapacity
        ? 'Full'
        : nextOccupancy >= nextCapacity * 0.85
        ? 'Near Capacity'
        : 'Available';

    try {
      const res = await fetch(`/api/v1/shelters/${encodeURIComponent(sh.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {}),
        },
        body: JSON.stringify({ capacity: nextCapacity, occupancy: nextOccupancy }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && !res.ok) {
        const errData = await res.json();
        showToast(errData.error || 'Failed to update shelter capacity.');
        return;
      }
    } catch {
      // static fallback continues updating state/Firestore
    }

    if (currentUser && sh.ownerId === currentUser.uid) {
      try {
        await updateDoc(doc(db, 'shelters', sh.id), {
          capacity: nextCapacity,
          occupancy: nextOccupancy,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `shelters/${sh.id}`);
      }
    }

    setShelters((prev) =>
      prev.map((item) =>
        item.id === sh.id
          ? { ...item, capacity: nextCapacity, occupancy: nextOccupancy, status: nextStatus }
          : item
      )
    );
    setShelterDrafts((prev) => {
      const next = { ...prev };
      delete next[sh.id];
      return next;
    });
    showToast(
      customToast ||
        `Updated ${sh.name}: ${nextOccupancy}/${nextCapacity} evacuees (${nextStatus}).`
    );
  };

  const handleCreateShelter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || !hasRoleAccess('Volunteer')) {
      showToast('Only authorized Volunteer & SOS or Admin accounts can add shelters.');
      return;
    }

    const capNum = Math.min(50000, Math.max(1, Math.round(Number(newShelterCapacity) || 300)));
    const occNum = Math.min(capNum, Math.max(0, Math.round(Number(newShelterOccupancy) || 0)));
    const elevNum = Number((Math.min(5000, Math.max(0, Number(newShelterElevation) || 12))).toFixed(1));
    const statusVal: ShelterItem['status'] =
      occNum >= capNum ? 'Full' : occNum >= capNum * 0.85 ? 'Near Capacity' : 'Available';

    let createdShelter: ShelterItem = {
      id: `sh_${Date.now()}`,
      ownerId: currentUser?.uid || 'local',
      name: newShelterName.trim().slice(0, 120),
      district: newShelterDistrict,
      area: newShelterArea.trim().toLowerCase().slice(0, 60),
      capacity: capNum,
      occupancy: occNum,
      elevation: elevNum,
      status: statusVal,
    };

    try {
      const res = await fetch('/api/v1/shelters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {}),
        },
        body: JSON.stringify({
          name: createdShelter.name,
          district: createdShelter.district,
          area: createdShelter.area,
          capacity: capNum,
          occupancy: occNum,
          elevation: elevNum,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.shelter) {
          createdShelter = { ...data.shelter, ownerId: currentUser?.uid || 'local' };
        }
      }
    } catch {
      // fallback to local/Firestore creation
    }

    if (currentUser) {
      try {
        await setDoc(doc(db, 'shelters', createdShelter.id), {
          ownerId: currentUser.uid,
          name: createdShelter.name,
          district: createdShelter.district,
          area: createdShelter.area,
          capacity: createdShelter.capacity,
          occupancy: createdShelter.occupancy,
          elevation: createdShelter.elevation,
          status: createdShelter.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `shelters/${createdShelter.id}`);
      }
    } else {
      setShelters((prev) => [createdShelter, ...prev]);
    }

    setNewShelterName('');
    setNewShelterCapacity('400');
    setNewShelterOccupancy('0');
    setShowAddShelter(false);
    showToast(`Added shelter "${createdShelter.name}" (${occNum}/${capNum} capacity).`);
  };

  // User Shelter Booking Handler (Authenticated users: minimum 2, maximum 5 persons)
  const handleBookShelter = async (
    sh: ShelterItem,
    rawPersons: number,
    customName?: string,
    customPhone?: string
  ) => {
    if (!sessionUser) {
      setLoginRole('Citizen');
      setAuthMode('login');
      showToast('Please log in or register as a User to book shelter space (2–5 persons).');
      navigateToTab('auth');
      return;
    }

    const persons = Number(rawPersons);
    if (!Number.isInteger(persons) || persons < 2 || persons > 5) {
      showToast('Shelter booking requires a minimum of 2 persons and a maximum of 5 persons.');
      return;
    }

    const remaining = sh.capacity - sh.occupancy;
    if (remaining < persons) {
      showToast(
        `Not enough space at ${sh.name}. Only ${Math.max(0, remaining)} spot(s) remaining.`
      );
      return;
    }

    const bookerNameVal =
      (customName || '').trim() || `${sessionUser.firstName} ${sessionUser.lastName}`;
    const bookerPhoneVal = (customPhone || '').trim() || sessionUser.phone;
    const nextOccupancy = sh.occupancy + persons;
    const nextStatus: ShelterItem['status'] =
      nextOccupancy >= sh.capacity
        ? 'Full'
        : nextOccupancy >= sh.capacity * 0.85
        ? 'Near Capacity'
        : 'Available';

    let createdBooking: ShelterBookingItem = {
      id: `bk_${Date.now()}`,
      ownerId: currentUser?.uid || sessionUser.id,
      shelterId: sh.id,
      shelterName: sh.name,
      bookerName: bookerNameVal.slice(0, 100),
      bookerPhone: bookerPhoneVal.slice(0, 40),
      bookerEmail: sessionUser.email,
      persons,
      status: 'Confirmed',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    try {
      const res = await fetch(`/api/v1/shelters/${encodeURIComponent(sh.id)}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {}),
        },
        body: JSON.stringify({
          persons,
          bookerName: bookerNameVal,
          bookerPhone: bookerPhoneVal,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Could not complete shelter booking.');
          return;
        }
        if (data.booking) createdBooking = data.booking;
        if (Array.isArray(data.shelters)) setShelters(data.shelters);
        if (Array.isArray(data.bookings)) setShelterBookings(data.bookings);
      } else {
        setShelters((prev) =>
          prev.map((item) =>
            item.id === sh.id
              ? { ...item, occupancy: nextOccupancy, status: nextStatus }
              : item
          )
        );
        setShelterBookings((prev) => [createdBooking, ...prev]);
      }
    } catch {
      setShelters((prev) =>
        prev.map((item) =>
          item.id === sh.id
            ? { ...item, occupancy: nextOccupancy, status: nextStatus }
            : item
        )
      );
      setShelterBookings((prev) => [createdBooking, ...prev]);
    }

    if (currentUser) {
      if (sh.ownerId === currentUser.uid) {
        try {
          await updateDoc(doc(db, 'shelters', sh.id), {
            occupancy: nextOccupancy,
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `shelters/${sh.id}`);
        }
      }
      try {
        await setDoc(doc(db, 'shelter_bookings', createdBooking.id), {
          ownerId: currentUser.uid,
          shelterId: sh.id,
          shelterName: sh.name.slice(0, 120),
          bookerName: bookerNameVal.slice(0, 100),
          persons,
          status: 'Confirmed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `shelter_bookings/${createdBooking.id}`);
      }
    }

    showToast(
      `Booked ${persons} spots at ${sh.name} for ${bookerNameVal} (${nextOccupancy}/${sh.capacity} occupied).`
    );
  };

  // Admin User Management actions (Admin-only via backend API + local + Firestore)
  const handleAdminCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || sessionUser.role !== 'Admin') {
      showToast('Only an authorized Admin can create user or Admin accounts.');
      return;
    }

    if (adminNewPassword.length < 6) {
      showToast('Password must be at least 6 characters long.');
      return;
    }

    const payload = {
      firstName: adminNewFirstName,
      lastName: adminNewLastName,
      email: adminNewEmail,
      phone: adminNewPhone,
      password: adminNewPassword,
      role: adminNewRole,
    };

    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to create user account.');
          return;
        }
        createLocalUserByAdmin(payload);
        if (data.user) {
          setManagedUsers((prev) => [data.user, ...prev]);
        }
      } else {
        const localRes = createLocalUserByAdmin(payload);
        if (!localRes.ok) {
          showToast(localRes.error || 'Failed to create user account.');
          return;
        }
        setManagedUsers(getLocalManagedUsers());
      }
    } catch {
      const localRes = createLocalUserByAdmin(payload);
      if (!localRes.ok) {
        showToast(localRes.error || 'Failed to create user account.');
        return;
      }
      setManagedUsers(getLocalManagedUsers());
    }

    setAdminNewFirstName('');
    setAdminNewLastName('');
    setAdminNewEmail('');
    setAdminNewPhone('');
    setAdminNewPassword('');
    setShowAdminCreateUser(false);
    showToast(`Created ${formatRoleDisplay(adminNewRole)} account for ${payload.firstName}.`);
  };

  const handleAdminChangeRole = async (userItem: ManagedUserItem, newRole: StaffAuthRole) => {
    if (!sessionUser || sessionUser.role !== 'Admin') {
      showToast('Only an authorized Admin can assign or modify roles.');
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userItem.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {}),
        },
        body: JSON.stringify({ role: newRole }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && !res.ok) {
        const data = await res.json();
        showToast(data.error || 'Failed to update user role.');
        return;
      }
    } catch {
      // static fallback
    }

    updateLocalUserByAdmin(userItem.id, { role: newRole });
    if (currentUser && userItem.ownerId === currentUser.uid) {
      try {
        await updateDoc(doc(db, 'users', userItem.id), {
          displayRole: newRole,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userItem.id}`);
      }
    } else {
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, displayRole: newRole } : u))
      );
    }
    showToast(`Assigned ${userItem.firstName} to ${formatRoleDisplay(newRole)}.`);
  };

  const handleDeleteUser = async (userItem: ManagedUserItem) => {
    if (!sessionUser || sessionUser.role !== 'Admin') {
      showToast('Only an authorized Admin can delete users.');
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userItem.id)}`, {
        method: 'DELETE',
        headers: sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {},
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && !res.ok) {
        const data = await res.json();
        showToast(data.error || 'Cannot delete user.');
        return;
      }
    } catch {
      // static fallback
    }

    deleteLocalUserByAdmin(userItem.id);
    if (currentUser && userItem.ownerId === currentUser.uid) {
      try {
        await deleteDoc(doc(db, 'users', userItem.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${userItem.id}`);
      }
    } else {
      setManagedUsers((prev) => prev.filter((u) => u.id !== userItem.id));
    }
    showToast(`Removed user ${userItem.firstName} from registry.`);
  };

  const handleToggleUserStatus = async (userItem: ManagedUserItem) => {
    if (!sessionUser || sessionUser.role !== 'Admin') {
      showToast('Only an authorized Admin can update account status.');
      return;
    }
    const nextStatus: 'Active' | 'Suspended' =
      userItem.status === 'Active' ? 'Suspended' : 'Active';

    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(userItem.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && !res.ok) {
        const data = await res.json();
        showToast(data.error || 'Cannot update user status.');
        return;
      }
    } catch {
      // static fallback
    }

    updateLocalUserByAdmin(userItem.id, { status: nextStatus });
    if (currentUser && userItem.ownerId === currentUser.uid) {
      try {
        await updateDoc(doc(db, 'users', userItem.id), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userItem.id}`);
      }
    } else {
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, status: nextStatus } : u))
      );
    }
    showToast(`Updated ${userItem.firstName} status to ${nextStatus}.`);
  };

  // Secure Role Login Handler (verifies credentials & assigned role on backend/database)
  const handleLoginSubmit = async (e: React.FormEvent, roleOverride?: StaffAuthRole) => {
    e.preventDefault();
    setAuthErrorMessage(null);
    const effectiveRole = roleOverride || loginRole;

    let authResult: {
      ok: boolean;
      error?: string;
      sessionUser?: SessionUser;
      sosMessages?: SosAlertMessage[];
    } | null = null;

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          phone: loginPhone,
          password: loginPassword,
          role: effectiveRole,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          // If 403 (role mismatch / suspended), surface exact backend error immediately without fallback bypass
          if (res.status === 403) {
            authResult = { ok: false, error: data.error };
          } else {
            // Check localStorage registered accounts only if not found on server memory
            const localCheck = loginLocalAccount(
              loginEmail,
              loginPhone,
              loginPassword,
              effectiveRole
            );
            authResult = localCheck.ok
              ? localCheck
              : { ok: false, error: data.error || localCheck.error || 'Invalid login credentials.' };
          }
        } else {
          authResult = {
            ok: true,
            sessionUser: data.sessionUser,
            sosMessages: data.sosMessages || [],
          };
        }
      } else {
        authResult = loginLocalAccount(loginEmail, loginPhone, loginPassword, effectiveRole);
      }
    } catch {
      authResult = loginLocalAccount(loginEmail, loginPhone, loginPassword, effectiveRole);
    }

    if (!authResult || !authResult.ok || !authResult.sessionUser) {
      setAuthErrorMessage(authResult?.error || 'Invalid login credentials.');
      return;
    }

    setSessionUser(authResult.sessionUser);
    setSosMessages(authResult.sosMessages || []);
    setLoginPassword('');
    showToast(
      `Signed in as ${authResult.sessionUser.firstName} ${authResult.sessionUser.lastName} (${formatRoleDisplay(authResult.sessionUser.role)}). Redirected to dashboard.`
    );

    navigateToTab(getDashboardTabForRole(authResult.sessionUser.role));
  };

  // Registration Form Submission (Public users can ONLY register as User (General Public); staff/Admin roles are Admin-provisioned)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMessage(null);

    if (regPassword.length < 6) {
      setAuthErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setAuthErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    if ((regRole as UserRole) !== 'Citizen') {
      setAuthErrorMessage(
        'Public registration is restricted to User (General Public) accounts only. Staff and Admin roles can only be created or assigned by an authorized administrator.'
      );
      return;
    }

    const regPayload = {
      firstName: regFirstName,
      lastName: regLastName,
      email: regEmail,
      phone: regPhone,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      role: 'Citizen' as const,
    };

    let regResult: {
      ok: boolean;
      error?: string;
      sessionUser?: SessionUser;
      sosMessages?: SosAlertMessage[];
    } | null = null;

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regPayload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          setAuthErrorMessage(data.error || 'Registration failed.');
          return;
        }
        regResult = {
          ok: true,
          sessionUser: data.sessionUser,
          sosMessages: data.sosMessages || [],
        };
        registerLocalAccount(regPayload);
      } else {
        regResult = registerLocalAccount(regPayload);
      }
    } catch {
      regResult = registerLocalAccount(regPayload);
    }

    if (!regResult || !regResult.ok || !regResult.sessionUser) {
      setAuthErrorMessage(regResult?.error || 'Registration failed.');
      return;
    }

    const usrId = currentUser ? `usr_${Date.now()}` : `local_${Date.now()}`;
    const newUsr: ManagedUserItem = {
      id: usrId,
      ownerId: currentUser?.uid || 'local',
      firstName: regFirstName.trim().slice(0, 80),
      lastName: regLastName.trim().slice(0, 80),
      displayRole: regRole,
      status: 'Active',
      email: regEmail.trim().slice(0, 120),
      phone: regPhone.trim().slice(0, 40),
    };

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', usrId), {
          ownerId: currentUser.uid,
          firstName: newUsr.firstName,
          lastName: newUsr.lastName,
          displayRole: newUsr.displayRole,
          status: 'Active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (newUsr.email && newUsr.phone) {
          await setDoc(doc(db, 'users', usrId, 'private', 'info'), {
            ownerId: currentUser.uid,
            email: newUsr.email,
            phone: newUsr.phone,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${usrId}`);
      }
    } else {
      setManagedUsers((prev) => [newUsr, ...prev]);
    }

    setSessionUser(regResult.sessionUser);
    setSosMessages(regResult.sosMessages || []);
    setRegFirstName('');
    setRegLastName('');
    setRegEmail('');
    setRegPhone('');
    setRegPassword('');
    setRegConfirmPassword('');

    showToast(
      `Registered as ${regResult.sessionUser.firstName} (${formatRoleDisplay(regResult.sessionUser.role)}). Redirected to your dashboard.`
    );
    navigateToTab(getDashboardTabForRole(regResult.sessionUser.role));
  };

  // Protected Route Gate when an unauthenticated or wrong-role user attempts to open a restricted dashboard
  const renderRoleLockGate = (
    requiredRoleName: StaffAuthRole,
    defaultEmail: string
  ) => {
    const requiredLabel = formatRoleDisplay(requiredRoleName);
    return (
      <main className="w-full max-w-lg mx-auto p-6 md:p-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-7 dashboard-card space-y-5">
          <div className="flex items-center gap-3 text-red-600">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {sessionUser ? 'Access Denied — Role Permission Required' : `${requiredLabel} Authorization Required`}
              </h2>
              <p className="text-xs text-slate-600">
                {sessionUser
                  ? `Only accounts verified as ${requiredLabel} (or Admin) can access this dashboard.`
                  : `This route is protected. Sign in with an account assigned to ${requiredLabel} to continue.`}
              </p>
            </div>
          </div>

          {sessionUser ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                You are currently signed in as{' '}
                <strong>
                  {sessionUser.firstName} {sessionUser.lastName}
                </strong>{' '}
                with role <strong>{formatRoleDisplay(sessionUser.role)}</strong>, which does not have
                permission for the <strong>{requiredLabel}</strong> dashboard.
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => navigateToTab(getDashboardTabForRole(sessionUser.role))}
                  className="flex-1 py-2.5 px-4 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Return to My Dashboard ({formatRoleDisplay(sessionUser.role)})
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Logout &amp; Switch Account
                </button>
              </div>
            </div>
          ) : (
            <>
              {authErrorMessage && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {authErrorMessage}
                </div>
              )}

              <form onSubmit={(e) => handleLoginSubmit(e, requiredRoleName)} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Role
                  </label>
                  <div className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-[#123c69]">
                    {requiredLabel}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={defaultEmail}
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={`Enter ${requiredLabel} password`}
                    required
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Verify &amp; Open {requiredLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole(requiredRoleName);
                      setLoginEmail(defaultEmail);
                      setAuthMode('login');
                      navigateToTab('auth');
                    }}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Login / Register
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Simplified Single-Line Horizontal Navigation Bar (Responsive on Mobile) */}
      <header className="bg-[#123c69] text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-[1360px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-6">
          {/* Left: FloodGuard AI Logo */}
          <button
            type="button"
            onClick={() => navigateToTab('monitor')}
            className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#55d6be] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Droplets className="w-5 h-5 text-[#55d6be]" />
            <span>FloodGuard AI</span>
          </button>

          {/* Center: Clean Horizontal Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button
              type="button"
              onClick={() => navigateToTab('monitor')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'monitor'
                  ? 'border-[#55d6be] text-white font-semibold'
                  : 'border-transparent text-slate-200 hover:text-white'
              }`}
            >
              Monitor Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('map')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'map'
                  ? 'border-[#55d6be] text-white font-semibold'
                  : 'border-transparent text-slate-200 hover:text-white'
              }`}
            >
              Flood Risk Map
            </button>
            {sessionUser && (
              <button
                type="button"
                onClick={() => navigateToTab(getDashboardTabForRole(sessionUser.role))}
                className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 inline-flex items-center gap-1.5 ${
                  activeTab === getDashboardTabForRole(sessionUser.role)
                    ? 'border-[#55d6be] text-white font-semibold'
                    : 'border-transparent text-slate-200 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-[#55d6be]" />
                <span>{formatRoleDisplay(sessionUser.role)} Dashboard</span>
              </button>
            )}
          </nav>

          {/* Right: Prominent Login / Register CTA or Active Session + Logout (Desktop) */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {sessionUser ? (
              <>
                <button
                  type="button"
                  onClick={() => navigateToTab(getDashboardTabForRole(sessionUser.role))}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-100 hover:text-white bg-[#245786]/70 hover:bg-[#245786] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#55d6be]" />
                  <span>
                    {sessionUser.firstName} · {formatRoleDisplay(sessionUser.role)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  navigateToTab('auth');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold bg-[#159b83] hover:bg-[#087c68] text-white rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Login / Register</span>
              </button>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-slate-200 hover:text-white hover:bg-[#245786] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Responsive Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#245786] bg-[#0f3156] px-4 py-3 space-y-2">
            <button
              type="button"
              onClick={() => navigateToTab('monitor')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                activeTab === 'monitor'
                  ? 'bg-[#245786] text-white font-semibold'
                  : 'text-slate-200 hover:bg-[#245786]/60'
              }`}
            >
              Monitor Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('map')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-[#245786] text-white font-semibold'
                  : 'text-slate-200 hover:bg-[#245786]/60'
              }`}
            >
              Flood Risk Map
            </button>
            {sessionUser && (
              <button
                type="button"
                onClick={() => navigateToTab(getDashboardTabForRole(sessionUser.role))}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === getDashboardTabForRole(sessionUser.role)
                    ? 'bg-[#245786] text-white font-semibold'
                    : 'text-slate-200 hover:bg-[#245786]/60'
                }`}
              >
                {formatRoleDisplay(sessionUser.role)} Dashboard
              </button>
            )}
            <div className="pt-2 border-t border-[#245786]">
              {sessionUser ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-200">
                    {sessionUser.firstName} ({formatRoleDisplay(sessionUser.role)})
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    navigateToTab('auth');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#159b83] hover:bg-[#087c68] text-white rounded-lg cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login / Register</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Live SOS Emergency Message Banner: ONLY shown if user has Registered & Logged In */}
      {sessionUser && sosMessages.length > 0 ? (
        <div className="bg-red-600 text-white px-6 py-2 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 shrink-0" />
            <span>
              <strong>LIVE SOS ALERT ({sosMessages[0].timestamp}):</strong> [{sosMessages[0].emergencyType}] {sosMessages[0].senderName} ({sosMessages[0].senderPhone}) at {sosMessages[0].location} — &ldquo;{sosMessages[0].message}&rdquo;
            </span>
          </div>
          <span className="text-[11px] text-red-100 whitespace-nowrap shrink-0">
            Verified Session: {sessionUser.email} ({sosMessages.length} SOS active)
          </span>
        </div>
      ) : (
        <div className="bg-slate-800 text-slate-200 px-6 py-2 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>SOS Emergency Messages Locked:</strong> You must <strong>Register and Login</strong> to receive or send real-time SOS emergency messages.
            </span>
          </div>
        </div>
      )}

      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="bg-emerald-700 text-white text-xs font-semibold px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/80 hover:text-white text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: WATER LEVEL & RAINFALL MONITOR DASHBOARD (desh_board_39d99134.html) */}
      {activeTab === 'monitor' && (
        <main className="w-full max-w-[1280px] mx-auto p-4 md:p-8 space-y-5">
          {/* TopHeaderCard */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 dashboard-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Droplets className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                  Water Level &amp; Rainfall Monitor
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium">
                  Real-time satellite SAR &amp; river gauge monitoring system with AI flood forecasting
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <select
                aria-label="Select River Gauge Station"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {stationsList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV</span>
              </button>

              <button
                type="button"
                onClick={fetchTelemetry}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => navigateToTab('shelter')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-[#55d6be]" />
                <span>Shelter Finder</span>
              </button>
            </div>
          </div>

          {/* 5 Metric Summary Cards (matching desh_board_39d99134.html) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Metric 1: Current Level */}
            <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-700">Current Level</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                  {metrics.currentLevel.toFixed(3)}m
                </div>
              </div>
              <div className="text-blue-600">
                <svg
                  className="w-8 h-8 stroke-current"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
            </div>

            {/* Metric 2: Average Level */}
            <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-700">Average Level</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                  {metrics.averageLevel.toFixed(3)}m
                </div>
              </div>
              <div className="text-emerald-600">
                <TrendingUp className="w-8 h-8" />
              </div>
            </div>

            {/* Metric 3: Total Rainfall */}
            <div className="bg-teal-50/70 border border-teal-200/70 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-teal-700">Total Rainfall</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                  {metrics.totalRainfall.toFixed(1)}mm
                </div>
              </div>
              <div className="text-teal-600">
                <CloudRain className="w-8 h-8" />
              </div>
            </div>

            {/* Metric 4: Max Rainfall (30min) */}
            <div className="bg-teal-50/70 border border-teal-200/70 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-teal-700">Max Rainfall (30min)</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                  {metrics.maxRainfall30m.toFixed(1)}mm
                </div>
              </div>
              <div className="text-teal-600">
                <CloudRain className="w-8 h-8" />
              </div>
            </div>

            {/* Metric 5: Current Status (NORMAL when < 2.2m, ALERT when >= 2.2m) */}
            <div
              id="statusCard"
              className={`rounded-xl p-4 flex items-center justify-between border ${
                metrics.currentLevel >= 2.2 || metrics.status === 'ALERT'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50/70 border-emerald-200/70'
              }`}
            >
              <div>
                <span
                  className={`text-xs font-semibold ${
                    metrics.currentLevel >= 2.2 || metrics.status === 'ALERT'
                      ? 'text-red-700'
                      : 'text-emerald-700'
                  }`}
                >
                  Current Status
                </span>
                <div
                  id="currentStatus"
                  className={`text-2xl font-extrabold mt-1 tracking-tight ${
                    metrics.currentLevel >= 2.2 || metrics.status === 'ALERT'
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {metrics.currentLevel >= 2.2 ? 'ALERT' : 'NORMAL'}
                </div>
              </div>
              <div
                id="statusIcon"
                className={
                  metrics.currentLevel >= 2.2 || metrics.status === 'ALERT'
                    ? 'text-red-600'
                    : 'text-emerald-600'
                }
              >
                {metrics.currentLevel >= 2.2 || metrics.status === 'ALERT' ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : (
                  <CheckCircle2 className="w-8 h-8" />
                )}
              </div>
            </div>
          </section>

          {/* MainChartContainer (matching desh_board_39d99134.html) */}
          <section className="bg-white rounded-xl border border-slate-200/80 dashboard-card p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 gap-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600 font-medium">
                <Wifi className="w-4 h-4 text-emerald-500" />
                <span>
                  Connected. Last updated:{' '}
                  <span className="font-normal text-slate-500 font-mono tabular-nums">
                    {metrics.lastUpdated}
                  </span>
                  {sessionUser
                    ? ` · Logged in as ${sessionUser.firstName} (${formatRoleDisplay(sessionUser.role)})`
                    : ' · Guest View (Login to unlock SOS messages)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Time Range"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as '1d' | '7d' | '30d')}
                  className="text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 pr-8 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="1d">1 Day</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>
            </div>

            {/* Chart Legend Items */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-5 pb-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 inline-block" />
                <span>Water Level</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-500 bg-white inline-block" />
                <span>Alert Level (2.2m)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-red-500 bg-white inline-block" />
                <span>Alarm Level (2.5m)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-teal-400 inline-block" />
                <span>Rainfall</span>
              </div>
            </div>

            {/* Chart Canvas */}
            <WaterMonitorChart points={points} alertThreshold={2.2} alarmThreshold={2.5} />
          </section>

          {/* Real-Time Incoming Sensor & Satellite Telemetry Ingestion Bar + Active Trained Model Strip */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 dashboard-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Satellite className="w-4 h-4 text-blue-600" />
                    <span>Process Incoming IoT Sensor &amp; Satellite SAR Telemetry</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Push new water-level, rainfall, and satellite soil moisture readings into the backend database &amp; AI prediction pipeline
                  </p>
                </div>
                {sessionUser?.role !== 'Forecast Officer' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-600 shrink-0 self-start">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Read-Only · Forecast Officer Only</span>
                  </span>
                )}
              </div>

              <form
                onSubmit={handleIngestSensor}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end pt-2"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Water Level (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={
                      sessionUser?.role === 'Forecast Officer'
                        ? newSensorLevel
                        : metrics.currentLevel.toFixed(2)
                    }
                    onChange={(e) => {
                      if (sessionUser?.role === 'Forecast Officer') {
                        setNewSensorLevel(e.target.value);
                      }
                    }}
                    disabled={sessionUser?.role !== 'Forecast Officer'}
                    readOnly={sessionUser?.role !== 'Forecast Officer'}
                    required
                    className={`w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono ${
                      sessionUser?.role !== 'Forecast Officer'
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        : 'bg-white text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rainfall (30min mm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={
                      sessionUser?.role === 'Forecast Officer'
                        ? newSensorRain
                        : metrics.maxRainfall30m.toFixed(1)
                    }
                    onChange={(e) => {
                      if (sessionUser?.role === 'Forecast Officer') {
                        setNewSensorRain(e.target.value);
                      }
                    }}
                    disabled={sessionUser?.role !== 'Forecast Officer'}
                    readOnly={sessionUser?.role !== 'Forecast Officer'}
                    required
                    className={`w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono ${
                      sessionUser?.role !== 'Forecast Officer'
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        : 'bg-white text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SAR Soil Moisture (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={
                      sessionUser?.role === 'Forecast Officer'
                        ? newSensorMoisture
                        : String(points[points.length - 1]?.soilMoisture ?? 94)
                    }
                    onChange={(e) => {
                      if (sessionUser?.role === 'Forecast Officer') {
                        setNewSensorMoisture(e.target.value);
                      }
                    }}
                    disabled={sessionUser?.role !== 'Forecast Officer'}
                    readOnly={sessionUser?.role !== 'Forecast Officer'}
                    required
                    className={`w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono ${
                      sessionUser?.role !== 'Forecast Officer'
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        : 'bg-white text-slate-900'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={ingesting || sessionUser?.role !== 'Forecast Officer'}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    sessionUser?.role === 'Forecast Officer'
                      ? 'bg-[#159b83] hover:bg-[#087c68] text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {sessionUser?.role === 'Forecast Officer' ? (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>{ingesting ? 'Processing...' : 'Ingest Sensor Data'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Forecast Officer Only</span>
                    </>
                  )}
                </button>
              </form>
              {sessionUser?.role !== 'Forecast Officer' && (
                <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Telemetry inputs are locked. Only an authenticated <strong>Forecast Officer</strong> can edit or ingest sensor data.
                  </span>
                </p>
              )}
            </div>

            {/* Active Trained Model Forecast Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 dashboard-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" />
                    AI Model Prediction
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasRoleAccess('Forecast Officer')) {
                        navigateToTab('forecast');
                      } else {
                        setLoginRole('Forecast Officer');
                        setAuthMode('login');
                        showToast('Sign in as Forecast Officer to upload and run custom flood models.');
                        navigateToTab('auth');
                      }
                    }}
                    className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Upload Custom Model →
                  </button>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1 truncate">
                  {activeModel?.fileName || 'floodguard_lstm_sar_ensemble.json'}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeModel?.architecture || 'Bi-LSTM + Sentinel-1 SAR Ensemble'}
                </p>

                {modelPrediction && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[11px] text-slate-500">Flood Prob.</span>
                      <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                        {modelPrediction.floodProbabilityPct}%
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">+24h Surge</span>
                      <div className="text-base font-bold text-blue-700 font-mono tabular-nums">
                        {modelPrediction.predictedLevel24h}m
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Predicted Risk</span>
                      <div
                        className={`text-base font-bold ${
                          modelPrediction.riskClass === 'High'
                            ? 'text-red-600'
                            : modelPrediction.riskClass === 'Medium'
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {modelPrediction.riskClass}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SOS Emergency Messages Inbox Section on Dashboard (Strictly Gated by Login & Registration) */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 dashboard-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-red-600" />
                  <span>Real-Time Citizen SOS Emergency Messages</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Incoming emergency distress messages and rescue coordinates (Requires registered &amp; logged-in account)
                </p>
              </div>
              {sessionUser && (
                <span className="text-xs font-semibold text-emerald-700">
                  Unlocked for {sessionUser.firstName} ({formatRoleDisplay(sessionUser.role)})
                </span>
              )}
            </div>

            {sessionUser ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {sosMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-red-600">{msg.emergencyType}</span>
                      <span className="text-slate-500 font-mono">{msg.timestamp}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">
                      {msg.senderName} · <span className="font-mono">{msg.senderPhone}</span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">{msg.location}</div>
                    <p className="text-xs text-slate-700 pt-1">{msg.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <Lock className="w-7 h-7 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-slate-800">
                  SOS Emergency Messages Hidden for Unregistered / Logged-Out Users
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  To protect citizen privacy and ensure verified emergency dispatch, SOS messages are only delivered after you Register and Log In.
                </p>
                <button
                  type="button"
                  onClick={() => navigateToTab('auth')}
                  className="px-4 py-2 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Go to Login / Registration
                </button>
              </div>
            )}
          </section>
        </main>
      )}

      {/* TAB 2: FLOOD RISK SPATIAL MAP (index_44b34260.html + maps_backend_ef49943d.py) */}
      {activeTab === 'map' && (
        <main className="w-full max-w-[1280px] mx-auto p-4 md:p-8">
          <FloodRiskMap />
        </main>
      )}

      {/* TAB 2B: GENERAL USER PORTAL DASHBOARD (Protected by User/Citizen or Admin role) */}
      {activeTab === 'user' &&
        (hasRoleAccess('Citizen') ? (
          <main className="w-full max-w-[1280px] mx-auto p-4 md:p-8 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#123c69]">User Dashboard</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Signed in as {sessionUser?.firstName} {sessionUser?.lastName} ({sessionUser?.email}) · Real-Time Flood Alerts &amp; Emergency SOS
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigateToTab('monitor')}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Live Telemetry
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('map')}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Flood Risk Map
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('shelter')}
                    className="px-3.5 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Find Nearby Shelter
                  </button>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
                  <h3 className="text-sm font-bold text-[#123c69]">River Status</h3>
                  <div
                    className={`text-2xl font-extrabold ${
                      metrics.currentLevel >= 2.2 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {metrics.currentLevel >= 2.2 ? 'ALERT' : 'NORMAL'} ({metrics.currentLevel.toFixed(2)}m)
                  </div>
                  <p className="text-xs text-slate-500">Latest monitored gauge reading</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
                  <h3 className="text-sm font-bold text-[#123c69]">Published Early Warnings</h3>
                  <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                    {warnings.filter((w) => w.warningStatus === 'Published').length}
                  </div>
                  <p className="text-xs text-slate-500">Official active flood advisories</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
                  <h3 className="text-sm font-bold text-[#123c69]">Verified Shelters</h3>
                  <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                    {shelters.filter((s) => s.status !== 'Full').length}
                  </div>
                  <p className="text-xs text-slate-500">High-elevation shelters accepting evacuees</p>
                </div>
              </section>

              <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                <h2 className="text-base font-bold text-[#123c69] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Published Flood Early Warnings</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {warnings
                    .filter((w) => w.warningStatus === 'Published')
                    .map((w) => (
                      <div
                        key={w.id}
                        className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">{w.location}</span>
                          <span
                            className={`font-bold ${
                              w.riskLevel === 'High'
                                ? 'text-red-600'
                                : w.riskLevel === 'Medium'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {w.riskLevel} Risk
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{w.advisoryMessage}</p>
                      </div>
                    ))}
                </div>
              </section>

              {/* User Shelter Booking Section (Minimum 2, Maximum 5 Persons) */}
              <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[#123c69] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#159b83]" />
                      <span>Book Emergency Shelter Space (2–5 Persons)</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Reserve confirmed spots for your family or group (minimum 2 persons, up to 5 persons per booking).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToTab('shelter')}
                    className="text-xs font-semibold text-[#0d6efd] hover:underline cursor-pointer self-start sm:self-auto"
                  >
                    Browse All Shelters →
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const chosen =
                      shelters.find((s) => s.id === bookingShelterId) ||
                      shelters.find((s) => s.status !== 'Full') ||
                      shelters[0];
                    if (!chosen) return;
                    handleBookShelter(chosen, userBookingPersons, userBookingName, userBookingPhone);
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
                >
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Available Shelter
                    </label>
                    <select
                      value={bookingShelterId}
                      onChange={(e) => setBookingShelterId(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      {shelters.map((sh) => {
                        const free = Math.max(0, sh.capacity - sh.occupancy);
                        return (
                          <option key={sh.id} value={sh.id} disabled={free < 2}>
                            {sh.name} ({sh.area}, {sh.district}) — {free} spots free
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Group Size (Min 2, Max 5)
                    </label>
                    <select
                      value={userBookingPersons}
                      onChange={(e) => setUserBookingPersons(Number(e.target.value))}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold"
                    >
                      <option value={2}>2 Persons</option>
                      <option value={3}>3 Persons</option>
                      <option value={4}>4 Persons</option>
                      <option value={5}>5 Persons</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder={`${sessionUser?.firstName || ''} ${sessionUser?.lastName || ''}`.trim()}
                      value={userBookingName}
                      onChange={(e) => setUserBookingName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Confirm Shelter Booking
                  </button>
                </form>

                {shelterBookings.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <h3 className="text-xs font-bold text-slate-700">
                      Your Confirmed Shelter Bookings ({shelterBookings.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {shelterBookings.map((bk) => (
                        <div
                          key={bk.id}
                          className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{bk.shelterName}</div>
                            <div className="text-slate-600">
                              Booked by {bk.bookerName} · <strong>{bk.persons} persons</strong> · {bk.timestamp}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold text-[11px]">
                            {bk.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <form
                onSubmit={handleCreateSos}
                className="bg-white p-5 rounded-xl border border-slate-200 space-y-3"
              >
                <h2 className="text-base font-bold text-[#123c69] flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-red-600" />
                  <span>Send Emergency SOS Help Request</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Request rescue boats, medical aid, or emergency relief directly to Volunteer &amp; Disaster Management teams.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      placeholder={sessionUser?.firstName || 'Full name'}
                      value={newSosName}
                      onChange={(e) => setNewSosName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder={sessionUser?.phone || '017XXXXXXXX'}
                      value={newSosPhone}
                      onChange={(e) => setNewSosPhone(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                    <select
                      value={newSosLocation}
                      onChange={(e) => setNewSosLocation(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="Dhaka">Dhaka</option>
                      <option value="Sylhet">Sylhet</option>
                      <option value="Sunamganj">Sunamganj</option>
                      <option value="Dinajpur">Dinajpur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Type</label>
                    <select
                      value={newSosType}
                      onChange={(e) =>
                        setNewSosType(
                          e.target.value as
                            | 'Flood Rescue'
                            | 'Emergency Help'
                            | 'Food Support'
                            | 'Medical Aid'
                        )
                      }
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="Flood Rescue">Flood Rescue</option>
                      <option value="Emergency Help">Emergency Help</option>
                      <option value="Food Support">Food Support</option>
                      <option value="Medical Aid">Medical Aid</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Emergency Situation Details
                    </label>
                    <input
                      type="text"
                      placeholder="Describe water depth, stranded persons, and nearest landmark..."
                      value={newSosText}
                      onChange={(e) => setNewSosText(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Send SOS Request
                  </button>
                </div>
              </form>

              <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  Live Community SOS Emergency Feed ({sosMessages.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {sosMessages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-red-600">{m.emergencyType}</span>
                        <span className="font-mono text-slate-500">{m.timestamp}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {m.senderName} ({m.senderPhone})
                      </div>
                      <div className="text-xs text-slate-600">
                        {m.location} · Status: <strong>{m.status}</strong>
                      </div>
                      {m.assignedVolunteer && (
                        <div className="text-[11px] text-[#159b83] font-semibold">
                          Team: {m.assignedVolunteer}
                        </div>
                      )}
                      <p className="text-xs text-slate-800 pt-1">{m.message}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Citizen Email Notification Preferences */}
              {userEmailPrefs && (
                <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-[#123c69] flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#159b83]" />
                        <span>Email Notification Preferences</span>
                      </h2>
                      <p className="text-xs text-slate-500">
                        Manage automated SOS status updates and district flood warning broadcasts sent to{' '}
                        <span className="font-mono text-slate-700">{userEmailPrefs.email}</span>.
                      </p>
                    </div>
                    <div className="text-xs font-semibold text-emerald-700">
                      {userEmailPrefs.emailVerified ? 'Verified Email' : 'Unverified Email'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Your District
                      </label>
                      <select
                        value={userEmailPrefs.district}
                        onChange={(e) =>
                          setUserEmailPrefs({ ...userEmailPrefs, district: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="sylhet">Sylhet</option>
                        <option value="dhaka">Dhaka</option>
                        <option value="sunamganj">Sunamganj</option>
                        <option value="dinajpur">Dinajpur</option>
                      </select>
                    </div>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                      <span className="font-medium text-slate-800">SOS Status Update Emails</span>
                      <input
                        type="checkbox"
                        checked={userEmailPrefs.statusUpdatesEnabled}
                        onChange={(e) =>
                          setUserEmailPrefs({
                            ...userEmailPrefs,
                            statusUpdatesEnabled: e.target.checked,
                          })
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                      <span className="font-medium text-slate-800">Emergency Flood Broadcasts</span>
                      <input
                        type="checkbox"
                        checked={userEmailPrefs.broadcastsEnabled}
                        onChange={(e) =>
                          setUserEmailPrefs({
                            ...userEmailPrefs,
                            broadcastsEnabled: e.target.checked,
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingUserPrefs}
                      onClick={() => handleSaveUserEmailPrefs(userEmailPrefs)}
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      {savingUserPrefs ? 'Saving...' : 'Save Notification Preferences'}
                    </button>
                  </div>
                </section>
              )}
            </main>
        ) : (
          renderRoleLockGate('Citizen', 'user@floodguard.gov.bd')
        ))}

      {/* TAB 3: FORECAST OFFICER DASHBOARD (Protected by Forecast Officer or Admin role) */}
      {activeTab === 'forecast' &&
        (hasRoleAccess('Forecast Officer') ? (
          <main className="w-full max-w-[1280px] mx-auto p-4 md:p-8 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h1 className="text-2xl font-bold text-[#123c69]">Forecast Officer Dashboard</h1>
                <p className="text-sm text-slate-600 mt-1">
                  AI-Based Flood Forecasting and Early Warning System · Officer: {sessionUser?.firstName} ({sessionUser?.email})
                </p>
              </div>

              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Dashboard Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                    <h3 className="text-base font-bold text-[#123c69]">Environmental Data</h3>
                    <p className="text-xs text-slate-600">
                      View live weather, satellite SAR soil moisture, and river water-level telemetry.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateToTab('monitor')}
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      View Data
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                    <h3 className="text-base font-bold text-[#123c69]">AI Predictions &amp; Custom Model</h3>
                    <p className="text-xs text-slate-600">
                      Upload your trained flood model or run Gemini AI satellite flood predictions.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleRunGeminiForecast('Sylhet', metrics.currentLevel, metrics.maxRainfall30m, 92)
                      }
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Run AI Prediction Now
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                    <h3 className="text-base font-bold text-[#123c69]">Pending Forecasts</h3>
                    <p className="text-xs text-slate-600">
                      {forecasts.filter((f) => f.status === 'Pending').length} forecasts waiting for officer validation.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById('forecast-validation-section')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Review Forecasts
                    </button>
                  </div>
                </div>
              </section>

              <TrainedModelPanel
                activeModel={activeModel}
                latestPrediction={modelPrediction}
                onModelUpdated={(model, pred) => {
                  setActiveModel(model);
                  setModelPrediction(pred);
                }}
                onRunGeminiForecast={handleRunGeminiForecast}
              />

              <section id="forecast-validation-section">
                <h2 className="text-lg font-bold text-slate-900 mb-3">Flood Forecast Validation</h2>
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-[#123c69] text-white">
                        <th className="p-3.5 border border-slate-200">Location</th>
                        <th className="p-3.5 border border-slate-200">Water Level</th>
                        <th className="p-3.5 border border-slate-200">Flood Risk</th>
                        <th className="p-3.5 border border-slate-200">AI / Trained Model Summary</th>
                        <th className="p-3.5 border border-slate-200">Status</th>
                        <th className="p-3.5 border border-slate-200">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecasts.map((fc) => (
                        <tr key={fc.id} className="hover:bg-slate-50">
                          <td className="p-3.5 border border-slate-200 font-semibold">{fc.location}</td>
                          <td className="p-3.5 border border-slate-200 font-mono tabular-nums">
                            {fc.waterLevel.toFixed(1)} m
                          </td>
                          <td
                            className={`p-3.5 border border-slate-200 font-bold ${
                              fc.floodRisk === 'High'
                                ? 'text-red-600'
                                : fc.floodRisk === 'Medium'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {fc.floodRisk}
                          </td>
                          <td className="p-3.5 border border-slate-200 text-xs text-slate-600 max-w-md">
                            {fc.aiSummary}
                          </td>
                          <td className="p-3.5 border border-slate-200 font-medium">{fc.status}</td>
                          <td className="p-3.5 border border-slate-200">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateForecastStatus(fc, 'Approved')}
                                className="px-3 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateForecastStatus(fc, 'Rejected')}
                                className="px-3 py-1.5 bg-[#e74c3c] hover:bg-red-700 text-white text-xs font-semibold rounded cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#123c69]">Publish Final Forecast</h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Publish all Approved flood forecasts for public awareness and Disaster Management review.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const approved = forecasts.filter((f) => f.status === 'Approved');
                    for (const item of approved) {
                      await handleUpdateForecastStatus(item, 'Published');
                    }
                    showToast(
                      approved.length > 0
                        ? `Published ${approved.length} approved forecast(s) to Disaster Management.`
                        : 'Approve a forecast above first to publish.'
                    );
                  }}
                  className="px-4 py-2.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap"
                >
                  Publish Forecast
                </button>
              </div>
            </main>
        ) : (
          renderRoleLockGate('Forecast Officer', 'forecast@floodguard.gov.bd')
        ))}

      {/* TAB 4: DISASTER MANAGEMENT DASHBOARD (Protected by Authority or Admin role) */}
      {activeTab === 'disaster' &&
        (hasRoleAccess('Authority') ? (
          <main className="w-full max-w-[1280px] mx-auto p-4 md:p-8 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h1 className="text-2xl font-bold text-[#123c69]">Disaster Management Dashboard</h1>
                <p className="text-sm text-slate-600 mt-1">
                  AI-Based Flood Forecasting and Early Warning System · Authority: {sessionUser?.firstName} ({sessionUser?.email})
                </p>
              </div>

              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Dashboard Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                    <h3 className="text-base font-bold text-[#123c69]">Review Warnings</h3>
                    <p className="text-xs text-slate-600">
                      Review flood warnings received from forecast officers ({warnings.filter((w) => w.warningStatus === 'Pending Review').length} pending).
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById('warning-management-section')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Review Now
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                    <h3 className="text-base font-bold text-[#123c69]">Publish Warnings</h3>
                    <p className="text-xs text-slate-600">
                      Publish approved warnings for citizens ({warnings.filter((w) => w.warningStatus === 'Published').length} active).
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById('warning-control-section')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Publish
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                    <h3 className="text-base font-bold text-[#123c69]">Emergency Situations</h3>
                    <p className="text-xs text-slate-600">
                      Monitor current flood emergency situations on the spatial GIS map.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateToTab('map')}
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Monitor
                    </button>
                  </div>
                </div>
              </section>

              <section id="warning-management-section">
                <h2 className="text-lg font-bold text-slate-900 mb-3">Flood Warning Management</h2>
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-[#123c69] text-white">
                        <th className="p-3.5 border border-slate-200">Location</th>
                        <th className="p-3.5 border border-slate-200">Risk Level</th>
                        <th className="p-3.5 border border-slate-200">Warning Status</th>
                        <th className="p-3.5 border border-slate-200">Advisory Directive</th>
                        <th className="p-3.5 border border-slate-200">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warnings.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50">
                          <td className="p-3.5 border border-slate-200 font-semibold">{w.location}</td>
                          <td
                            className={`p-3.5 border border-slate-200 font-bold ${
                              w.riskLevel === 'High'
                                ? 'text-red-600'
                                : w.riskLevel === 'Medium'
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {w.riskLevel}
                          </td>
                          <td className="p-3.5 border border-slate-200 font-medium">{w.warningStatus}</td>
                          <td className="p-3.5 border border-slate-200 text-xs text-slate-600 max-w-md">
                            {w.advisoryMessage}
                          </td>
                          <td className="p-3.5 border border-slate-200">
                            <div className="flex items-center gap-2">
                              {w.warningStatus === 'Pending Review' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateWarningStatus(w, 'Published')}
                                  className="px-3 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded cursor-pointer"
                                >
                                  Review &amp; Publish
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateWarningStatus(w, 'Published')}
                                    className="px-3 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded cursor-pointer"
                                  >
                                    Verify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateWarningStatus(w, 'Cancelled')}
                                    className="px-3 py-1.5 bg-[#e74c3c] hover:bg-red-700 text-white text-xs font-semibold rounded cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <form
                id="warning-control-section"
                onSubmit={handleCreateWarning}
                className="bg-white p-5 rounded-xl border border-slate-200 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold text-[#123c69]">Warning Control Center</h2>
                  <p className="text-xs text-slate-600">
                    Issue and publish verified early flood warnings directly to citizens and volunteers.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                    <select
                      value={newWarnLocation}
                      onChange={(e) => setNewWarnLocation(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="Sylhet">Sylhet</option>
                      <option value="Dhaka">Dhaka</option>
                      <option value="Sunamganj">Sunamganj</option>
                      <option value="Dinajpur">Dinajpur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Risk Level</label>
                    <select
                      value={newWarnRisk}
                      onChange={(e) => setNewWarnRisk(e.target.value as 'Low' | 'Medium' | 'High')}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Public Advisory Message
                    </label>
                    <input
                      type="text"
                      value={newWarnMsg}
                      onChange={(e) => setNewWarnMsg(e.target.value)}
                      required
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                  >
                    Publish Warning
                  </button>
                </div>
              </form>

              {sessionUser && (
                <EmailNotificationsPanel
                  sessionUser={sessionUser}
                  currentUser={currentUser}
                  shelters={shelters}
                  sosRequests={sosRequests}
                  initialSubTab="broadcast"
                  externalRefreshTrigger={emailRefreshTrigger}
                  showToast={showToast}
                />
              )}
            </main>
        ) : (
          renderRoleLockGate('Authority', 'disaster@floodguard.gov.bd')
        ))}

      {/* TAB 5: VOLUNTEER & SOS DASHBOARD (Protected by Volunteer or Admin role) */}
      {activeTab === 'volunteer' &&
        (sessionUser && hasRoleAccess('Volunteer') ? (
          <main className="w-full max-w-[1280px] mx-auto p-4 md:p-8 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#123c69]">Volunteer &amp; SOS Dashboard</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Authenticated User: {sessionUser.firstName} {sessionUser.lastName} ({formatRoleDisplay(sessionUser.role)}) · Live SOS Stream Active
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToTab('shelter')}
                  className="px-4 py-2 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-semibold rounded-lg cursor-pointer self-start sm:self-auto"
                >
                  Open Shelter Finder
                </button>
              </div>

              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Dashboard Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
                    <h3 className="text-base font-bold text-[#123c69]">SOS Requests</h3>
                    <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                      {sosRequests.length}
                    </div>
                    <p className="text-xs text-slate-600">Total emergency requests</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
                    <h3 className="text-base font-bold text-[#123c69]">Rescue Operations</h3>
                    <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                      {sosRequests.filter((s) => s.status !== 'Completed').length}
                    </div>
                    <p className="text-xs text-slate-600">Ongoing rescue activities</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
                    <h3 className="text-base font-bold text-[#123c69]">Available Shelters</h3>
                    <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                      {shelters.filter((s) => s.status !== 'Full').length}{' '}
                      <span className="text-base font-semibold text-slate-500">
                        / {shelters.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {shelters
                        .reduce((sum, s) => sum + Math.max(0, s.capacity - s.occupancy), 0)
                        .toLocaleString()}{' '}
                      open spaces remaining
                    </p>
                  </div>
                </div>
              </section>

              {/* Real-Time SOS Broadcast Messages Feed */}
              <section className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                <h2 className="text-base font-bold text-red-600 flex items-center gap-2">
                  <BellRing className="w-4 h-4" />
                  <span>Incoming SOS Distress Messages (Verified Registered Users Only)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {sosMessages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-lg border border-red-200 bg-red-50/40 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-red-700">{m.emergencyType}</span>
                        <span className="font-mono text-slate-500">{m.timestamp}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {m.senderName} ({m.senderPhone})
                      </div>
                      <div className="text-xs text-slate-600">{m.location}</div>
                      <p className="text-xs text-slate-800 pt-1">{m.message}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Submit New Emergency SOS Request */}
              <form
                onSubmit={handleCreateSos}
                className="bg-white p-5 rounded-xl border border-slate-200 space-y-3"
              >
                <h3 className="text-base font-bold text-[#123c69]">
                  Broadcast New Citizen SOS Message
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Citizen Name
                    </label>
                    <input
                      type="text"
                      placeholder={sessionUser.firstName}
                      value={newSosName}
                      onChange={(e) => setNewSosName(e.target.value)}
                      required
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder={sessionUser.phone}
                      value={newSosPhone}
                      onChange={(e) => setNewSosPhone(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Location
                    </label>
                    <select
                      value={newSosLocation}
                      onChange={(e) => setNewSosLocation(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="Dhaka">Dhaka</option>
                      <option value="Sylhet">Sylhet</option>
                      <option value="Sunamganj">Sunamganj</option>
                      <option value="Dinajpur">Dinajpur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Emergency Type
                    </label>
                    <select
                      value={newSosType}
                      onChange={(e) =>
                        setNewSosType(
                          e.target.value as
                            | 'Flood Rescue'
                            | 'Emergency Help'
                            | 'Food Support'
                            | 'Medical Aid'
                        )
                      }
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    >
                      <option value="Flood Rescue">Flood Rescue</option>
                      <option value="Emergency Help">Emergency Help</option>
                      <option value="Food Support">Food Support</option>
                      <option value="Medical Aid">Medical Aid</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SOS Distress Message Details
                    </label>
                    <input
                      type="text"
                      placeholder="Describe water depth, stranded persons, and landmark..."
                      value={newSosText}
                      onChange={(e) => setNewSosText(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Send SOS Alert Message
                  </button>
                </div>
              </form>

              {/* SOS Request Management Table */}
              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">SOS Request Management</h2>
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-[#123c69] text-white">
                        <th className="p-3.5 border border-slate-200">Citizen &amp; Contact</th>
                        <th className="p-3.5 border border-slate-200">Location</th>
                        <th className="p-3.5 border border-slate-200">Emergency</th>
                        <th className="p-3.5 border border-slate-200">Status &amp; Team</th>
                        <th className="p-3.5 border border-slate-200">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sosRequests.map((sos) => (
                        <tr
                          key={sos.id}
                          className={`hover:bg-slate-50 ${
                            sos.isCritical && sos.status !== 'Completed' ? 'bg-red-50/30' : ''
                          }`}
                        >
                          <td className="p-3.5 border border-slate-200">
                            <div className="font-semibold text-slate-900">{sos.requesterName}</div>
                            {(sos.requesterPhone || sos.requesterEmail) && (
                              <div className="text-[11px] font-mono text-slate-500">
                                {sos.requesterPhone || ''}
                                {sos.requesterPhone && sos.requesterEmail ? ' · ' : ''}
                                {sos.requesterEmail || ''}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 border border-slate-200">
                            <div>{sos.location}</div>
                            {sos.submittedAt && (
                              <div className="text-[11px] font-mono text-slate-500">
                                {sos.submittedAt}
                              </div>
                            )}
                          </td>
                          <td
                            className={`p-3.5 border border-slate-200 font-bold ${
                              sos.isCritical ||
                              sos.emergencyType === 'Flood Rescue' ||
                              sos.emergencyType === 'Emergency Help'
                                ? 'text-red-600'
                                : 'text-slate-800'
                            }`}
                          >
                            <div>{sos.emergencyType}</div>
                            {sos.isCritical && (
                              <div className="text-[11px] font-bold uppercase text-red-700">
                                Critical Priority
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 border border-slate-200 font-medium">
                            <div>{sos.status}</div>
                            {sos.assignedVolunteer && (
                              <div className="text-[11px] text-[#159b83] font-semibold">
                                {sos.assignedVolunteer}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 border border-slate-200">
                            {hasRoleAccess('Volunteer') ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {sos.status === 'Pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSosStatus(sos, 'Accepted')}
                                    className="px-2.5 py-1.5 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
                                  >
                                    Accept
                                  </button>
                                )}
                                {(sos.status === 'Pending' || sos.status === 'Accepted') && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSosStatus(sos, 'In Progress')}
                                    className="px-2.5 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
                                  >
                                    Start Rescue
                                  </button>
                                )}
                                {sos.status !== 'Completed' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSosStatus(sos, 'Completed')}
                                    className="px-2.5 py-1.5 bg-[#3498db] hover:bg-blue-600 text-white text-xs font-semibold rounded cursor-pointer whitespace-nowrap"
                                  >
                                    Mark Done
                                  </button>
                                ) : (
                                  <span className="px-2.5 py-1.5 bg-[#3498db] text-white text-xs font-semibold rounded inline-block">
                                    Completed
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Volunteer Action Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Shelter Finder Capacity Management (Live-synced with Shelter Finder) */}
              <section
                id="volunteer-shelter-capacity"
                className="bg-white p-5 rounded-xl border border-slate-200 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#123c69] flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[#159b83]" />
                      <span>Shelter Finder Capacity Management</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage evacuee occupancy and maximum shelter capacity. Updates reflect immediately in Shelter Finder and User Dashboard.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filter Shelters by District"
                      value={volunteerShelterDistrict}
                      onChange={(e) => setVolunteerShelterDistrict(e.target.value)}
                      className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 text-slate-800"
                    >
                      <option value="all">All Districts ({shelters.length})</option>
                      <option value="sylhet">Sylhet</option>
                      <option value="dinajpur">Dinajpur</option>
                      <option value="dhaka">Dhaka</option>
                      <option value="sunamganj">Sunamganj</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddShelter((prev) => !prev)}
                      className="px-3.5 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      {showAddShelter ? 'Close Add Form' : '+ Add Shelter'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToTab('shelter')}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      View Shelter Finder →
                    </button>
                  </div>
                </div>

                {/* Summary Capacity Strip */}
                {(() => {
                  const filtered = shelters.filter(
                    (s) =>
                      volunteerShelterDistrict === 'all' || s.district === volunteerShelterDistrict
                  );
                  const totalCap = filtered.reduce((sum, s) => sum + s.capacity, 0);
                  const totalOcc = filtered.reduce((sum, s) => sum + s.occupancy, 0);
                  const remaining = Math.max(0, totalCap - totalOcc);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Total Shelter Capacity
                        </span>
                        <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                          {totalCap.toLocaleString()} persons
                        </div>
                      </div>
                      <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200/70">
                        <span className="text-[11px] font-semibold text-blue-700">
                          Current Evacuee Occupancy
                        </span>
                        <div className="text-xl font-bold text-blue-900 font-mono tabular-nums mt-0.5">
                          {totalOcc.toLocaleString()} persons
                        </div>
                      </div>
                      <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70">
                        <span className="text-[11px] font-semibold text-emerald-700">
                          Remaining Free Spaces
                        </span>
                        <div className="text-xl font-bold text-emerald-900 font-mono tabular-nums mt-0.5">
                          {remaining.toLocaleString()} spots
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Optional Add New Shelter Form */}
                {showAddShelter && (
                  <form
                    onSubmit={handleCreateShelter}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <h3 className="text-sm font-bold text-[#123c69]">
                      Register New Flood Shelter
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Shelter Name
                        </label>
                        <input
                          type="text"
                          value={newShelterName}
                          onChange={(e) => setNewShelterName(e.target.value)}
                          placeholder="e.g., Sylhet Central Relief Center"
                          required
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          District
                        </label>
                        <select
                          value={newShelterDistrict}
                          onChange={(e) =>
                            setNewShelterDistrict(
                              e.target.value as 'sylhet' | 'dinajpur' | 'dhaka' | 'sunamganj'
                            )
                          }
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        >
                          <option value="sylhet">Sylhet</option>
                          <option value="dinajpur">Dinajpur</option>
                          <option value="dhaka">Dhaka</option>
                          <option value="sunamganj">Sunamganj</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Area / Upazila
                        </label>
                        <input
                          type="text"
                          value={newShelterArea}
                          onChange={(e) => setNewShelterArea(e.target.value)}
                          placeholder="companiganj"
                          required
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Max Capacity
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50000"
                          value={newShelterCapacity}
                          onChange={(e) => setNewShelterCapacity(e.target.value)}
                          required
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Initial Occupancy
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50000"
                          value={newShelterOccupancy}
                          onChange={(e) => setNewShelterOccupancy(e.target.value)}
                          required
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-700">
                          Elevation (m):
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5000"
                          value={newShelterElevation}
                          onChange={(e) => setNewShelterElevation(e.target.value)}
                          className="w-24 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Save New Shelter
                      </button>
                    </div>
                  </form>
                )}

                {/* Shelter Capacity Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-[#123c69] text-white">
                        <th className="p-3 border-b border-slate-200">Shelter &amp; Area</th>
                        <th className="p-3 border-b border-slate-200">Live Occupancy</th>
                        <th className="p-3 border-b border-slate-200">Edit Occupancy / Capacity</th>
                        <th className="p-3 border-b border-slate-200">Status</th>
                        <th className="p-3 border-b border-slate-200">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shelters
                        .filter(
                          (s) =>
                            volunteerShelterDistrict === 'all' ||
                            s.district === volunteerShelterDistrict
                        )
                        .map((sh) => {
                          const draft = shelterDrafts[sh.id] || {
                            capacity: String(sh.capacity),
                            occupancy: String(sh.occupancy),
                          };
                          const pct = Math.min(
                            100,
                            Math.round((sh.occupancy / Math.max(1, sh.capacity)) * 100)
                          );
                          const freeSpots = Math.max(0, sh.capacity - sh.occupancy);
                          return (
                            <tr key={sh.id} className="hover:bg-slate-50 border-b border-slate-100">
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{sh.name}</div>
                                <div className="text-[11px] text-slate-500 capitalize">
                                  {sh.area}, {sh.district} · Elev: {sh.elevation}m
                                </div>
                              </td>
                              <td className="p-3 min-w-[165px]">
                                <div className="flex items-center justify-between font-mono font-semibold text-slate-800 mb-1">
                                  <span>
                                    {sh.occupancy} / {sh.capacity}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {freeSpots} free ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      sh.status === 'Full'
                                        ? 'bg-red-500'
                                        : sh.status === 'Near Capacity'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    aria-label={`Occupancy for ${sh.name}`}
                                    min="0"
                                    max="50000"
                                    value={draft.occupancy}
                                    onChange={(e) =>
                                      setShelterDrafts((prev) => ({
                                        ...prev,
                                        [sh.id]: {
                                          capacity: draft.capacity,
                                          occupancy: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-20 px-2 py-1.5 border border-slate-300 rounded font-mono text-xs bg-white"
                                  />
                                  <span className="text-slate-400 font-bold">/</span>
                                  <input
                                    type="number"
                                    aria-label={`Max capacity for ${sh.name}`}
                                    min="1"
                                    max="50000"
                                    value={draft.capacity}
                                    onChange={(e) =>
                                      setShelterDrafts((prev) => ({
                                        ...prev,
                                        [sh.id]: {
                                          capacity: e.target.value,
                                          occupancy: draft.occupancy,
                                        },
                                      }))
                                    }
                                    className="w-20 px-2 py-1.5 border border-slate-300 rounded font-mono text-xs bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateShelterCapacity(
                                        sh,
                                        Number(draft.capacity),
                                        Number(draft.occupancy)
                                      )
                                    }
                                    className="px-2.5 py-1.5 bg-[#123c69] hover:bg-[#245786] text-white font-semibold rounded cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 font-bold">
                                <span
                                  className={
                                    sh.status === 'Available'
                                      ? 'text-emerald-600'
                                      : sh.status === 'Near Capacity'
                                      ? 'text-amber-600'
                                      : 'text-red-600'
                                  }
                                >
                                  {sh.status}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateShelterCapacity(
                                        sh,
                                        sh.capacity,
                                        Math.max(0, sh.occupancy - 10),
                                        `Checked out -10 evacuees from ${sh.name}.`
                                      )
                                    }
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded cursor-pointer"
                                  >
                                    -10
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateShelterCapacity(
                                        sh,
                                        sh.capacity,
                                        Math.min(sh.capacity, sh.occupancy + 10),
                                        `Checked in +10 evacuees at ${sh.name}.`
                                      )
                                    }
                                    className="px-2.5 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white font-semibold rounded cursor-pointer"
                                  >
                                    +10
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {shelterBookings.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <h3 className="text-xs font-bold text-[#123c69]">
                      Recent User Shelter Bookings ({shelterBookings.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {shelterBookings.slice(0, 6).map((bk) => (
                        <div
                          key={bk.id}
                          className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{bk.shelterName}</div>
                            <div className="text-slate-600">
                              {bk.bookerName} · <strong>{bk.persons} persons</strong>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {bk.bookerPhone || ''} · {bk.timestamp}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                            {bk.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="text-base font-bold text-[#123c69]">Rescue Activities</h3>
                  <p className="text-xs text-slate-600">
                    Coordinate rescue boats and relief kits in affected low-lying wards.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateToTab('map')}
                    className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                  >
                    Manage Rescue on GIS Map
                  </button>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="text-base font-bold text-[#123c69]">Emergency Response Status</h3>
                  <p className="text-xs text-slate-600">
                    Current Field Response Status: <strong>{globalEmergencyStatus}</strong>
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={globalEmergencyStatus}
                      onChange={(e) => setGlobalEmergencyStatus(e.target.value)}
                      className="text-xs border border-slate-300 rounded-md px-3 py-2"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        showToast(`Updated field emergency response status to ${globalEmergencyStatus}.`)
                      }
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Update Status
                    </button>
                  </div>
                </div>
              </div>

              {/* Email & Emergency Notifications Management Section */}
              <EmailNotificationsPanel
                sessionUser={sessionUser}
                currentUser={currentUser}
                shelters={shelters}
                sosRequests={sosRequests}
                initialSubTab="history"
                externalRefreshTrigger={emailRefreshTrigger}
                showToast={showToast}
              />
            </main>
        ) : (
          renderRoleLockGate('Volunteer', 'volunteer@floodguard.gov.bd')
        ))}

      {/* TAB 6: FLOOD SHELTER FINDER (shelter_a4908dff.html) */}
      {activeTab === 'shelter' && (
        <main className="w-full max-w-[1100px] mx-auto p-6 md:p-8 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 dashboard-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[#0d6efd] flex items-center gap-2">
                  <MapPin className="w-6 h-6" />
                  <span>Flood Shelter Finder</span>
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Select your district and upazila/area to locate verified high-elevation flood shelters and live capacity.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigateToTab(sessionUser ? getDashboardTabForRole(sessionUser.role) : 'monitor')
                }
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap self-start"
              >
                ← Back to {sessionUser ? 'Dashboard' : 'Monitor'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Location (District):
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    const dist = e.target.value;
                    setSelectedDistrict(dist);
                    if (dist === 'sylhet') setSelectedArea('companiganj');
                    else if (dist === 'dinajpur') setSelectedArea('biral');
                    else setSelectedArea('all');
                  }}
                  className="w-full max-w-xs px-3.5 py-2.5 border-2 border-[#0d6efd] rounded-lg text-sm font-medium text-slate-800 bg-white"
                >
                  <option value="sylhet">Sylhet</option>
                  <option value="dinajpur">Dinajpur</option>
                  <option value="dhaka">Dhaka</option>
                  <option value="sunamganj">Sunamganj</option>
                </select>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">
                  Select Area (Upazila):
                </span>
                {selectedDistrict === 'sylhet' && (
                  <div className="flex items-center gap-6 pt-1">
                    <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="area"
                        checked={selectedArea === 'companiganj'}
                        onChange={() => setSelectedArea('companiganj')}
                        className="text-[#0d6efd]"
                      />
                      <span>Companiganj</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="area"
                        checked={selectedArea === 'jaintapur'}
                        onChange={() => setSelectedArea('jaintapur')}
                        className="text-[#0d6efd]"
                      />
                      <span>Jaintapur</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="area"
                        checked={selectedArea === 'all'}
                        onChange={() => setSelectedArea('all')}
                        className="text-[#0d6efd]"
                      />
                      <span>All Areas</span>
                    </label>
                  </div>
                )}

                {selectedDistrict === 'dinajpur' && (
                  <div className="flex items-center gap-6 pt-1">
                    <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="area"
                        checked={selectedArea === 'biral'}
                        onChange={() => setSelectedArea('biral')}
                        className="text-[#0d6efd]"
                      />
                      <span>Biral</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="area"
                        checked={selectedArea === 'birampur'}
                        onChange={() => setSelectedArea('birampur')}
                        className="text-[#0d6efd]"
                      />
                      <span>Birampur</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="area"
                        checked={selectedArea === 'all'}
                        onChange={() => setSelectedArea('all')}
                        className="text-[#0d6efd]"
                      />
                      <span>All Areas</span>
                    </label>
                  </div>
                )}

                {(selectedDistrict === 'dhaka' || selectedDistrict === 'sunamganj') && (
                  <p className="text-xs text-slate-500 pt-2">
                    Showing all registered shelters in <span className="capitalize font-semibold">{selectedDistrict}</span>.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {shelters
              .filter(
                (s) =>
                  s.district === selectedDistrict &&
                  (selectedArea === 'all' || s.area === selectedArea)
              )
              .map((sh) => (
                <div
                  key={sh.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 dashboard-card flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-[#0d6efd]">{sh.name}</h3>
                      <span
                        className={`text-xs font-bold ${
                          sh.status === 'Available'
                            ? 'text-emerald-600'
                            : sh.status === 'Near Capacity'
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      >
                        {sh.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 capitalize mt-1">
                      Area: {sh.area}, {sh.district} · Ground Elevation: {sh.elevation}m
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600">Current Occupancy:</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {sh.occupancy} / {sh.capacity} persons
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {sessionUser ? (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                          <span>Book Shelter (Min 2 – Max 5 Persons)</span>
                          <span className="text-emerald-700 font-mono">
                            {Math.max(0, sh.capacity - sh.occupancy)} free
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Select persons to book at ${sh.name}`}
                            value={bookingPersonsByShelter[sh.id] ?? 2}
                            onChange={(e) =>
                              setBookingPersonsByShelter((prev) => ({
                                ...prev,
                                [sh.id]: Number(e.target.value),
                              }))
                            }
                            disabled={sh.capacity - sh.occupancy < 2}
                            className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white font-semibold"
                          >
                            <option value={2}>2 Persons</option>
                            <option value={3}>3 Persons</option>
                            <option value={4}>4 Persons</option>
                            <option value={5}>5 Persons</option>
                          </select>
                          <button
                            type="button"
                            disabled={sh.capacity - sh.occupancy < 2}
                            onClick={() =>
                              handleBookShelter(sh, bookingPersonsByShelter[sh.id] ?? 2)
                            }
                            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                              sh.capacity - sh.occupancy >= 2
                                ? 'bg-[#159b83] hover:bg-[#087c68] text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {sh.capacity - sh.occupancy >= 2 ? 'Book Shelter' : 'Full'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setLoginRole('Citizen');
                          setAuthMode('login');
                          showToast('Sign in as a User to book shelter space (2–5 persons).');
                          navigateToTab('auth');
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      >
                        Login as User to Book (2–5 Persons) · {Math.max(0, sh.capacity - sh.occupancy)} free
                      </button>
                    )}

                    {hasRoleAccess('Volunteer') && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateShelterCapacity(
                            sh,
                            sh.capacity,
                            Math.min(sh.capacity, sh.occupancy + 10),
                            `Checked in +10 evacuees at ${sh.name}.`
                          )
                        }
                        className="w-full py-2 bg-[#0d6efd] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Check-In Evacuees (+10)
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </main>
      )}

      {/* TAB 7: ADMIN DASHBOARD (Strictly Protected by Admin Password) */}
      {activeTab === 'admin' &&
        (hasRoleAccess('Admin') ? (
          <main className="w-full max-w-[1280px] mx-auto p-4 md:p-8 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h1 className="text-2xl font-bold text-[#123c69]">Admin Control Panel</h1>
                <p className="text-sm text-slate-600 mt-1">
                  AI-Based Flood Forecasting and Early Warning System · Authenticated Admin: {sessionUser?.email}
                </p>
              </div>

              <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Dashboard Overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-[#123c69]">Total Users</h3>
                    <div className="text-3xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                      {managedUsers.length}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Registered system users</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-[#123c69]">Forecast Officers</h3>
                    <div className="text-3xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                      {
                        managedUsers.filter(
                          (u) => u.displayRole === 'Forecast Officer' && u.status === 'Active'
                        ).length
                      }
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Active forecast officers</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-[#123c69]">Published Warnings</h3>
                    <div className="text-3xl font-bold text-slate-900 mt-1 font-mono tabular-nums">
                      {warnings.filter((w) => w.warningStatus === 'Published').length}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Total published warnings</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-[#123c69]">System Status</h3>
                    <div className="text-3xl font-bold text-emerald-600 mt-1">Active</div>
                    <p className="text-xs text-slate-500 mt-1">Satellite &amp; AI pipeline running</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">User &amp; Role Management</h2>
                    <p className="text-xs text-slate-500">
                      Only authorized Admins can create Admin accounts or reassign user roles.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdminCreateUser((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer self-start"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{showAdminCreateUser ? 'Close Create Form' : '+ Create User / Assign Role'}</span>
                  </button>
                </div>

                {showAdminCreateUser && (
                  <form
                    onSubmit={handleAdminCreateUser}
                    className="bg-white p-5 rounded-xl border border-slate-200 space-y-3"
                  >
                    <h3 className="text-sm font-bold text-[#123c69]">
                      Create Staff or Admin Account (Admin-Only Provisioning)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                        <input
                          type="text"
                          value={adminNewFirstName}
                          onChange={(e) => setAdminNewFirstName(e.target.value)}
                          required
                          placeholder="First name"
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={adminNewLastName}
                          onChange={(e) => setAdminNewLastName(e.target.value)}
                          required
                          placeholder="Last name"
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
                        <select
                          value={adminNewRole}
                          onChange={(e) => setAdminNewRole(e.target.value as StaffAuthRole)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold"
                        >
                          <option value="Citizen">User (General Public)</option>
                          <option value="Forecast Officer">Forecast Officer</option>
                          <option value="Authority">Disaster Management</option>
                          <option value="Volunteer">Volunteer &amp; SOS</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={adminNewEmail}
                          onChange={(e) => setAdminNewEmail(e.target.value)}
                          required
                          placeholder="user@floodguard.gov.bd"
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                        <input
                          type="text"
                          value={adminNewPhone}
                          onChange={(e) => setAdminNewPhone(e.target.value)}
                          required
                          placeholder="01711000000"
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Password (min 6 chars)
                        </label>
                        <input
                          type="password"
                          value={adminNewPassword}
                          onChange={(e) => setAdminNewPassword(e.target.value)}
                          required
                          minLength={6}
                          placeholder="Set password"
                          className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdminCreateUser(false)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-semibold rounded-md cursor-pointer"
                      >
                        Create Account
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-[#123c69] text-white">
                        <th className="p-3.5 border border-slate-200">User</th>
                        <th className="p-3.5 border border-slate-200">Assigned Role</th>
                        <th className="p-3.5 border border-slate-200">Status</th>
                        <th className="p-3.5 border border-slate-200">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="p-3.5 border border-slate-200">
                            <div className="font-semibold text-slate-900">
                              {u.firstName} {u.lastName}
                            </div>
                            {u.email && (
                              <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                            )}
                          </td>
                          <td className="p-3.5 border border-slate-200">
                            <select
                              aria-label={`Assign role for ${u.firstName} ${u.lastName}`}
                              value={u.displayRole}
                              onChange={(e) =>
                                handleAdminChangeRole(u, e.target.value as StaffAuthRole)
                              }
                              className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5"
                            >
                              <option value="Citizen">User (General Public)</option>
                              <option value="Forecast Officer">Forecast Officer</option>
                              <option value="Authority">Disaster Management</option>
                              <option value="Volunteer">Volunteer &amp; SOS</option>
                              <option value="Admin">Admin</option>
                            </select>
                          </td>
                          <td
                            className={`p-3.5 border border-slate-200 font-semibold ${
                              u.status === 'Active' ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {u.status}
                          </td>
                          <td className="p-3.5 border border-slate-200">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className="px-3 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded cursor-pointer"
                              >
                                {u.status === 'Active' ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="px-3 py-1.5 bg-[#e74c3c] hover:bg-red-700 text-white text-xs font-semibold rounded cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {sessionUser && (
                <EmailNotificationsPanel
                  sessionUser={sessionUser}
                  currentUser={currentUser}
                  shelters={shelters}
                  sosRequests={sosRequests}
                  initialSubTab="templates"
                  externalRefreshTrigger={emailRefreshTrigger}
                  showToast={showToast}
                />
              )}
            </main>
        ) : (
          renderRoleLockGate('Admin', 'admin@floodguard.gov.bd')
        ))}

      {/* TAB 8: ROLE-BASED LOGIN & REGISTRATION */}
      {activeTab === 'auth' && (
        <main
          className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-6 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(18, 60, 105, 0.85), rgba(15, 23, 42, 0.90)), url('/assets/aistudio/image_c4ee044f.png')`,
          }}
        >
          {/* Left: Unified Role-Based Login & Registration Form Card */}
          <div className="w-full max-w-md bg-white rounded-2xl p-7 shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h1 className="text-2xl font-bold text-[#123c69]">
                  {authMode === 'login' ? 'FloodGuard Login' : 'User Registration'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {authMode === 'login'
                    ? 'Select your assigned role to access your dashboard'
                    : 'Register a User (General Public) account'}
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setAuthErrorMessage(null);
                    setAuthMode('login');
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    authMode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthErrorMessage(null);
                    setAuthMode('register');
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                    authMode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {authErrorMessage && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold"
              >
                {authErrorMessage}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={(e) => handleLoginSubmit(e)} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="login-role-select"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Select Assigned Role
                  </label>
                  <div className="relative">
                    <select
                      id="login-role-select"
                      value={loginRole}
                      onChange={(e) => {
                        setLoginRole(e.target.value as StaffAuthRole);
                        setAuthErrorMessage(null);
                      }}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 border-2 border-[#123c69]/30 focus:border-[#159b83] rounded-lg text-sm font-semibold text-slate-800 bg-slate-50 focus:bg-white outline-none transition-colors cursor-pointer"
                    >
                      <option value="Citizen">User (General Public)</option>
                      <option value="Forecast Officer">Forecast Officer</option>
                      <option value="Authority">Disaster Management</option>
                      <option value="Volunteer">Volunteer &amp; SOS</option>
                      <option value="Admin">Admin</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Enter your account email"
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="01711000000"
                    className="w-full px-3.5 py-2.5 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#123c69] hover:bg-[#245786] text-white font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Sign In to Dashboard
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      placeholder="First name"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="Last name"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="register-role-select"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Account Role
                  </label>
                  <select
                    id="register-role-select"
                    value={regRole}
                    disabled
                    aria-readonly="true"
                    className="w-full px-3.5 py-2 border-2 border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 cursor-not-allowed outline-none"
                  >
                    <option value="Citizen">User (General Public)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Public registration is allowed for User (General Public) accounts only. Staff and Admin roles can only be created or assigned by an authorized administrator.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 border border-slate-300 focus:border-[#159b83] rounded-lg text-sm outline-none font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#159b83] hover:bg-[#087c68] text-white font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Create Account &amp; Open Dashboard
                </button>
              </form>
            )}

            {/* Optional Cloud Firestore Google Sync */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                <span>Cloud Firestore Sync:</span>
              </span>
              {currentUser ? (
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="text-xs font-semibold text-slate-700 hover:underline cursor-pointer"
                >
                  Connected ({currentUser.email}) · Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Connect Google Account
                </button>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
