import crypto from 'crypto';

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

export interface EmailLogRecord {
  id: string;
  ownerId: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'Citizen' | 'Volunteer' | 'Authority' | 'Forecast Officer' | 'Admin' | 'External';
  subject: string;
  message: string;
  htmlBody: string;
  emailType: EmailType;
  priority: EmailPriority;
  status: EmailDeliveryStatus;
  provider: EmailProviderName;
  providerMessageId: string;
  errorMessage: string;
  retryCount: number;
  district: string;
  relatedSosId: string;
  dedupeKey: string;
  timestamp: string;
  createdAtMs: number;
  updatedAt: string;
}

export interface EmailTemplateRecord {
  id: string;
  ownerId: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
}

export interface EmailSystemSettings {
  rateLimitPerMinute: number;
  maxRetries: number;
  retryBackoffMs: number;
  dedupeWindowMs: number;
}

export const EMAIL_SYSTEM_SETTINGS: EmailSystemSettings = {
  rateLimitPerMinute: 30,
  maxRetries: 3,
  retryBackoffMs: 5000,
  dedupeWindowMs: 120_000,
};

export const EMAIL_LOGS_STORE: EmailLogRecord[] = [];

export const EMAIL_TEMPLATES_STORE: EmailTemplateRecord[] = [
  {
    id: 'tpl_flood_warning',
    ownerId: 'system',
    name: 'Urgent Flood Warning Broadcast',
    category: 'Flood Warning',
    subject: '[FloodGuard Alert] High Water Level Warning for {{district}}',
    body: 'URGENT FLOOD WARNING ({{district}}): River gauge water levels have crossed critical alert thresholds. Move family members, livestock, and essential documents to elevated ground immediately. Monitor official updates on FloodGuard AI.\n\nNearest Shelters:\n{{shelterList}}',
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_evacuation_order',
    ownerId: 'system',
    name: 'Mandatory Evacuation Instructions',
    category: 'Evacuation Order',
    subject: '[EVACUATION ORDER] Immediate Evacuation Required in {{district}}',
    body: 'MANDATORY EVACUATION NOTICE for low-lying wards in {{district}}:\n1. Disconnect electrical mains and gas valves before leaving.\n2. Proceed immediately to the nearest elevated flood shelter listed below.\n3. Carry drinking water, dry food, medications, and emergency phone numbers.\n4. Submit an SOS request via FloodGuard AI if stranded.\n\nDesignated Shelters:\n{{shelterList}}',
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_shelter_info',
    ownerId: 'system',
    name: 'Shelter Location & Capacity Bulletin',
    category: 'Shelter Info',
    subject: '[FloodGuard Shelters] Open Relief Centers & Live Capacities in {{district}}',
    body: 'Verified Flood Shelters currently accepting evacuees in {{district}}:\n\n{{shelterList}}\n\nYou may reserve 2 to 5 family spots directly from your FloodGuard AI User Dashboard or Shelter Finder.',
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_sos_alert',
    ownerId: 'system',
    name: 'Automatic SOS Emergency Dispatch Alert',
    category: 'SOS Alert',
    subject: '{{priorityPrefix}} SOS {{sosType}} Alert — {{location}} ({{citizenName}})',
    body: 'Emergency SOS request received at {{timestamp}}:\n- SOS Type: {{sosType}}\n- Priority: {{priority}}\n- Citizen: {{citizenName}}\n- Phone: {{citizenPhone}}\n- Location: {{location}}\n- Details: {{description}}\n\nPlease accept and dispatch a rescue unit from the Volunteer & SOS Dashboard.',
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_sos_status',
    ownerId: 'system',
    name: 'Citizen SOS Status Update',
    category: 'SOS Status Update',
    subject: '[FloodGuard SOS Update] Your request is now {{status}} ({{location}})',
    body: 'Dear {{citizenName}},\n\nYour emergency {{sosType}} SOS request for {{location}} has been updated to: {{status}}.\n\nAssigned Response Team: {{volunteerInfo}}\nUpdated At: {{timestamp}}\n\nStay in a safe elevated spot and keep your phone reachable.',
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
];

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

export function isValidEmailAddress(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 160) return false;
  if (/[\r\n]/.test(trimmed)) return false;
  return STRICT_EMAIL_REGEX.test(trimmed);
}

