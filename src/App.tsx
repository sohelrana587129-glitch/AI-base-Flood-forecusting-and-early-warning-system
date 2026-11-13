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
  KeyRound,
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
  SessionUser,
  SosAlertMessage,
  TelemetryPoint,
  TrainedFloodModel,
  ModelPrediction,
  ForecastItem,
  WarningItem,
  SosRequestItem,
  ShelterItem,
  ManagedUserItem,
} from './types';
import { WaterMonitorChart } from './components/WaterMonitorChart';
import { FloodRiskMap } from './components/FloodRiskMap';
import { TrainedModelPanel } from './components/TrainedModelPanel';
import {
  loginLocalAccount,
  registerLocalAccount,
  addLocalSosMessage,
  getStoredSosMessages,
  getLocalTelemetry,
  ingestLocalSensor,
  runLocalModelInference,
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
    requesterName: 'Samia',
    location: 'Dhaka',
    emergencyType: 'Flood Rescue',
    status: 'Pending',
  },
  {
    id: 'sos_sohel',
    ownerId: 'local',
    requesterName: 'Sohel',
    location: 'Sylhet',
    emergencyType: 'Emergency Help',
    status: 'Pending',
  },
  {
    id: 'sos_mim',
    ownerId: 'local',
    requesterName: 'Mim',
    location: 'Sunamganj',
    emergencyType: 'Food Support',
    status: 'Completed',
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

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('monitor');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Role-Based Session User & SOS Messages State (strictly requires Register & Login)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
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

  // Sub-navigation / filter states for each dashboard
  const [forecastSubSection, setForecastSubSection] = useState<string>('Dashboard');
  const [disasterSubSection, setDisasterSubSection] = useState<string>('Dashboard');
  const [volunteerSubSection, setVolunteerSubSection] = useState<string>('Dashboard');
  const [adminSubSection, setAdminSubSection] = useState<string>('Dashboard');

  // Shelter Finder State (matches shelter_a4908dff.html)
  const [selectedDistrict, setSelectedDistrict] = useState<string>('sylhet');
  const [selectedArea, setSelectedArea] = useState<string>('companiganj');

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

  // Login & Registration Form State (matches lg_3669f2ee.html & reg_d9814b67.html)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Citizen');
  const [regRolePasscode, setRegRolePasscode] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Check if current sessionUser has access to a given role-protected tab
  const hasRoleAccess = (requiredRole: 'Admin' | 'Forecast Officer' | 'Authority' | 'Volunteer') => {
    if (!sessionUser) return false;
    if (sessionUser.role === 'Admin') return true;
    return sessionUser.role === requiredRole;
  };

  // Fetch protected SOS messages ONLY when sessionUser is logged in & registered
  const fetchSosMessages = useCallback(async (email?: string) => {
    const activeEmail = email || sessionUser?.email;
    if (!activeEmail) {
      setSosMessages([]);
      return;
    }
    try {
      const res = await fetch('/api/v1/sos-messages', {
        headers: {
          'x-auth-email': activeEmail,
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setSosMessages(data.sosMessages || []);
      } else {
        setSosMessages(getStoredSosMessages());
      }
    } catch {
      setSosMessages(getStoredSosMessages());
    }
  }, [sessionUser?.email]);

  useEffect(() => {
    if (sessionUser?.email) {
      fetchSosMessages(sessionUser.email);
    } else {
      setSosMessages([]);
    }
  }, [sessionUser, fetchSosMessages]);

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

  // Ingest incoming sensor & satellite reading into backend + Firestore
  const handleIngestSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngesting(true);
    try {
      let latestTimeLabel = 'Now';
      try {
        const res = await fetch('/api/v1/ingest-sensor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationId,
            waterLevel: Number(newSensorLevel),
            rainfall: Number(newSensorRain),
            soilMoisture: Number(newSensorMoisture),
          }),
        });
        const contentType = res.headers.get('content-type') || '';
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

  // Volunteer SOS Request status update
  const handleUpdateSosStatus = async (
    item: SosRequestItem,
    newStatus: SosRequestItem['status']
  ) => {
    if (item.status === 'Completed') {
      showToast('Completed SOS requests are locked in terminal state.');
      return;
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
    } else {
      setSosRequests((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, status: newStatus } : s))
      );
    }
    showToast(`SOS request for ${item.requesterName} updated to ${newStatus}.`);
  };

  // Create new SOS Request & Broadcast SOS Message (requires login & registration)
  const handleCreateSos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) {
      showToast('You must Register and Login first to send or receive SOS messages.');
      setActiveTab('auth');
      return;
    }
    const senderNameVal = newSosName.trim() || `${sessionUser.firstName} ${sessionUser.lastName}`;
    const sosId = `sos_${Date.now()}`;
    const newSos: SosRequestItem = {
      id: sosId,
      ownerId: currentUser?.uid || 'local',
      requesterName: senderNameVal.slice(0, 100),
      location: newSosLocation.slice(0, 100),
      emergencyType: newSosType,
      status: 'Pending',
    };

    const sosPayload = {
      senderName: senderNameVal,
      senderPhone: newSosPhone.trim() || sessionUser.phone,
      location: newSosLocation,
      emergencyType: newSosType,
      message:
        newSosText.trim() ||
        `URGENT SOS (${newSosType}): Immediate assistance requested by ${senderNameVal} in ${newSosLocation}.`,
    };

    try {
      const res = await fetch('/api/v1/sos-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-email': sessionUser.email,
        },
        body: JSON.stringify(sosPayload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setSosMessages(data.sosMessages || []);
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
    } else {
      setSosRequests((prev) => [newSos, ...prev]);
    }
    setNewSosName('');
    setNewSosPhone('');
    setNewSosText('');
    showToast(`SOS message broadcasted and logged for ${newSos.requesterName}.`);
  };

  // Admin User Management actions
  const handleDeleteUser = async (userItem: ManagedUserItem) => {
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
    const nextStatus: 'Active' | 'Suspended' =
      userItem.status === 'Active' ? 'Suspended' : 'Active';
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

  // Secure Role Login Handler (supports both Express backend and Vercel static deployment)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMessage(null);

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
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          // Also check localStorage registered accounts in case user registered on client
          const localCheck = loginLocalAccount(loginEmail, loginPhone, loginPassword);
          if (localCheck.ok) {
            authResult = localCheck;
          } else {
            authResult = { ok: false, error: data.error || 'Invalid login credentials.' };
          }
        } else {
          authResult = {
            ok: true,
            sessionUser: data.sessionUser,
            sosMessages: data.sosMessages || [],
          };
        }
      } else {
        authResult = loginLocalAccount(loginEmail, loginPhone, loginPassword);
      }
    } catch {
      authResult = loginLocalAccount(loginEmail, loginPhone, loginPassword);
    }

    if (!authResult || !authResult.ok || !authResult.sessionUser) {
      setAuthErrorMessage(authResult?.error || 'Invalid login credentials.');
      return;
    }

    setSessionUser(authResult.sessionUser);
    setSosMessages(authResult.sosMessages || []);
    setLoginPassword('');
    showToast(
      `Authenticated as ${authResult.sessionUser.firstName} ${authResult.sessionUser.lastName} (${authResult.sessionUser.role}). Real-time SOS messages unlocked!`
    );

    if (authResult.sessionUser.role === 'Admin') setActiveTab('admin');
    else if (authResult.sessionUser.role === 'Forecast Officer') setActiveTab('forecast');
    else if (authResult.sessionUser.role === 'Volunteer') setActiveTab('volunteer');
    else if (authResult.sessionUser.role === 'Authority') setActiveTab('disaster');
    else setActiveTab('monitor');
  };

  // Registration Form Submission (supports both Express backend and Vercel static deployment, unlocks SOS messages, and syncs to Firestore if connected)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMessage(null);

    if (regPassword !== regConfirmPassword) {
      setAuthErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    const regPayload = {
      firstName: regFirstName,
      lastName: regLastName,
      email: regEmail,
      phone: regPhone,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      role: regRole,
      rolePasscode: regRolePasscode,
    };

    // Always register in local engine as well so client-side persistence is in sync
    const localReg = registerLocalAccount(regPayload);

    let regResult: {
      ok: boolean;
      error?: string;
      sessionUser?: SessionUser;
      sosMessages?: SosAlertMessage[];
    } = localReg;

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
      }
    } catch {
      // Use localReg fallback on Vercel static deployment
    }

    if (!regResult.ok || !regResult.sessionUser) {
      setAuthErrorMessage(regResult.error || 'Registration failed.');
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

    if (currentUser && regRole !== 'Admin') {
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
    setRegRolePasscode('');

    showToast(
      `Registered & logged in as ${regResult.sessionUser.firstName} (${regResult.sessionUser.role}). Real-time SOS messages are now active!`
    );
    setActiveTab('monitor');
  };

  // Reusable Role Lock Screen when an unauthorized user tries to open Admin, Forecast, Disaster, or Volunteer tabs
  const renderRoleLockGate = (
    requiredRoleName: 'Admin' | 'Forecast Officer' | 'Authority' | 'Volunteer',
    defaultEmail: string
  ) => (
    <main className="w-full max-w-lg mx-auto p-6 md:p-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-7 dashboard-card space-y-5">
        <div className="flex items-center gap-3 text-red-600">
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {requiredRoleName} Authorization Required
            </h2>
            <p className="text-xs text-slate-600">
              This panel is protected. Enter the authorized {requiredRoleName} password (or Admin credentials) to gain access.
            </p>
          </div>
        </div>

        {sessionUser && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            You are currently logged in as <strong>{sessionUser.firstName} ({sessionUser.role})</strong>, which does not have permission for the <strong>{requiredRoleName}</strong> panel.
          </div>
        )}

        {authErrorMessage && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {authErrorMessage}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Role Account Email
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
              Secure Role Password
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder={`Enter ${requiredRoleName} password`}
              required
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Verify Password &amp; Unlock {requiredRoleName}
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginEmail(defaultEmail);
                setAuthMode('login');
                setActiveTab('auth');
              }}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Full Login Page
            </button>
          </div>
        </form>
      </div>
    </main>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Top Bar Contract: Zone 1 (Wordmark) - Zone 2 (Single-line Tabs) - Zone 3 (Primary Auth CTA) */}
      <header className="bg-[#123c69] text-white border-b border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setActiveTab('monitor')}
          className="text-lg font-extrabold tracking-tight text-[#55d6be] whitespace-nowrap shrink-0 cursor-pointer"
        >
          FloodGuard AI
        </button>

        <nav className="flex items-center gap-5 overflow-x-auto text-xs md:text-sm font-medium">
          {[
            { id: 'monitor', label: 'Monitor Dashboard' },
            { id: 'map', label: 'Flood Risk Map' },
            { id: 'forecast', label: 'Forecast Officer' },
            { id: 'disaster', label: 'Disaster Mgmt' },
            { id: 'volunteer', label: 'Volunteer & SOS' },
            { id: 'shelter', label: 'Shelter Finder' },
            { id: 'admin', label: 'Admin Panel' },
            { id: 'auth', label: 'Login & Register' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setAuthErrorMessage(null);
                setActiveTab(tab.id as AppTab);
              }}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#55d6be] text-white font-bold'
                  : 'border-transparent text-slate-200 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {sessionUser ? (
            <button
              type="button"
              onClick={() => {
                setSessionUser(null);
                setSosMessages([]);
                showToast('Logged out of role session. SOS message stream locked.');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>
                {sessionUser.firstName} · {sessionUser.role} (Logout)
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#159b83] hover:bg-[#087c68] text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Role Login / Register</span>
            </button>
          )}
        </div>
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
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className="text-xs font-bold text-[#55d6be] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Login / Register Now →
          </button>
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
                  {sessionUser ? ` · Logged in as ${sessionUser.firstName} (${sessionUser.role})` : ' · Guest View (Login to unlock SOS messages)'}
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
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Satellite className="w-4 h-4 text-blue-600" />
                    <span>Process Incoming IoT Sensor &amp; Satellite SAR Telemetry</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Push new water-level, rainfall, and satellite soil moisture readings into the backend database &amp; AI prediction pipeline
                  </p>
                </div>
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
                    value={newSensorLevel}
                    onChange={(e) => setNewSensorLevel(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rainfall (30min mm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newSensorRain}
                    onChange={(e) => setNewSensorRain(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
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
                    value={newSensorMoisture}
                    onChange={(e) => setNewSensorMoisture(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{ingesting ? 'Processing...' : 'Ingest Sensor Data'}</span>
                </button>
              </form>
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
                    onClick={() => setActiveTab('forecast')}
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
                  Unlocked for {sessionUser.firstName} ({sessionUser.role})
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
                  onClick={() => setActiveTab('auth')}
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

      {/* TAB 3: FORECAST OFFICER DASHBOARD (Protected by Forecast Officer or Admin role) */}
      {activeTab === 'forecast' &&
        (hasRoleAccess('Forecast Officer') ? (
          <div className="flex flex-1 min-h-[calc(100vh-57px)]">
            <aside className="w-[230px] bg-[#123c69] text-white p-5 shrink-0 hidden md:block">
              <h2 className="text-xl font-bold text-[#55d6be]">FloodGuard</h2>
              <p className="text-xs text-slate-300 mt-1 mb-5">Forecast Officer</p>
              <ul className="space-y-1 text-sm">
                {[
                  'Dashboard',
                  'Environmental Data',
                  'AI Predictions',
                  'Upload Trained Model',
                  'Validate Forecasts',
                  'Publish Forecasts',
                ].map((item) => (
                  <li
                    key={item}
                    onClick={() => setForecastSubSection(item)}
                    className={`py-3 px-2.5 border-b border-[#456789] cursor-pointer rounded-xs transition-colors ${
                      forecastSubSection === item ? 'bg-[#245786] font-bold' : 'hover:bg-[#245786]'
                    }`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </aside>

            <main className="flex-1 p-6 space-y-6 max-w-[1180px]">
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
                      onClick={() => setActiveTab('monitor')}
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
                      onClick={() => setForecastSubSection('Validate Forecasts')}
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

              <section>
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
          </div>
        ) : (
          renderRoleLockGate('Forecast Officer', 'forecast@floodguard.gov.bd')
        ))}

      {/* TAB 4: DISASTER MANAGEMENT DASHBOARD (Protected by Authority or Admin role) */}
      {activeTab === 'disaster' &&
        (hasRoleAccess('Authority') ? (
          <div className="flex flex-1 min-h-[calc(100vh-57px)]">
            <aside className="w-[230px] bg-[#123c69] text-white p-5 shrink-0 hidden md:block">
              <h2 className="text-xl font-bold text-[#55d6be]">FloodGuard</h2>
              <p className="text-xs text-slate-300 mt-1 mb-5">Disaster Management</p>
              <ul className="space-y-1 text-sm">
                {[
                  'Dashboard',
                  'Review Warnings',
                  'Publish Warnings',
                  'Update Warnings',
                  'Emergency Monitoring',
                  'Disaster Response',
                ].map((item) => (
                  <li
                    key={item}
                    onClick={() => setDisasterSubSection(item)}
                    className={`py-3 px-2.5 border-b border-[#456789] cursor-pointer rounded-xs transition-colors ${
                      disasterSubSection === item ? 'bg-[#245786] font-bold' : 'hover:bg-[#245786]'
                    }`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </aside>

            <main className="flex-1 p-6 space-y-6 max-w-[1180px]">
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
                      onClick={() => setDisasterSubSection('Review Warnings')}
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
                      onClick={() => setDisasterSubSection('Publish Warnings')}
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
                      onClick={() => setActiveTab('map')}
                      className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                    >
                      Monitor
                    </button>
                  </div>
                </div>
              </section>

              <section>
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
            </main>
          </div>
        ) : (
          renderRoleLockGate('Authority', 'disaster@floodguard.gov.bd')
        ))}

      {/* TAB 5: VOLUNTEER & SOS DASHBOARD (Strictly requires Login & Registration; Volunteer/Admin or Registered Citizen for SOS) */}
      {activeTab === 'volunteer' &&
        (sessionUser && (hasRoleAccess('Volunteer') || sessionUser.role === 'Citizen') ? (
          <div className="flex flex-1 min-h-[calc(100vh-57px)]">
            <aside className="w-[230px] bg-[#123c69] text-white p-5 shrink-0 hidden md:block">
              <h2 className="text-xl font-bold text-[#55d6be]">FloodGuard</h2>
              <p className="text-xs text-slate-300 mt-1 mb-5">Volunteer &amp; SOS Panel</p>
              <ul className="space-y-1 text-sm">
                {[
                  'Dashboard',
                  'SOS Requests',
                  'Rescue Coordination',
                  'Shelter Information',
                  'Emergency Status',
                ].map((item) => (
                  <li
                    key={item}
                    onClick={() => setVolunteerSubSection(item)}
                    className={`py-3 px-2.5 border-b border-[#456789] cursor-pointer rounded-xs transition-colors ${
                      volunteerSubSection === item ? 'bg-[#245786] font-bold' : 'hover:bg-[#245786]'
                    }`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </aside>

            <main className="flex-1 p-6 space-y-6 max-w-[1180px]">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h1 className="text-2xl font-bold text-[#123c69]">Volunteer &amp; SOS Dashboard</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Authenticated User: {sessionUser.firstName} {sessionUser.lastName} ({sessionUser.role}) · Live SOS Stream Active
                </p>
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
                      {shelters.length}
                    </div>
                    <p className="text-xs text-slate-600">Available emergency shelters</p>
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
                        <th className="p-3.5 border border-slate-200">Name</th>
                        <th className="p-3.5 border border-slate-200">Location</th>
                        <th className="p-3.5 border border-slate-200">Emergency</th>
                        <th className="p-3.5 border border-slate-200">Status</th>
                        <th className="p-3.5 border border-slate-200">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sosRequests.map((sos) => (
                        <tr key={sos.id} className="hover:bg-slate-50">
                          <td className="p-3.5 border border-slate-200 font-semibold">
                            {sos.requesterName}
                          </td>
                          <td className="p-3.5 border border-slate-200">{sos.location}</td>
                          <td
                            className={`p-3.5 border border-slate-200 font-bold ${
                              sos.emergencyType === 'Flood Rescue' ||
                              sos.emergencyType === 'Emergency Help'
                                ? 'text-red-600'
                                : 'text-slate-800'
                            }`}
                          >
                            {sos.emergencyType}
                          </td>
                          <td className="p-3.5 border border-slate-200 font-medium">{sos.status}</td>
                          <td className="p-3.5 border border-slate-200">
                            {hasRoleAccess('Volunteer') ? (
                              <>
                                {sos.status === 'Pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSosStatus(sos, 'In Progress')}
                                    className="px-3 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded cursor-pointer mr-2"
                                  >
                                    Accept
                                  </button>
                                )}
                                {sos.status !== 'Completed' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSosStatus(sos, 'Completed')}
                                    className="px-3 py-1.5 bg-[#3498db] hover:bg-blue-600 text-white text-xs font-semibold rounded cursor-pointer"
                                  >
                                    Mark Done
                                  </button>
                                ) : (
                                  <span className="px-3 py-1.5 bg-[#3498db] text-white text-xs font-semibold rounded inline-block">
                                    Done
                                  </span>
                                )}
                              </>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="text-base font-bold text-[#123c69]">Rescue Activities</h3>
                  <p className="text-xs text-slate-600">
                    Coordinate rescue boats and relief kits in affected low-lying wards.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('map')}
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
            </main>
          </div>
        ) : (
          renderRoleLockGate('Volunteer', 'volunteer@floodguard.gov.bd')
        ))}

      {/* TAB 6: FLOOD SHELTER FINDER (shelter_a4908dff.html) */}
      {activeTab === 'shelter' && (
        <main className="w-full max-w-[1100px] mx-auto p-6 md:p-8 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 dashboard-card">
            <h1 className="text-2xl font-bold text-[#0d6efd] flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              <span>Flood Shelter Finder</span>
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Select your district and upazila/area to locate verified high-elevation flood shelters and live capacity.
            </p>

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
                  </div>
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

                  <button
                    type="button"
                    onClick={async () => {
                      const nextOcc = Math.min(sh.capacity, sh.occupancy + 10);
                      const nextStatus: ShelterItem['status'] =
                        nextOcc >= sh.capacity
                          ? 'Full'
                          : nextOcc >= sh.capacity * 0.85
                          ? 'Near Capacity'
                          : 'Available';
                      if (currentUser && sh.ownerId === currentUser.uid) {
                        try {
                          await updateDoc(doc(db, 'shelters', sh.id), {
                            occupancy: nextOcc,
                            status: nextStatus,
                            updatedAt: serverTimestamp(),
                          });
                        } catch (err) {
                          handleFirestoreError(err, OperationType.UPDATE, `shelters/${sh.id}`);
                        }
                      } else {
                        setShelters((prev) =>
                          prev.map((item) =>
                            item.id === sh.id
                              ? { ...item, occupancy: nextOcc, status: nextStatus }
                              : item
                          )
                        );
                      }
                      showToast(`Checked in +10 evacuees at ${sh.name}.`);
                    }}
                    className="w-full py-2 bg-[#0d6efd] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Check-In Evacuees (+10)
                  </button>
                </div>
              ))}
          </div>
        </main>
      )}

      {/* TAB 7: ADMIN DASHBOARD (Strictly Protected by Admin Password) */}
      {activeTab === 'admin' &&
        (hasRoleAccess('Admin') ? (
          <div className="flex flex-1 min-h-[calc(100vh-57px)]">
            <aside className="w-[230px] bg-[#123c69] text-white p-5 shrink-0 hidden md:block">
              <h2 className="text-xl font-bold text-[#55d6be]">FloodGuard</h2>
              <p className="text-xs text-slate-300 mt-1 mb-5">Admin Panel</p>
              <ul className="space-y-1 text-sm">
                {[
                  'Dashboard',
                  'Manage Users',
                  'Manage Roles',
                  'Environmental Data',
                  'System Monitoring',
                  'Reports',
                  'System Settings',
                ].map((item) => (
                  <li
                    key={item}
                    onClick={() => setAdminSubSection(item)}
                    className={`py-3 px-2.5 border-b border-[#456789] cursor-pointer rounded-xs transition-colors ${
                      adminSubSection === item ? 'bg-[#245786] font-bold' : 'hover:bg-[#245786]'
                    }`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </aside>

            <main className="flex-1 p-6 space-y-6 max-w-[1180px]">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h1 className="text-2xl font-bold text-[#123c69]">Admin Dashboard</h1>
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

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-900">User Management</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setActiveTab('auth');
                    }}
                    className="px-3.5 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-md cursor-pointer"
                  >
                    + Register New User
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-[#123c69] text-white">
                        <th className="p-3.5 border border-slate-200">User Name</th>
                        <th className="p-3.5 border border-slate-200">Role</th>
                        <th className="p-3.5 border border-slate-200">Status</th>
                        <th className="p-3.5 border border-slate-200">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="p-3.5 border border-slate-200 font-semibold">
                            {u.firstName} {u.lastName}
                          </td>
                          <td className="p-3.5 border border-slate-200">{u.displayRole}</td>
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
            </main>
          </div>
        ) : (
          renderRoleLockGate('Admin', 'admin@floodguard.gov.bd')
        ))}

      {/* TAB 8: LOGIN & REGISTRATION (lg_3669f2ee.html & reg_d9814b67.html + Role Credentials) */}
      {activeTab === 'auth' && (
        <main
          className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-6 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(18, 60, 105, 0.85), rgba(15, 23, 42, 0.90)), url('/assets/aistudio/image_c4ee044f.png')`,
          }}
        >
          {/* Left: Login & Registration Form Card */}
          <div className="w-full max-w-md bg-white rounded-2xl p-7 shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h1 className="text-2xl font-bold text-[#123c69]">
                {authMode === 'login' ? 'FloodGuard Login' : 'User Registration'}
              </h1>
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
                  Registration
                </button>
              </div>
            </div>

            {authErrorMessage && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                {authErrorMessage}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Enter your Email"
                    required
                    className="w-full px-3.5 py-2.5 border-2 border-[#3498db] focus:border-[#2ecc71] rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="Enter your phone"
                    required
                    className="w-full px-3.5 py-2.5 border-2 border-[#3498db] focus:border-[#2ecc71] rounded-lg text-sm outline-none font-mono"
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
                    className="w-full px-3.5 py-2.5 border-2 border-[#3498db] focus:border-[#2ecc71] rounded-lg text-sm outline-none font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#3498db] hover:bg-blue-600 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Login &amp; Unlock SOS Messages
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      First name:
                    </label>
                    <input
                      type="text"
                      placeholder="First name"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border-2 border-[#3498db] rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Last Name:
                    </label>
                    <input
                      type="text"
                      placeholder="Last name"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border-2 border-[#3498db] rounded-lg text-sm outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Enter your Email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border-2 border-[#3498db] rounded-lg text-sm outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone:</label>
                    <input
                      type="text"
                      placeholder="Enter your phone"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      required
                      className="w-full px-3 py-2 border-2 border-[#3498db] rounded-lg text-sm outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Role:</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 border-2 border-[#3498db] rounded-lg text-sm outline-none bg-white"
                    >
                      <option value="Citizen">Citizen</option>
                      <option value="Volunteer">Volunteer</option>
                      <option value="Forecast Officer">Forecast Officer</option>
                      <option value="Authority">Authority (Disaster Mgmt)</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Set password:
                    </label>
                    <input
                      type="password"
                      placeholder="Set password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border-2 border-[#3498db] rounded-lg text-sm outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirm password:
                    </label>
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border-2 border-[#3498db] rounded-lg text-sm outline-none font-mono"
                    />
                  </div>
                </div>

                {regRole !== 'Citizen' && (
                  <div>
                    <label className="block text-xs font-bold text-amber-800 mb-1">
                      {regRole} Authorization Password (Required for Staff Roles):
                    </label>
                    <input
                      type="password"
                      placeholder={`Enter ${regRole} security key`}
                      value={regRolePasscode}
                      onChange={(e) => setRegRolePasscode(e.target.value)}
                      required
                      className="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-sm outline-none font-mono"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#3498db] hover:bg-blue-600 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Submit Registration &amp; Receive SOS Alerts
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

          {/* Right: Official Role Credentials Reference Card */}
          <div className="w-full max-w-md bg-slate-900/95 text-white rounded-2xl p-6 border border-slate-700 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-700 pb-3">
              <KeyRound className="w-5 h-5 text-[#55d6be]" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Authorized Role Login Credentials
                </h2>
                <p className="text-xs text-slate-300">
                  Click any role below to auto-fill login credentials, or enter them manually
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                {
                  role: 'Admin',
                  email: 'admin@floodguard.gov.bd',
                  phone: '01711000001',
                  password: 'FG-Admin#2026!',
                  desc: 'Full access to Admin Panel, User Management, and all dashboards',
                },
                {
                  role: 'Forecast Officer',
                  email: 'forecast@floodguard.gov.bd',
                  phone: '01711000222',
                  password: 'FG-Forecast#2026!',
                  desc: 'Access to Forecast Officer Dashboard, Trained Model Upload & Validation',
                },
                {
                  role: 'Volunteer',
                  email: 'volunteer@floodguard.gov.bd',
                  phone: '01711000444',
                  password: 'FG-Volunteer#2026!',
                  desc: 'Access to Volunteer Panel, SOS Rescue Dispatch & Live SOS Messages',
                },
                {
                  role: 'Authority (Disaster Mgmt)',
                  email: 'disaster@floodguard.gov.bd',
                  phone: '01711000333',
                  password: 'FG-Disaster#2026!',
                  desc: 'Access to Disaster Management Warning Control Center',
                },
              ].map((cred) => (
                <div
                  key={cred.role}
                  className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#55d6be]">{cred.role}</div>
                    <div className="font-mono text-slate-200">Email: {cred.email}</div>
                    <div className="font-mono text-amber-300">Password: {cred.password}</div>
                    <div className="text-[11px] text-slate-400">{cred.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setLoginEmail(cred.email);
                      setLoginPhone(cred.phone);
                      setLoginPassword(cred.password);
                      setAuthErrorMessage(null);
                    }}
                    className="px-3 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Fill Login
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
