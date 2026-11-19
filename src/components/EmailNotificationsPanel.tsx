import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Lock,
  Mail,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  Sliders,
  Trash2,
  XCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  EmailDeliveryStatus,
  EmailLogItem,
  EmailMetricsSummary,
  EmailPriority,
  EmailSystemSettingsInfo,
  EmailTemplateCategory,
  EmailTemplateItem,
  EmailType,
  SessionUser,
  ShelterItem,
  SosRequestItem,
  UserEmailPreferences,
} from '../types';

type SubTabKey = 'compose' | 'broadcast' | 'history' | 'templates' | 'settings';

interface BroadcastPreviewStats {
  district: string;
  totalCitizens: number;
  verifiedCitizens: number;
  optedInVerifiedCitizens: number;
  skippedOptOutCount: number;
}

interface EmailNotificationsPanelProps {
  sessionUser: SessionUser;
  currentUser: FirebaseUser | null;
  shelters: ShelterItem[];
  sosRequests: SosRequestItem[];
  initialSubTab?: SubTabKey;
  externalRefreshTrigger?: number;
  showToast: (msg: string) => void;
}

function sanitizeDocId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

export async function syncEmailLogsToFirestore(
  logs: EmailLogItem[],
  currentUser: FirebaseUser | null
): Promise<void> {
  if (!currentUser || !currentUser.emailVerified || logs.length === 0) return;
  for (const log of logs) {
    const docId = sanitizeDocId(log.id);
    try {
      await setDoc(doc(db, 'email_logs', docId), {
        ownerId: currentUser.uid,
        recipientEmail: String(log.recipientEmail || 'unknown@example.com').slice(0, 160),
        recipientName: String(log.recipientName || 'Recipient').slice(0, 120),
        recipientRole: log.recipientRole || 'External',
        subject: String(log.subject || 'FloodGuard Notification').slice(0, 200),
        message: String(log.message || 'Notification dispatched.').slice(0, 2000),
        emailType: log.emailType || 'Operational',
        priority: log.priority || 'Normal',
        status: log.status || 'failed',
        provider: log.provider || 'unconfigured',
        providerMessageId: String(log.providerMessageId || '').slice(0, 160),
        errorMessage: String(log.errorMessage || '').slice(0, 500),
        retryCount: Number(log.retryCount || 0),
        district: String(log.district || 'All').slice(0, 60),
        relatedSosId: String(log.relatedSosId || '').slice(0, 128),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `email_logs/${docId}`);
    }
  }
}

export const EmailNotificationsPanel: React.FC<EmailNotificationsPanelProps> = ({
  sessionUser,
  currentUser,
  shelters,
  sosRequests,
  initialSubTab = 'history',
  externalRefreshTrigger = 0,
  showToast,
}) => {
  const canBroadcast = sessionUser.role === 'Authority' || sessionUser.role === 'Admin';
  const isAdmin = sessionUser.role === 'Admin';
  const isStaff =
    sessionUser.role === 'Volunteer' ||
    sessionUser.role === 'Authority' ||
    sessionUser.role === 'Admin';

  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>(initialSubTab);

  // Metrics & History State
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);
  const [metrics, setMetrics] = useState<EmailMetricsSummary>({
    total: 0,
    delivered: 0,
    pending: 0,
    failed: 0,
    queued: 0,
    sent: 0,
    bounced: 0,
  });
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | EmailDeliveryStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | EmailType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Templates & Settings State
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [systemSettings, setSystemSettings] = useState<EmailSystemSettingsInfo | null>(null);
  const [preferences, setPreferences] = useState<UserEmailPreferences | null>(null);

  // Compose Email Form State
  const [composeRecipientEmail, setComposeRecipientEmail] = useState('');
  const [composeRecipientName, setComposeRecipientName] = useState('');
  const [composeEmailType, setComposeEmailType] = useState<EmailType>('Operational');
  const [composePriority, setComposePriority] = useState<EmailPriority>('Normal');
  const [composeDistrict, setComposeDistrict] = useState('sylhet');
  const [composeRelatedSosId, setComposeRelatedSosId] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [sendingCompose, setSendingCompose] = useState(false);
  const [composeFeedback, setComposeFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Emergency Broadcast State
  const [broadcastDistrict, setBroadcastDistrict] = useState('all');
  const [broadcastCategory, setBroadcastCategory] = useState<
    'Flood Warning' | 'Evacuation Order' | 'Shelter Info'
  >('Flood Warning');
  const [broadcastPriority, setBroadcastPriority] = useState<EmailPriority>('Critical');
  const [broadcastIncludeShelters, setBroadcastIncludeShelters] = useState(true);
  const [broadcastSubject, setBroadcastSubject] = useState(
    '[FLOOD WARNING] Rising River Levels in {{district}}'
  );
  const [broadcastMessage, setBroadcastMessage] = useState(
    'Urgent flood advisory for residents of {{district}}. Water levels are approaching alert thresholds. Prepare emergency kits, secure important documents, and move to elevated emergency shelters immediately if water rises near your street.\n\nOpen Shelters:\n{{shelterList}}'
  );
  const [broadcastPreview, setBroadcastPreview] = useState<BroadcastPreviewStats | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Admin Template Create Form State
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState<EmailTemplateCategory>('Flood Warning');
  const [newTplSubject, setNewTplSubject] = useState('');
  const [newTplBody, setNewTplBody] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  // Admin System Settings Draft State
  const [draftRateLimit, setDraftRateLimit] = useState('60');
  const [draftMaxRetries, setDraftMaxRetries] = useState('2');
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionUser.token) {
      h.Authorization = `Bearer ${sessionUser.token}`;
    }
    return h;
  }, [sessionUser.token]);

  const fetchEmailLogs = useCallback(async () => {
    if (!sessionUser.token) return;
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('emailType', typeFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/v1/emails?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.emails)) setEmailLogs(data.emails);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch {
      // keep existing state on transient error
    } finally {
      setLoadingLogs(false);
    }
  }, [sessionUser.token, statusFilter, typeFilter, searchQuery]);

  const fetchTemplatesAndSettings = useCallback(async () => {
    if (!sessionUser.token || !isStaff) return;
    try {
      const [tplRes, setRes, prefRes] = await Promise.all([
        fetch('/api/v1/email-templates', {
          headers: { Authorization: `Bearer ${sessionUser.token}` },
        }),
        fetch('/api/v1/email-settings', {
          headers: { Authorization: `Bearer ${sessionUser.token}` },
        }),
        fetch('/api/v1/email-preferences', {
          headers: { Authorization: `Bearer ${sessionUser.token}` },
        }),
      ]);

      if (tplRes.ok) {
        const tplData = await tplRes.json();
        if (Array.isArray(tplData.templates)) setTemplates(tplData.templates);
      }
      if (setRes.ok) {
        const setData = await setRes.json();
        setSystemSettings(setData);
        setDraftRateLimit(String(setData.rateLimitPerMinute ?? 60));
        setDraftMaxRetries(String(setData.maxRetries ?? 2));
      }
      if (prefRes.ok) {
        const prefData = await prefRes.json();
        setPreferences(prefData);
      }
    } catch {
      // ignore transient fetch errors
    }
  }, [sessionUser.token, isStaff]);

  const fetchBroadcastPreview = useCallback(async () => {
    if (!sessionUser.token || !canBroadcast) return;
    try {
      const res = await fetch(
        `/api/v1/emails/broadcast-preview?district=${encodeURIComponent(broadcastDistrict)}`,
        { headers: { Authorization: `Bearer ${sessionUser.token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setBroadcastPreview(data);
      }
    } catch {
      // ignore preview error
    }
  }, [sessionUser.token, canBroadcast, broadcastDistrict]);

  useEffect(() => {
    fetchEmailLogs();
  }, [fetchEmailLogs, externalRefreshTrigger]);

  useEffect(() => {
    fetchTemplatesAndSettings();
  }, [fetchTemplatesAndSettings]);

  useEffect(() => {
    fetchBroadcastPreview();
  }, [fetchBroadcastPreview]);

  // Firestore real-time subscription for owner's synced logs when signed in with Firebase Auth
  useEffect(() => {
    if (!currentUser || !currentUser.emailVerified) return;
    const unsubLogs = onSnapshot(
      query(collection(db, 'email_logs'), where('ownerId', '==', currentUser.uid)),
      () => {
        // Firestore persistence active alongside live Express backend log state
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'email_logs')
    );
    return () => unsubLogs();
  }, [currentUser]);

  const handleLoadSosIntoCompose = (sosId: string) => {
    setComposeRelatedSosId(sosId);
    const matched = sosRequests.find((s) => s.id === sosId);
    if (!matched) return;
    if (matched.requesterEmail) setComposeRecipientEmail(matched.requesterEmail);
    setComposeRecipientName(matched.requesterName);
    setComposeEmailType('SOS Status Update');
    setComposePriority(matched.isCritical ? 'Critical' : 'Normal');
    const locLower = matched.location.toLowerCase();
    if (locLower.includes('dhaka')) setComposeDistrict('dhaka');
    else if (locLower.includes('sunamganj')) setComposeDistrict('sunamganj');
    else if (locLower.includes('dinajpur')) setComposeDistrict('dinajpur');
    else setComposeDistrict('sylhet');

    setComposeSubject(
      `[FloodGuard SOS Update] ${matched.emergencyType} — ${matched.location} (${matched.status})`
    );
    setComposeMessage(
      `Dear ${matched.requesterName},\n\nUpdate regarding your ${matched.emergencyType} request at ${matched.location} (Current Status: ${matched.status}).\nOur team (${sessionUser.firstName} ${sessionUser.lastName}, Tel: ${sessionUser.phone}) is coordinating response support.\n\nPlease stay in a safe elevated area and keep your phone reachable.`
    );
  };

  const handleApplyTemplateToCompose = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    const openSheltersText = shelters
      .filter((s) => s.status !== 'Full')
      .slice(0, 4)
      .map((s) => `- ${s.name} (${s.area}): ${Math.max(0, s.capacity - s.occupancy)} free spots`)
      .join('\n');

    setComposeSubject(
      tpl.subject.replace(/\{\{district\}\}/gi, composeDistrict.toUpperCase())
    );
    setComposeMessage(
      tpl.body
        .replace(/\{\{district\}\}/gi, composeDistrict.toUpperCase())
        .replace(/\{\{shelterList\}\}/gi, openSheltersText || 'Contact local command center')
    );
    if (tpl.category === 'SOS Alert') setComposeEmailType('SOS Alert');
    else if (tpl.category === 'SOS Status Update') setComposeEmailType('SOS Status Update');
    else setComposeEmailType('Operational');
    showToast(`Loaded template "${tpl.name}" into Compose Email.`);
  };

  const handleApplyTemplateToBroadcast = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    if (
      tpl.category === 'Flood Warning' ||
      tpl.category === 'Evacuation Order' ||
      tpl.category === 'Shelter Info'
    ) {
      setBroadcastCategory(tpl.category);
    }
    setBroadcastSubject(tpl.subject);
    setBroadcastMessage(tpl.body);
    showToast(`Loaded template "${tpl.name}" into Emergency Broadcast.`);
  };

  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeFeedback(null);
    setSendingCompose(true);
    try {
      const res = await fetch('/api/v1/emails/send', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          recipientEmail: composeRecipientEmail.trim(),
          recipientName: composeRecipientName.trim(),
          subject: composeSubject.trim(),
          message: composeMessage.trim(),
          emailType: composeEmailType,
          priority: composePriority,
          district: composeDistrict,
          relatedSosId: composeRelatedSosId,
        }),
      });
      const data = await res.json();
      if (data.log) {
        await syncEmailLogsToFirestore([data.log as EmailLogItem], currentUser);
      }
      await fetchEmailLogs();

      if (res.ok && data.success) {
        setComposeFeedback({
          type: 'success',
          text: `Email dispatched to ${data.log?.recipientEmail} (Status: ${data.log?.status?.toUpperCase()} via ${data.log?.provider}).`,
        });
        showToast(`Email sent to ${composeRecipientEmail.trim()} (status: ${data.log?.status}).`);
        setComposeSubject('');
        setComposeMessage('');
        setComposeRecipientEmail('');
        setComposeRecipientName('');
        setComposeRelatedSosId('');
      } else {
        const errText = data.error || 'Email delivery failed.';
        setComposeFeedback({ type: 'error', text: errText });
        showToast(errText);
      }
    } catch {
      setComposeFeedback({
        type: 'error',
        text: 'Network error communicating with backend email service.',
      });
    } finally {
      setSendingCompose(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBroadcast) {
      showToast('Forbidden: Only Disaster Management or Admin roles can send Emergency Broadcasts.');
      return;
    }
    setBroadcastFeedback(null);
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/v1/emails/broadcast', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          district: broadcastDistrict,
          category: broadcastCategory,
          subject: broadcastSubject.trim(),
          message: broadcastMessage.trim(),
          includeShelters: broadcastIncludeShelters,
          priority: broadcastPriority,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        await syncEmailLogsToFirestore(data.logs as EmailLogItem[], currentUser);
      }
      await fetchEmailLogs();
      await fetchBroadcastPreview();

      if (!res.ok) {
        const errMsg = data.error || 'Emergency broadcast failed.';
        setBroadcastFeedback({ type: 'error', text: errMsg });
        showToast(errMsg);
      } else if (data.sentCount > 0) {
        const msg = `Broadcast dispatched to ${data.sentCount} verified citizen(s)${
          data.failedCount > 0 ? `, ${data.failedCount} failed` : ''
        }${data.skippedOptOutCount > 0 ? `, ${data.skippedOptOutCount} opted out` : ''}.`;
        setBroadcastFeedback({ type: 'success', text: msg });
        showToast(msg);
      } else {
        const firstErr = data.logs?.[0]?.errorMessage || 'Provider failed to accept emails.';
        const msg = `Broadcast logged ${data.failedCount} failed attempt(s) out of ${data.targetedCount} targeted citizen(s): ${firstErr}`;
        setBroadcastFeedback({ type: 'error', text: msg });
        showToast(msg);
      }
    } catch {
      setBroadcastFeedback({
        type: 'error',
        text: 'Network error while dispatching emergency broadcast.',
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleRetryEmail = async (logItem: EmailLogItem) => {
    setRetryingId(logItem.id);
    try {
      const res = await fetch(`/api/v1/emails/${encodeURIComponent(logItem.id)}/retry`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.log && currentUser && currentUser.emailVerified) {
        const docId = sanitizeDocId(logItem.id);
        try {
          await updateDoc(doc(db, 'email_logs', docId), {
            status: data.log.status,
            providerMessageId: String(data.log.providerMessageId || '').slice(0, 160),
            errorMessage: String(data.log.errorMessage || '').slice(0, 500),
            retryCount: Number(data.log.retryCount || 0),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // ignore if log was only in server memory
        }
      }
      await fetchEmailLogs();
      if (res.ok && data.success) {
        showToast(`Retry succeeded for ${logItem.recipientEmail} (status: ${data.log?.status}).`);
      } else {
        showToast(data.error || `Retry failed for ${logItem.recipientEmail}.`);
      }
    } finally {
      setRetryingId(null);
    }
  };

  const handleSyncEmailStatus = async (logItem: EmailLogItem) => {
    setSyncingId(logItem.id);
    try {
      const res = await fetch(`/api/v1/emails/${encodeURIComponent(logItem.id)}/sync`, {
        headers: { Authorization: `Bearer ${sessionUser.token || ''}` },
      });
      const data = await res.json();
      await fetchEmailLogs();
      if (res.ok && data.success) {
        showToast(`Synced status for ${logItem.recipientEmail}: ${data.log?.status}.`);
      } else {
        showToast(data.error || 'Could not sync status from provider.');
      }
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingTpl(true);
    try {
      const res = await fetch('/api/v1/email-templates', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: newTplName.trim(),
          category: newTplCategory,
          subject: newTplSubject.trim(),
          body: newTplBody.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.templates)) {
        setTemplates(data.templates);
        if (currentUser && currentUser.emailVerified && data.template) {
          const tplId = sanitizeDocId(data.template.id);
          try {
            await setDoc(doc(db, 'email_templates', tplId), {
              ownerId: currentUser.uid,
              name: data.template.name,
              category: data.template.category,
              subject: data.template.subject,
              body: data.template.body,
              isActive: Boolean(data.template.isActive),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `email_templates/${tplId}`);
          }
        }
        setNewTplName('');
        setNewTplSubject('');
        setNewTplBody('');
        showToast('Created new emergency email template.');
      } else {
        showToast(data.error || 'Failed to create email template.');
      }
    } finally {
      setSavingTpl(false);
    }
  };

  const handleToggleTemplate = async (tpl: EmailTemplateItem) => {
    if (!isAdmin) return;
    const res = await fetch(`/api/v1/email-templates/${encodeURIComponent(tpl.id)}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ isActive: !tpl.isActive }),
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data.templates)) {
      setTemplates(data.templates);
      showToast(`Template "${tpl.name}" marked ${!tpl.isActive ? 'Active' : 'Inactive'}.`);
    } else {
      showToast(data.error || 'Failed to update template.');
    }
  };

  const handleDeleteTemplate = async (tpl: EmailTemplateItem) => {
    if (!isAdmin) return;
    const res = await fetch(`/api/v1/email-templates/${encodeURIComponent(tpl.id)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data.templates)) {
      setTemplates(data.templates);
      showToast(`Deleted template "${tpl.name}".`);
    } else {
      showToast(data.error || 'Failed to delete template.');
    }
  };

  const handleSavePreferences = async (next: UserEmailPreferences) => {
    setSavingPrefs(true);
    try {
      const res = await fetch('/api/v1/email-preferences', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          district: next.district,
          sosAlertsEnabled: next.sosAlertsEnabled,
          statusUpdatesEnabled: next.statusUpdatesEnabled,
          broadcastsEnabled: next.broadcastsEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preferences) {
        setPreferences(data.preferences);
        if (currentUser && currentUser.emailVerified) {
          const prefId = sanitizeDocId(`pref_${currentUser.uid}`);
          try {
            await setDoc(doc(db, 'email_settings', prefId), {
              ownerId: currentUser.uid,
              settingType: 'user_preference',
              userEmail: String(data.preferences.email).slice(0, 160),
              district: String(data.preferences.district).slice(0, 60),
              sosAlertsEnabled: Boolean(data.preferences.sosAlertsEnabled),
              statusUpdatesEnabled: Boolean(data.preferences.statusUpdatesEnabled),
              broadcastsEnabled: Boolean(data.preferences.broadcastsEnabled),
              rateLimitPerMinute: 60,
              maxRetries: 2,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // ignore if updating existing doc requires updateDoc; backend holds source of truth
          }
        }
        showToast('Saved your email notification preferences.');
      } else {
        showToast(data.error || 'Could not update email preferences.');
      }
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/v1/email-settings', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          rateLimitPerMinute: Number(draftRateLimit),
          maxRetries: Number(draftMaxRetries),
        }),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSystemSettings(data.settings);
        showToast('Updated Admin email rate limit and retry policy.');
      } else {
        showToast(data.error || 'Failed to update system email settings.');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const statusTextClass = (status: EmailDeliveryStatus) => {
    if (status === 'delivered') return 'text-emerald-700 font-bold';
    if (status === 'sent') return 'text-blue-700 font-bold';
    if (status === 'queued') return 'text-amber-700 font-bold';
    if (status === 'bounced') return 'text-orange-700 font-bold';
    return 'text-red-700 font-bold';
  };

  return (
    <section
      id="volunteer-email-notifications"
      className="bg-white p-5 rounded-xl border border-slate-200 space-y-5"
    >
      {/* Header & Honest Provider Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-[#123c69] flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#159b83]" />
            <span>Email &amp; Emergency Notifications</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic SOS alerts, citizen status updates, disaster broadcasts, and verified provider delivery tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium">
            Provider:{' '}
            <strong className="uppercase text-[#123c69]">
              {systemSettings?.activeProvider || 'checking...'}
            </strong>
            {' · '}
            {systemSettings?.providerConfigured ? (
              <span className="text-emerald-700 font-semibold">API Key Active</span>
            ) : (
              <span className="text-amber-700 font-semibold">
                Key Not Configured (Honest Failure Mode)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              fetchEmailLogs();
              fetchTemplatesAndSettings();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* Honest Provider Configuration Notice when API keys are unset */}
      {systemSettings && !systemSettings.providerConfigured && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">
              Transactional Email Provider Key Required for Live Outbound Delivery
            </div>
            <p className="text-amber-800">
              Set <code className="font-mono bg-amber-100 px-1 rounded">RESEND_API_KEY</code> or{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">SENDGRID_API_KEY</code> in your server environment. FloodGuard AI never fakes delivery statuses—attempts without an active provider key are logged honestly as <strong>failed</strong> and can be retried once configured.
            </p>
          </div>
        </div>
      )}

      {/* 4 Email KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">Total Emails Sent</span>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {metrics.total}
            </div>
            <span className="text-[11px] text-slate-500">Logged dispatch attempts</span>
          </div>
          <Mail className="w-6 h-6 text-[#123c69] shrink-0" />
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-800">Successfully Delivered</span>
            <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
              {metrics.delivered}
            </div>
            <span className="text-[11px] text-emerald-700">Webhook / provider confirmed</span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
        </div>

        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-800">Pending Emails</span>
            <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums mt-0.5">
              {metrics.pending}
            </div>
            <span className="text-[11px] text-blue-700 font-mono">
              {metrics.queued} queued · {metrics.sent} sent
            </span>
          </div>
          <Clock className="w-6 h-6 text-[#3498db] shrink-0" />
        </div>

        <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-red-800">Failed Emails</span>
            <div className="text-2xl font-bold text-[#e74c3c] font-mono tabular-nums mt-0.5">
              {metrics.failed + metrics.bounced}
            </div>
            <span className="text-[11px] text-red-700 font-mono">
              {metrics.failed} failed · {metrics.bounced} bounced
            </span>
          </div>
          <XCircle className="w-6 h-6 text-[#e74c3c] shrink-0" />
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { key: 'history', label: `Email History (${emailLogs.length})`, icon: Mail },
            { key: 'compose', label: 'Compose Email', icon: Send },
            { key: 'broadcast', label: 'Emergency Broadcast', icon: Radio },
            { key: 'templates', label: `Email Templates (${templates.length})`, icon: FileText },
            { key: 'settings', label: 'Preferences & Settings', icon: Sliders },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSubTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#123c69] text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: EMAIL HISTORY */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter Email Delivery Status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | EmailDeliveryStatus)
                }
                className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="sent">Sent (Awaiting Confirmation)</option>
                <option value="delivered">Delivered</option>
                <option value="bounced">Bounced</option>
                <option value="failed">Failed</option>
              </select>

              <select
                aria-label="Filter Email Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | EmailType)}
                className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800"
              >
                <option value="all">All Email Types</option>
                <option value="SOS Alert">SOS Alert</option>
                <option value="SOS Status Update">SOS Status Update</option>
                <option value="Emergency Broadcast">Emergency Broadcast</option>
                <option value="Operational">Operational</option>
              </select>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipient, subject, or message..."
              className="w-full md:w-72 text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            />
          </div>

          {emailLogs.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-300 rounded-xl space-y-2">
              <Mail className="w-7 h-7 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No Email Logs Found</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Submit a new SOS request, update an SOS status, compose an update, or issue an emergency broadcast to record live email delivery logs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#123c69] text-white">
                    <th className="p-3 border-b border-slate-200">Recipient</th>
                    <th className="p-3 border-b border-slate-200">Subject &amp; Message</th>
                    <th className="p-3 border-b border-slate-200">Email Type</th>
                    <th className="p-3 border-b border-slate-200">Delivery Status</th>
                    <th className="p-3 border-b border-slate-200">Timestamp</th>
                    <th className="p-3 border-b border-slate-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 border-b border-slate-100 align-top">
                      <td className="p-3 min-w-[180px]">
                        <div className="font-bold text-slate-900">{log.recipientName}</div>
                        <div className="font-mono text-[11px] text-slate-600 break-all">
                          {log.recipientEmail}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {log.recipientRole} · District: <span className="capitalize">{log.district}</span>
                        </div>
                      </td>

                      <td className="p-3 min-w-[260px] max-w-md">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {log.priority === 'Critical' && (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          )}
                          <span>{log.subject}</span>
                        </div>
                        <p className="text-slate-600 mt-1 whitespace-pre-line line-clamp-3">
                          {log.message}
                        </p>
                        {log.relatedSosId && (
                          <div className="text-[11px] text-slate-500 font-mono mt-1">
                            SOS Ref: {log.relatedSosId}
                          </div>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{log.emailType}</div>
                        <div
                          className={`text-[11px] font-semibold mt-0.5 ${
                            log.priority === 'Critical' ? 'text-red-600' : 'text-slate-500'
                          }`}
                        >
                          {log.priority} Priority
                        </div>
                      </td>

                      <td className="p-3 min-w-[170px]">
                        <div className={`uppercase ${statusTextClass(log.status)}`}>
                          {log.status}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          via {log.provider}
                          {log.providerMessageId ? ` · ${log.providerMessageId.slice(0, 14)}` : ''}
                        </div>
                        {log.errorMessage && (
                          <div className="text-[11px] text-red-700 mt-1 leading-snug">
                            {log.errorMessage}
                          </div>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap font-mono tabular-nums text-slate-600">
                        <div>{log.timestamp}</div>
                        <div className="text-[11px] text-slate-400">
                          Retries: {log.retryCount}
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {(log.status === 'failed' || log.status === 'bounced') && (
                            <button
                              type="button"
                              disabled={retryingId === log.id}
                              onClick={() => handleRetryEmail(log)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#159b83] hover:bg-[#087c68] text-white font-semibold rounded cursor-pointer disabled:opacity-60"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{retryingId === log.id ? 'Retrying...' : 'Retry'}</span>
                            </button>
                          )}
                          {log.provider === 'resend' && log.providerMessageId && (
                            <button
                              type="button"
                              disabled={syncingId === log.id}
                              onClick={() => handleSyncEmailStatus(log)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded cursor-pointer disabled:opacity-60"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>{syncingId === log.id ? 'Syncing...' : 'Sync'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: COMPOSE EMAIL */}
      {activeSubTab === 'compose' && (
        <form onSubmit={handleSendCompose} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Prefill from Active SOS Request (Optional)
              </label>
              <select
                aria-label="Prefill from Active SOS Request"
                value={composeRelatedSosId}
                onChange={(e) => handleLoadSosIntoCompose(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">-- Select SOS request to prefill --</option>
                {sosRequests.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.requesterName} · {s.emergencyType} ({s.location}) [{s.status}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Load Email Template (Optional)
              </label>
              <select
                aria-label="Load Email Template"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleApplyTemplateToCompose(e.target.value);
                }}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">-- Choose a template --</option>
                {templates
                  .filter((t) => t.isActive)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Email *
              </label>
              <input
                type="email"
                required
                value={composeRecipientEmail}
                onChange={(e) => setComposeRecipientEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Name
              </label>
              <input
                type="text"
                value={composeRecipientName}
                onChange={(e) => setComposeRecipientName(e.target.value)}
                placeholder="Full name"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Type
              </label>
              <select
                value={composeEmailType}
                onChange={(e) => setComposeEmailType(e.target.value as EmailType)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="Operational">Operational Update</option>
                <option value="SOS Alert">SOS Alert</option>
                <option value="SOS Status Update">SOS Status Update</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={composePriority}
                  onChange={(e) => setComposePriority(e.target.value as EmailPriority)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
                >
                  <option value="Normal">Normal</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  District
                </label>
                <select
                  value={composeDistrict}
                  onChange={(e) => setComposeDistrict(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
                >
                  <option value="sylhet">Sylhet</option>
                  <option value="dhaka">Dhaka</option>
                  <option value="sunamganj">Sunamganj</option>
                  <option value="dinajpur">Dinajpur</option>
                  <option value="All">All</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Subject *
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="[FloodGuard Update] Rescue Team En Route to Your Location"
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message Body *
            </label>
            <textarea
              required
              rows={5}
              maxLength={2000}
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              placeholder="Write emergency instructions, rescue dispatch updates, or shelter directions..."
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            />
          </div>

          {composeFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs font-medium ${
                composeFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {composeFeedback.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={sendingCompose}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingCompose ? 'Dispatching...' : 'Send Email Now'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 3: EMERGENCY BROADCAST */}
      {activeSubTab === 'broadcast' &&
        (canBroadcast ? (
          <form onSubmit={handleSendBroadcast} className="space-y-4">
            {/* Recipient Preview Strip (Privacy-Safe Aggregate Counts Only) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#123c69]">
                  Verified &amp; Opted-In Citizen Broadcast Audience
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Broadcasts only target active registered citizens with verified emails who opted in to emergency alerts. Private addresses remain hidden.
                </p>
              </div>
              {broadcastPreview && (
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono shrink-0">
                  <div>
                    <span className="text-slate-500">Targeted: </span>
                    <strong className="text-[#159b83]">
                      {broadcastPreview.optedInVerifiedCitizens}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Verified: </span>
                    <strong className="text-slate-800">
                      {broadcastPreview.verifiedCitizens}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Opted Out: </span>
                    <strong className="text-amber-700">
                      {broadcastPreview.skippedOptOutCount}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Broadcast Type
                </label>
                <select
                  value={broadcastCategory}
                  onChange={(e) =>
                    setBroadcastCategory(
                      e.target.value as
                        | 'Flood Warning'
                        | 'Evacuation Order'
                        | 'Shelter Info'
                    )
                  }
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="Flood Warning">Emergency Flood Warning</option>
                  <option value="Evacuation Order">Evacuation Instructions</option>
                  <option value="Shelter Info">Shelter Location Bulletin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target District / Location
                </label>
                <select
                  value={broadcastDistrict}
                  onChange={(e) => setBroadcastDistrict(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="all">All Flood-Prone Districts</option>
                  <option value="sylhet">Sylhet</option>
                  <option value="dhaka">Dhaka</option>
                  <option value="sunamganj">Sunamganj</option>
                  <option value="dinajpur">Dinajpur</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority Level
                </label>
                <select
                  value={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.value as EmailPriority)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="Critical">Critical Emergency</option>
                  <option value="Normal">Standard Advisory</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Load Emergency Template
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleApplyTemplateToBroadcast(e.target.value);
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">-- Select broadcast template --</option>
                  {templates
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Broadcast Subject * (supports {'{{district}}'})
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Broadcast Message * (supports {'{{district}}'} and {'{{shelterList}}'})
              </label>
              <textarea
                required
                rows={6}
                maxLength={1800}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastIncludeShelters}
                onChange={(e) => setBroadcastIncludeShelters(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>
                Automatically append open emergency shelter capacities for selected district
              </span>
            </label>

            {broadcastFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs font-medium ${
                  broadcastFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {broadcastFeedback.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={sendingBroadcast}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#e74c3c] hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <Radio className="w-4 h-4" />
                <span>
                  {sendingBroadcast
                    ? 'Broadcasting...'
                    : `Dispatch Emergency Broadcast (${
                        broadcastPreview?.optedInVerifiedCitizens ?? 0
                      } Citizens)`}
                </span>
              </button>
            </div>
          </form>
        ) : (
          <div className="py-10 px-4 text-center border border-dashed border-slate-300 rounded-xl space-y-2">
            <Lock className="w-7 h-7 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-800">
              Emergency Broadcast Restricted to Authorized Officers
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your current role ({sessionUser.role}) can send targeted operational &amp; SOS updates in Compose Email, while mass Emergency Broadcasts require Disaster Management or Admin authorization.
            </p>
          </div>
        ))}

      {/* SUBTAB 4: EMAIL TEMPLATES */}
      {activeSubTab === 'templates' && (
        <div className="space-y-5">
          {!isAdmin && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Creating, editing, and deleting templates is restricted to <strong>Admin</strong> accounts. You can load active templates directly into Compose or Broadcast.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={`p-4 rounded-xl border space-y-2 ${
                  tpl.isActive
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-50 border-slate-200 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[#123c69]">{tpl.name}</div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {tpl.category} · {tpl.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        handleApplyTemplateToCompose(tpl.id);
                        setActiveSubTab('compose');
                      }}
                      className="px-2.5 py-1 bg-[#159b83] hover:bg-[#087c68] text-white text-[11px] font-semibold rounded cursor-pointer"
                    >
                      Use in Compose
                    </button>
                    {canBroadcast && (
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyTemplateToBroadcast(tpl.id);
                          setActiveSubTab('broadcast');
                        }}
                        className="px-2.5 py-1 bg-[#123c69] hover:bg-[#245786] text-white text-[11px] font-semibold rounded cursor-pointer"
                      >
                        Broadcast
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-800">{tpl.subject}</div>
                <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-4">
                  {tpl.body}
                </p>

                {isAdmin && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleTemplate(tpl)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded cursor-pointer"
                    >
                      {tpl.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold rounded cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <form
              onSubmit={handleCreateTemplate}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <h3 className="text-sm font-bold text-[#123c69] flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#159b83]" />
                <span>Create Emergency Email Template (Admin Only)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newTplName}
                    onChange={(e) => setNewTplName(e.target.value)}
                    placeholder="e.g., Red Alert Riverbank Evacuation"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newTplCategory}
                    onChange={(e) =>
                      setNewTplCategory(e.target.value as EmailTemplateCategory)
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="Flood Warning">Flood Warning</option>
                    <option value="Evacuation Order">Evacuation Order</option>
                    <option value="Shelter Info">Shelter Info</option>
                    <option value="SOS Alert">SOS Alert</option>
                    <option value="SOS Status Update">SOS Status Update</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={newTplSubject}
                  onChange={(e) => setNewTplSubject(e.target.value)}
                  placeholder="[EVACUATION ORDER] Immediate Evacuation for {{district}}"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Body (supports {'{{district}}'} and {'{{shelterList}}'})
                </label>
                <textarea
                  rows={4}
                  required
                  value={newTplBody}
                  onChange={(e) => setNewTplBody(e.target.value)}
                  placeholder="Enter template body..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={savingTpl}
                className="px-4 py-2 bg-[#123c69] hover:bg-[#245786] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {savingTpl ? 'Saving...' : 'Save Email Template'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* SUBTAB 5: SETTINGS & PREFERENCES */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Personal Email Notification Preferences */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-[#123c69]">
              Your Email Notification Preferences
            </h3>
            <p className="text-xs text-slate-500">
              Control which FloodGuard AI alerts are sent to{' '}
              <span className="font-mono text-slate-700">{sessionUser.email}</span>.
            </p>
            {preferences ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned District
                  </label>
                  <select
                    value={preferences.district}
                    onChange={(e) =>
                      setPreferences({ ...preferences, district: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="sylhet">Sylhet</option>
                    <option value="dhaka">Dhaka</option>
                    <option value="sunamganj">Sunamganj</option>
                    <option value="dinajpur">Dinajpur</option>
                  </select>
                </div>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer">
                  <span>Receive Automatic SOS Alert Dispatch Emails</span>
                  <input
                    type="checkbox"
                    checked={preferences.sosAlertsEnabled}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        sosAlertsEnabled: e.target.checked,
                      })
                    }
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer">
                  <span>Receive SOS Status Update Notifications</span>
                  <input
                    type="checkbox"
                    checked={preferences.statusUpdatesEnabled}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        statusUpdatesEnabled: e.target.checked,
                      })
                    }
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer">
                  <span>Receive District Emergency Flood Broadcasts</span>
                  <input
                    type="checkbox"
                    checked={preferences.broadcastsEnabled}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        broadcastsEnabled: e.target.checked,
                      })
                    }
                  />
                </label>

                <button
                  type="button"
                  disabled={savingPrefs}
                  onClick={() => handleSavePreferences(preferences)}
                  className="px-4 py-2 bg-[#159b83] hover:bg-[#087c68] text-white font-semibold rounded-lg cursor-pointer"
                >
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Loading preferences...</div>
            )}
          </div>

          {/* Admin Email Provider & Rate Limit Configuration (Never exposes secrets) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-[#123c69]">
              Transactional Email Gateway &amp; Rate Limits
            </h3>
            {systemSettings && (
              <div className="text-xs space-y-1.5 text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <strong>Active Provider:</strong>{' '}
                  <span className="uppercase font-mono">{systemSettings.activeProvider}</span>
                </div>
                <div>
                  <strong>Sender Address:</strong>{' '}
                  <span className="font-mono">{systemSettings.fromAddress}</span>
                </div>
                <div>
                  <strong>Webhook Endpoints:</strong>{' '}
                  <span className="font-mono text-[11px]">
                    {systemSettings.resendWebhookPath} · {systemSettings.sendgridWebhookPath}
                  </span>
                </div>
                <div>
                  <strong>Webhook HMAC Verification:</strong>{' '}
                  {systemSettings.webhookConfigured ? 'Enabled (Secret Set)' : 'Optional Secret Unset'}
                </div>
              </div>
            )}

            {isAdmin ? (
              <form onSubmit={handleSaveSystemSettings} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Rate Limit (emails/min)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={draftRateLimit}
                      onChange={(e) => setDraftRateLimit(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Max Auto-Retries (0–5)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={draftMaxRetries}
                      onChange={(e) => setDraftMaxRetries(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 bg-[#123c69] hover:bg-[#245786] text-white font-semibold rounded-lg cursor-pointer"
                >
                  {savingSettings ? 'Updating...' : 'Update Gateway Settings'}
                </button>
              </form>
            ) : (
              <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Only <strong>Admin</strong> accounts can modify system-wide rate limits and retry policies. API keys are kept strictly server-side.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