export function sanitizeHeaderText(raw: unknown, maxLen: number = 200): string {
  return String(raw ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getActiveEmailProvider(): {
  provider: EmailProviderName;
  configured: boolean;
  fromAddress: string;
} {
  const preferred = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
  const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.trim());
  const fromAddress = sanitizeHeaderText(
    process.env.EMAIL_FROM || 'FloodGuard AI <alerts@floodguard.gov.bd>',
    160
  );

  if (preferred === 'sendgrid' && hasSendGrid) {
    return { provider: 'sendgrid', configured: true, fromAddress };
  }
  if (preferred === 'resend' && hasResend) {
    return { provider: 'resend', configured: true, fromAddress };
  }
  if (hasResend) {
    return { provider: 'resend', configured: true, fromAddress };
  }
  if (hasSendGrid) {
    return { provider: 'sendgrid', configured: true, fromAddress };
  }
  return { provider: 'unconfigured', configured: false, fromAddress };
}

// Sliding-window per-actor and global rate limiter
const RATE_LIMIT_BUCKETS = new Map<string, number[]>();

export function checkEmailRateLimit(actorId: string, countToSend: number = 1): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const windowMs = 60_000;
  const maxPerMin = EMAIL_SYSTEM_SETTINGS.rateLimitPerMinute;
  const key = `actor:${actorId}`;
  const existing = (RATE_LIMIT_BUCKETS.get(key) || []).filter((ts) => now - ts < windowMs);

  if (existing.length + countToSend > maxPerMin) {
    const oldest = existing[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    RATE_LIMIT_BUCKETS.set(key, existing);
    return {
      allowed: false,
      remaining: Math.max(0, maxPerMin - existing.length),
      retryAfterSeconds,
    };
  }

  for (let i = 0; i < countToSend; i++) {
    existing.push(now);
  }
  RATE_LIMIT_BUCKETS.set(key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, maxPerMin - existing.length),
    retryAfterSeconds: 0,
  };
}

export function isDuplicateEmail(dedupeKey: string): boolean {
  if (!dedupeKey) return false;
  const now = Date.now();
  return EMAIL_LOGS_STORE.some(
    (log) =>
      log.dedupeKey === dedupeKey &&
      now - log.createdAtMs < EMAIL_SYSTEM_SETTINGS.dedupeWindowMs
  );
}

