import {
  IntakeDocumentCompletionAlert,
  MicrosoftConnectionStatus,
  OfficerReminderWorkflow
} from '../types';
import { buildDeliverableTransactionalEmail } from './emailDeliverability';

export interface PreExpiryScheduleCalculation {
  expiryDateIso: string;
  targetNotifyDateIso: string;
  isDueOrOverdueToday: boolean;
  daysUntilExpiry: number;
  daysUntilNotify: number;
}

/**
 * Computes the effective FICA expiry date (earliest expiring document or 30-day intake SLA cutoff)
 * and sets the urgent officer trigger date 2 or 3 days before expiry (clamped to today if <= leadDays).
 */
export function calculatePreExpirySchedule(
  alert: IntakeDocumentCompletionAlert,
  leadDays: 2 | 3 = 2,
  now: Date = new Date()
): PreExpiryScheduleCalculation {
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const candidateRemainingDays: number[] = [];
  if (!alert.agingInfo.isFinalized) {
    candidateRemainingDays.push(
      alert.slaDaysOverdue > 0 ? -alert.slaDaysOverdue : alert.slaDaysRemaining
    );
  }
  if (alert.earliestDocDaysRemaining !== null) {
    candidateRemainingDays.push(alert.earliestDocDaysRemaining);
  }

  const daysUntilExpiry =
    candidateRemainingDays.length > 0 ? Math.min(...candidateRemainingDays) : alert.slaDaysRemaining;

  const expiryMs = todayUtcMs + daysUntilExpiry * 86_400_000;
  const rawNotifyMs = expiryMs - leadDays * 86_400_000;
  const clampedNotifyMs = Math.max(todayUtcMs, rawNotifyMs);

  const expiryDateIso = new Date(expiryMs).toISOString().slice(0, 10);
  const targetNotifyDateIso = new Date(clampedNotifyMs).toISOString().slice(0, 10);
  const daysUntilNotify = Math.max(0, Math.round((clampedNotifyMs - todayUtcMs) / 86_400_000));

  return {
    expiryDateIso,
    targetNotifyDateIso,
    isDueOrOverdueToday: clampedNotifyMs <= todayUtcMs,
    daysUntilExpiry,
    daysUntilNotify,
  };
}

export interface GoogleAutomationResult {
  gmailSent: boolean;
  googleEventId?: string;
  googleTaskId?: string;
}

/**
 * Executes 1-click Google Workspace automation for the compliance officer:
 * 1. Sends urgent pre-expiry email via Gmail API (RFC-5322 multipart/alternative)
 * 2. Creates a daily recurring Google Calendar event starting on targetNotifyDateIso
 * 3. Creates a high-priority Google Task with due date on targetNotifyDateIso
 */
export async function executeGooglePreExpiryAutomation(params: {
  accessToken: string;
  officerEmail: string;
  officerName: string;
  practiceName: string;
  alert: IntakeDocumentCompletionAlert;
  schedule: PreExpiryScheduleCalculation;
  leadDays: 2 | 3;
  portalUrl: string;
}): Promise<GoogleAutomationResult> {
  const {
    accessToken,
    officerEmail,
    officerName,
    practiceName,
    alert,
    schedule,
    leadDays,
    portalUrl,
  } = params;

  const { intake, outstandingItems } = alert;
  const bulletItems = [
    `Client: ${intake.clientName} (${intake.clientEmail})`,
    `Compliance Expiry / SLA Deadline: ${schedule.expiryDateIso}`,
    `Pre-Expiry Trigger Date (${leadDays}d prior): ${schedule.targetNotifyDateIso}`,
    ...outstandingItems.map((item) => `Outstanding: ${item.label} — ${item.detail}`),
  ];

  // 1. Send Gmail Officer Alert
  const mime = buildDeliverableTransactionalEmail({
    fromEmail: officerEmail,
    fromName: officerName,
    toEmail: officerEmail,
    replyToEmail: officerEmail,
    subject: `FICA Pre-Expiry Alert (${leadDays}d prior): ${intake.clientName} — Issue Portal Reminder`,
    heading: `Urgent Officer Action: Issue Portal Reminder for ${intake.clientName}`,
    introParagraph: `Automated ${leadDays}-day pre-expiry compliance notice triggered for ${intake.clientName}. Their FICA documentation deadline falls on ${schedule.expiryDateIso}. Open the portal to dispatch the client upload reminder so daily reminders stop automatically.`,
    bulletItems,
    ctaLabel: 'Open FICA Officer Dashboard',
    ctaUrl: portalUrl,
    practiceName,
    footerNote:
      'Daily Google Calendar and Google Tasks reminders remain active until you dispatch the portal reminder and the client completes document upload.',
  });

  const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: mime.rawRfc2822Base64Url }),
  });

  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    throw new Error(`Gmail API send failed (${gmailRes.status}): ${errText}`);
  }

  // 2. Create Daily Recurring Google Calendar Event
  let googleEventId: string | undefined;
  const startDate = schedule.targetNotifyDateIso;
  const calRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `[FICA Urgent] Issue Portal Reminder: ${intake.clientName}`,
        description: `Pre-expiry alert (${leadDays}d before ${schedule.expiryDateIso}).\nOutstanding docs:\n${outstandingItems
          .map((i) => `- ${i.label}: ${i.detail}`)
          .join('\n')}\nPortal: ${portalUrl}`,
        start: {
          dateTime: `${startDate}T08:30:00+02:00`,
          timeZone: 'Africa/Johannesburg',
        },
        end: {
          dateTime: `${startDate}T09:00:00+02:00`,
          timeZone: 'Africa/Johannesburg',
        },
        recurrence: ['RRULE:FREQ=DAILY;COUNT=14'],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 30 },
            { method: 'popup', minutes: 10 },
          ],
        },
      }),
    }
  );

  if (calRes.ok) {
    const calJson = (await calRes.json()) as { id?: string };
    googleEventId = calJson.id;
  }

  // 3. Create Google Task
  let googleTaskId: string | undefined;
  const taskRes = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Issue FICA Portal Reminder: ${intake.clientName} (Expires ${schedule.expiryDateIso})`,
      notes: `${bulletItems.join(' | ')}\nPortal: ${portalUrl}`,
      due: `${startDate}T17:00:00.000Z`,
    }),
  });

  if (taskRes.ok) {
    const taskJson = (await taskRes.json()) as { id?: string };
    googleTaskId = taskJson.id;
  }

  return {
    gmailSent: true,
    googleEventId,
    googleTaskId,
  };
}

/**
 * Automatically clears the Google Calendar daily recurring event and marks the Google Task completed
 * once the officer sends the reminder or the client uploads their documents.
 */
export async function completeGoogleWorkflowReminders(
  accessToken: string | null,
  workflow: Pick<OfficerReminderWorkflow, 'googleEventId' | 'googleTaskId'>
): Promise<void> {
  if (!accessToken) return;

  if (workflow.googleTaskId) {
    await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(workflow.googleTaskId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
      }
    ).catch(() => {});
  }

  if (workflow.googleEventId) {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(workflow.googleEventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ).catch(() => {});
  }
}

/**
 * Sends a clean, authenticated first-party Gmail magic link message with balanced
 * text/plain + text/html parts so corporate spam gateways do not quarantine it.
 */
export async function sendMagicLinkViaGmail(params: {
  accessToken: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  clientName?: string;
  practiceName: string;
  magicUrl: string;
}): Promise<{ spamRiskWarnings: string[] }> {
  const composed = buildDeliverableTransactionalEmail({
    fromEmail: params.fromEmail,
    fromName: params.fromName,
    toEmail: params.toEmail,
    replyToEmail: params.fromEmail,
    subject: `Secure FICA Verification Link — ${params.practiceName}`,
    heading: `Client Portal Access for ${params.clientName || params.toEmail}`,
    introParagraph: `${params.practiceName} has opened your encrypted FICA & POPIA onboarding portal. Click the verified access link below to upload your requested verification documents securely without creating a password.`,
    bulletItems: [
      'Link expiration: 24 hours (single-use cryptographic token)',
      'Regulation: Financial Intelligence Centre Act (FICA) & POPIA Section 19',
      `Issued directly by: ${params.fromName} (${params.fromEmail})`,
    ],
    ctaLabel: 'Open Secure Client Portal',
    ctaUrl: params.magicUrl,
    practiceName: params.practiceName,
    footerNote:
      'Delivered directly from your practice Google Workspace account to ensure DKIM/SPF/DMARC domain alignment.',
  });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: composed.rawRfc2822Base64Url }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API send failed (${res.status}): ${errText}`);
  }

  return { spamRiskWarnings: composed.spamRiskWarnings };
}