export function renderTemplateText(
  template: string,
  vars: Record<string, string>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

export function buildFloodGuardEmailHtml(params: {
  title: string;
  subtitle?: string;
  priority: EmailPriority;
  emailType: EmailType;
  bodyText: string;
  details?: Array<{ label: string; value: string }>;
}): string {
  const isCritical = params.priority === 'Critical';
  const bannerColor = isCritical ? '#b91c1c' : '#123c69';
  const accentBg = isCritical ? '#fef2f2' : '#f8fafc';
  const accentBorder = isCritical ? '#fecaca' : '#cbd5e1';

  const detailRows = (params.details || [])
    .map(
      (d) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#334155;width:160px;font-size:13px;">${escapeHtml(d.label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;">${escapeHtml(d.value)}</td>
      </tr>`
    )
    .join('');

  const formattedBody = escapeHtml(params.bodyText).replace(/\n/g, '<br />');

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">
    <div style="background:${bannerColor};color:#ffffff;padding:20px 24px;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">FloodGuard AI · ${escapeHtml(params.emailType)}${isCritical ? ' · CRITICAL PRIORITY' : ''}</div>
      <h1 style="margin:6px 0 0;font-size:20px;line-height:1.3;">${escapeHtml(params.title)}</h1>
      ${params.subtitle ? `<p style="margin:4px 0 0;font-size:13px;opacity:0.9;">${escapeHtml(params.subtitle)}</p>` : ''}
    </div>
    <div style="padding:24px;">
      <div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:8px;padding:16px;font-size:14px;line-height:1.6;color:#0f172a;">
        ${formattedBody}
      </div>
      ${
        detailRows
          ? `<table style="width:100%;border-collapse:collapse;margin-top:18px;border:1px solid #e2e8f0;border-radius:8px;">${detailRows}</table>`
          : ''
      }
      <p style="margin:20px 0 0;font-size:12px;color:#64748b;">
        This message was generated by FloodGuard AI Emergency Operations. Manage your email notification preferences inside your FloodGuard dashboard.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function isCriticalSosEmergency(params: {
  emergencyType: string;
  message?: string;
}): boolean {
  if (params.emergencyType === 'Flood Rescue' || params.emergencyType === 'Emergency Help') {
    return true;
  }
  const msg = String(params.message || '').toLowerCase();
  return (
    msg.includes('urgent') ||
    msg.includes('critical') ||
    msg.includes('rooftop') ||
    msg.includes('trapped') ||
    msg.includes('stranded') ||
    msg.includes('immediately') ||
    msg.includes('elderly') ||
    msg.includes('submerged')
  );
}

interface ProviderDispatchResult {
  ok: boolean;
  provider: EmailProviderName;
  status: EmailDeliveryStatus;
  providerMessageId: string;
  errorMessage: string;
  retryable: boolean;
}

async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  logId: string;
}): Promise<ProviderDispatchResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
        headers: {
          'X-FloodGuard-Log-Id': params.logId,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const rawText = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    if (response.ok) {
      return {
        ok: true,
        provider: 'resend',
        status: 'sent',
        providerMessageId: String(parsed.id || ''),
        errorMessage: '',
        retryable: false,
      };
    }

    const errMsg =
      String(parsed.message || parsed.error || rawText || `Resend HTTP ${response.status}`).slice(0, 480);
    return {
      ok: false,
      provider: 'resend',
      status: 'failed',
      providerMessageId: '',
      errorMessage: errMsg,
      retryable: response.status >= 500 || response.status === 429,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'resend',
      status: 'failed',
      providerMessageId: '',
      errorMessage: `Resend network error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 480),
      retryable: true,
    };
  }
}