// ============================================================================
// MICROSOFT 365 BACKEND PROXY WRAPPERS
// ============================================================================
export async function fetchMicrosoftStatus(): Promise<MicrosoftConnectionStatus> {
  const res = await fetch('/api/oauth/microsoft/status', { credentials: 'include' });
  if (!res.ok) {
    return { configured: false, connected: false };
  }
  return res.json();
}

export async function startMicrosoftOAuthPopup(): Promise<{ email?: string; displayName?: string }> {
  const res = await fetch('/api/oauth/microsoft/url', { credentials: 'include' });
  const data = (await res.json()) as { authUrl?: string; error?: string };
  if (!res.ok || !data.authUrl) {
    throw new Error(data.error || 'Microsoft 365 OAuth endpoint is unavailable.');
  }

  return new Promise((resolve, reject) => {
    const width = 520;
    const height = 660;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      data.authUrl,
      'microsoft_365_oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      reject(new Error('Pop-up blocked by browser. Please allow pop-ups to connect Microsoft 365.'));
      return;
    }

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(pollTimer);
    };

    const onMessage = (event: MessageEvent) => {
      const payload = event.data as {
        type?: string;
        email?: string;
        displayName?: string;
        error?: string;
      };
      if (!payload || typeof payload.type !== 'string') return;
      if (payload.type === 'MICROSOFT_OAUTH_SUCCESS') {
        cleanup();
        resolve({ email: payload.email, displayName: payload.displayName });
      } else if (payload.type === 'MICROSOFT_OAUTH_ERROR') {
        cleanup();
        reject(new Error(payload.error || 'Microsoft 365 authorization failed.'));
      }
    };

    const pollTimer = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        fetchMicrosoftStatus()
          .then((status) => {
            if (status.connected) {
              resolve({ email: status.email, displayName: status.displayName });
            } else {
              reject(new Error('Microsoft sign-in window closed before completing authorization.'));
            }
          })
          .catch(() => reject(new Error('Microsoft authorization cancelled.')));
      }
    }, 500);

    window.addEventListener('message', onMessage);
  });
}

export async function disconnectMicrosoftOAuth(): Promise<void> {
  await fetch('/api/oauth/microsoft/disconnect', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function executeMicrosoftPreExpiryAutomation(params: {
  officerEmail: string;
  practiceName: string;
  alert: IntakeDocumentCompletionAlert;
  schedule: PreExpiryScheduleCalculation;
  leadDays: 2 | 3;
  portalUrl: string;
}): Promise<{ msEventId?: string; msTaskListId?: string; msTaskId?: string }> {
  const res = await fetch('/api/microsoft/schedule-reminder', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      officerEmail: params.officerEmail,
      clientName: params.alert.intake.clientName,
      clientEmail: params.alert.intake.clientEmail,
      practiceName: params.practiceName,
      expiryDateIso: params.schedule.expiryDateIso,
      targetNotifyDateIso: params.schedule.targetNotifyDateIso,
      leadDaysBeforeExpiry: params.leadDays,
      outstandingItems: params.alert.outstandingItems.map((i) => `${i.label}: ${i.detail}`),
      outstandingSummary: params.alert.summaryReason,
      portalUrl: params.portalUrl,
    }),
  });

  const data = (await res.json()) as {
    msEventId?: string;
    msTaskListId?: string;
    msTaskId?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Microsoft 365 scheduling failed.');
  }
  return {
    msEventId: data.msEventId,
    msTaskListId: data.msTaskListId,
    msTaskId: data.msTaskId,
  };
}

export async function completeMicrosoftWorkflowReminders(
  workflow: Pick<OfficerReminderWorkflow, 'msEventId' | 'msTaskListId' | 'msTaskId'>
): Promise<void> {
  if (!workflow.msEventId && !workflow.msTaskId) return;
  await fetch('/api/microsoft/complete-reminder', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msEventId: workflow.msEventId,
      msTaskListId: workflow.msTaskListId,
      msTaskId: workflow.msTaskId,
    }),
  }).catch(() => {});
}

export async function sendMagicLinkViaOutlook(params: {
  toEmail: string;
  clientName?: string;
  practiceName: string;
  magicUrl: string;
}): Promise<{ senderEmail?: string }> {
  const res = await fetch('/api/microsoft/send-magic-link', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { senderEmail?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Outlook magic link dispatch failed.');
  }
  return data;
}