async function sendViaSendGrid(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  logId: string;
}): Promise<ProviderDispatchResult> {
  try {
    const emailMatch = params.from.match(/<([^>]+)>/);
    const fromEmail = emailMatch ? emailMatch[1].trim() : params.from.trim();
    const fromName = emailMatch ? params.from.replace(/<[^>]+>/, '').trim() : 'FloodGuard AI';

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: params.to }],
            custom_args: { floodguard_log_id: params.logId },
          },
        ],
        from: { email: fromEmail, name: fromName || 'FloodGuard AI' },
        subject: params.subject,
        content: [
          { type: 'text/plain', value: params.text },
          { type: 'text/html', value: params.html },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      const msgId = response.headers.get('x-message-id') || '';
      return {
        ok: true,
        provider: 'sendgrid',
        status: 'sent',
        providerMessageId: msgId,
        errorMessage: '',
        retryable: false,
      };
    }

    const rawText = await response.text();
    return {
      ok: false,
      provider: 'sendgrid',
      status: 'failed',
      providerMessageId: '',
      errorMessage: `SendGrid HTTP ${response.status}: ${rawText}`.slice(0, 480),
      retryable: response.status >= 500 || response.status === 429,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'sendgrid',
      status: 'failed',
      providerMessageId: '',
      errorMessage: `SendGrid network error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 480),
      retryable: true,
    };
  }
}

async function dispatchToProvider(log: EmailLogRecord): Promise<ProviderDispatchResult> {
  const { provider, configured, fromAddress } = getActiveEmailProvider();
  if (!configured || provider === 'unconfigured') {
    return {
      ok: false,
      provider: 'unconfigured',
      status: 'failed',
      providerMessageId: '',
      errorMessage:
        'Email provider not configured on server: set RESEND_API_KEY or SENDGRID_API_KEY in server environment variables.',
      retryable: false,
    };
  }

  if (provider === 'resend') {
    return sendViaResend({
      apiKey: process.env.RESEND_API_KEY!.trim(),
      from: fromAddress,
      to: log.recipientEmail,
      subject: log.subject,
      text: log.message,
      html: log.htmlBody,
      logId: log.id,
    });
  }

  return sendViaSendGrid({
    apiKey: process.env.SENDGRID_API_KEY!.trim(),
    from: fromAddress,
    to: log.recipientEmail,
    subject: log.subject,
    text: log.message,
    html: log.htmlBody,
    logId: log.id,
  });
}

function scheduleRetryIfEligible(log: EmailLogRecord) {
  if (log.retryCount >= EMAIL_SYSTEM_SETTINGS.maxRetries) return;
  const delay = EMAIL_SYSTEM_SETTINGS.retryBackoffMs * Math.pow(2, log.retryCount);
  setTimeout(async () => {
    if (log.status !== 'failed') return;
    log.retryCount += 1;
    log.status = 'queued';
    log.updatedAt = new Date().toISOString();
    const res = await dispatchToProvider(log);
    log.provider = res.provider;
    log.status = res.status;
    log.providerMessageId = res.providerMessageId;
    log.errorMessage = res.errorMessage;
    log.updatedAt = new Date().toISOString();
    if (!res.ok && res.retryable && log.retryCount < EMAIL_SYSTEM_SETTINGS.maxRetries) {
      scheduleRetryIfEligible(log);
    }
  }, delay);
}

export async function queueAndSendEmail(params: {
  ownerId: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: EmailLogRecord['recipientRole'];
  subject: string;
  message: string;
  htmlBody?: string;
  emailType: EmailType;
  priority?: EmailPriority;
  district?: string;
  relatedSosId?: string;
  dedupeKey?: string;
}): Promise<{ log: EmailLogRecord | null; skippedDuplicate: boolean; validationError?: string }> {
  if (!isValidEmailAddress(params.recipientEmail)) {
    return {
      log: null,
      skippedDuplicate: false,
      validationError: `Invalid email address: "${params.recipientEmail}".`,
    };
  }

  const dedupeKey = params.dedupeKey || '';
  if (dedupeKey && isDuplicateEmail(dedupeKey)) {
    return { log: null, skippedDuplicate: true };
  }

  const cleanSubject = sanitizeHeaderText(params.subject, 200);
  const cleanMessage = String(params.message || '').trim().slice(0, 2000);
  if (!cleanSubject || !cleanMessage) {
    return {
      log: null,
      skippedDuplicate: false,
      validationError: 'Email subject and message body cannot be empty.',
    };
  }

  const priority: EmailPriority = params.priority || 'Normal';
  const htmlBody =
    params.htmlBody ||
    buildFloodGuardEmailHtml({
      title: cleanSubject,
      priority,
      emailType: params.emailType,
      bodyText: cleanMessage,
    });

  const now = new Date();
  const { provider } = getActiveEmailProvider();
  const log: EmailLogRecord = {
    id: `eml_${now.getTime()}_${crypto.randomBytes(3).toString('hex')}`,
    ownerId: params.ownerId || 'system',
    recipientEmail: params.recipientEmail.trim().toLowerCase(),
    recipientName: sanitizeHeaderText(params.recipientName || params.recipientEmail, 120),
    recipientRole: params.recipientRole,
    subject: cleanSubject,
    message: cleanMessage,
    htmlBody,
    emailType: params.emailType,
    priority,
    status: 'queued',
    provider,
    providerMessageId: '',
    errorMessage: '',
    retryCount: 0,
    district: sanitizeHeaderText(params.district || 'All', 60),
    relatedSosId: sanitizeHeaderText(params.relatedSosId || '', 128),
    dedupeKey,
    timestamp: now.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    createdAtMs: now.getTime(),
    updatedAt: now.toISOString(),
  };

  EMAIL_LOGS_STORE.unshift(log);
  if (EMAIL_LOGS_STORE.length > 500) {
    EMAIL_LOGS_STORE.length = 500;
  }

  const result = await dispatchToProvider(log);
  log.provider = result.provider;
  log.status = result.status;
  log.providerMessageId = result.providerMessageId;
  log.errorMessage = result.errorMessage;
  log.updatedAt = new Date().toISOString();

  if (!result.ok && result.retryable) {
    scheduleRetryIfEligible(log);
  }

  return { log, skippedDuplicate: false };
}

export async function retryEmailDelivery(logId: string): Promise<{
  ok: boolean;
  error?: string;
  log?: EmailLogRecord;
}> {
  const log = EMAIL_LOGS_STORE.find((l) => l.id === logId);
  if (!log) {
    return { ok: false, error: 'Email log record not found.' };
  }
  if (log.status === 'delivered' || log.status === 'sent') {
    return { ok: false, error: `Email is already in "${log.status}" state and does not require retry.` };
  }

  log.retryCount += 1;
  log.status = 'queued';
  log.errorMessage = '';
  log.updatedAt = new Date().toISOString();

  const res = await dispatchToProvider(log);
  log.provider = res.provider;
  log.status = res.status;
  log.providerMessageId = res.providerMessageId;
  log.errorMessage = res.errorMessage;
  log.updatedAt = new Date().toISOString();

  return { ok: res.ok, error: res.errorMessage || undefined, log };
}

export async function syncResendMessageStatus(logId: string): Promise<{
  ok: boolean;
  error?: string;
  log?: EmailLogRecord;
}> {
  const log = EMAIL_LOGS_STORE.find((l) => l.id === logId);
  if (!log) {
    return { ok: false, error: 'Email log record not found.' };
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || log.provider !== 'resend' || !log.providerMessageId) {
    return {
      ok: false,
      error: 'Provider status sync requires a Resend message ID and configured RESEND_API_KEY.',
      log,
    };
  }

  try {
    const response = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(log.providerMessageId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!response.ok) {
      return {
        ok: false,
        error: `Resend status query returned HTTP ${response.status}.`,
        log,
      };
    }
    const data = (await response.json()) as { last_event?: string };
    const lastEvent = String(data.last_event || '').toLowerCase();
    if (lastEvent === 'delivered') {
      log.status = 'delivered';
    } else if (lastEvent === 'bounced') {
      log.status = 'bounced';
      log.errorMessage = 'Recipient address bounced according to provider.';
    } else if (lastEvent === 'complained' || lastEvent === 'failed') {
      log.status = 'failed';
      log.errorMessage = `Provider reported event: ${lastEvent}.`;
    } else if (lastEvent === 'sent') {
      log.status = 'sent';
    }
    log.updatedAt = new Date().toISOString();
    return { ok: true, log };
  } catch (err) {
    return {
      ok: false,
      error: `Failed to sync provider status: ${err instanceof Error ? err.message : String(err)}`,
      log,
    };
  }
}

export function verifyWebhookSecretIfSet(
  reqHeaders: Record<string, string | string[] | undefined>,
  rawBody: string
): boolean {
  const secret = process.env.EMAIL_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const providedBearer = String(reqHeaders['x-webhook-secret'] || '').trim();
  if (providedBearer && providedBearer === secret) return true;

  const svixSig = String(reqHeaders['svix-signature'] || '').trim();
  const svixId = String(reqHeaders['svix-id'] || '').trim();
  const svixTimestamp = String(reqHeaders['svix-timestamp'] || '').trim();
  if (svixSig && svixId && svixTimestamp) {
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const secretBytes = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice(6), 'base64')
      : Buffer.from(secret, 'utf8');
    const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    return svixSig.includes(expected);
  }
  return false;
}

export function applyResendWebhookEvent(payload: {
  type?: string;
  data?: { email_id?: string; to?: string[]; bounce?: { message?: string } };
}): boolean {
  const eventType = String(payload?.type || '').toLowerCase();
  const emailId = String(payload?.data?.email_id || '').trim();
  if (!emailId) return false;

  const log = EMAIL_LOGS_STORE.find((l) => l.providerMessageId === emailId);
  if (!log) return false;

  if (eventType === 'email.sent') {
    if (log.status === 'queued') log.status = 'sent';
  } else if (eventType === 'email.delivered') {
    log.status = 'delivered';
    log.errorMessage = '';
  } else if (eventType === 'email.bounced') {
    log.status = 'bounced';
    log.errorMessage = String(payload?.data?.bounce?.message || 'Email bounced by recipient mail server.').slice(0, 480);
  } else if (eventType === 'email.failed' || eventType === 'email.complained') {
    log.status = 'failed';
    log.errorMessage = `Provider webhook event: ${eventType}`.slice(0, 480);
  }
  log.updatedAt = new Date().toISOString();
  return true;
}

export function applySendGridWebhookEvents(
  events: Array<{ event?: string; sg_message_id?: string; floodguard_log_id?: string; reason?: string }>
): number {
  let updated = 0;
  for (const ev of events) {
    const msgId = String(ev.sg_message_id || '').split('.')[0];
    const logId = String(ev.floodguard_log_id || '').trim();
    const log = EMAIL_LOGS_STORE.find(
      (l) => (logId && l.id === logId) || (msgId && l.providerMessageId && l.providerMessageId.startsWith(msgId))
    );
    if (!log) continue;

    const type = String(ev.event || '').toLowerCase();
    if (type === 'processed') {
      if (log.status === 'queued') log.status = 'sent';
      updated++;
    } else if (type === 'delivered') {
      log.status = 'delivered';
      log.errorMessage = '';
      updated++;
    } else if (type === 'bounce') {
      log.status = 'bounced';
      log.errorMessage = String(ev.reason || 'Bounced by recipient mail server.').slice(0, 480);
      updated++;
    } else if (type === 'dropped') {
      log.status = 'failed';
      log.errorMessage = String(ev.reason || 'Dropped by SendGrid.').slice(0, 480);
      updated++;
    }
    log.updatedAt = new Date().toISOString();
  }
  return updated;
}

export function toPublicEmailLog(log: EmailLogRecord) {
  return {
    id: log.id,
    ownerId: log.ownerId,
    recipientEmail: log.recipientEmail,
    recipientName: log.recipientName,
    recipientRole: log.recipientRole,
    subject: log.subject,
    message: log.message,
    emailType: log.emailType,
    priority: log.priority,
    status: log.status,
    provider: log.provider,
    providerMessageId: log.providerMessageId,
    errorMessage: log.errorMessage,
    retryCount: log.retryCount,
    district: log.district,
    relatedSosId: log.relatedSosId,
    timestamp: log.timestamp,
    updatedAt: log.updatedAt,
  };
}

export function computeEmailMetrics(logs: EmailLogRecord[]) {
  const total = logs.length;
  const delivered = logs.filter((l) => l.status === 'delivered').length;
  const queued = logs.filter((l) => l.status === 'queued').length;
  const sent = logs.filter((l) => l.status === 'sent').length;
  const bounced = logs.filter((l) => l.status === 'bounced').length;
  const failedOnly = logs.filter((l) => l.status === 'failed').length;
  return {
    total,
    delivered,
    pending: queued + sent,
    failed: failedOnly + bounced,
    queued,
    sent,
    bounced,
  };
}
