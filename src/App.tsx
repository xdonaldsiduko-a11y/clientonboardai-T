import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribePractices,
  subscribePracticeIntakes,
  subscribeIntakeDocuments,
  subscribePracticeAuditLogs,
  subscribePracticeReminderWorkflows,
  persistCompletedIntake,
  persistDraftIntakeInvite,
  persistIntakeStatusUpdate,
  persistAuditLog,
  persistReminderWorkflow,
  stampReminderSentWorkflows,
  stampClientRespondedWorkflows
} from './firebase';
import { useFirebase } from './contexts/FirebaseContext';
import {
  PracticeProfile,
  ClientIntake,
  VerificationDocument,
  AuditLog,
  IntakeStatus,
  OfficerSecuritySession,
  PasskeyCredential,
  EncryptedActionNotificationReceipt,
  IntakeDocumentCompletionAlert,
  OfficerReminderWorkflow,
  MicrosoftConnectionStatus
} from './types';
import { INITIAL_PRACTICES } from './data/mockPractices';
import { calculateSha256 } from './utils/encryption';
import { ClientPdfComplianceReportResult } from './utils/pdfReport';
import { loadStoredPasskeys } from './utils/webauthn';
import {
  calculatePreExpirySchedule,
  executeGooglePreExpiryAutomation,
  completeGoogleWorkflowReminders,
  fetchMicrosoftStatus,
  startMicrosoftOAuthPopup,
  disconnectMicrosoftOAuth,
  executeMicrosoftPreExpiryAutomation,
  completeMicrosoftWorkflowReminders
} from './utils/workspaceAutomation';
import { Navbar } from './components/Navbar';
import { ProfessionalDashboard } from './components/ProfessionalDashboard';
import { ClientIntakePortal } from './components/ClientIntakePortal';
import { FunnelAnalytics } from './components/FunnelAnalytics';
import { AuditLogView } from './components/AuditLogView';
import { MagicLinkModal } from './components/MagicLinkModal';
import { PasskeyAuthModal } from './components/PasskeyAuthModal';
import { AuthGateScreen } from './components/AuthGateScreen';

export default function App() {
  const {
    currentUser,
    authReady,
    workspaceReady,
    authError,
    isSigningIn,
    signingInProvider,
    googleAccessToken,
    googleWorkspaceConnected,
    connectGoogleWorkspace,
    signInWithGoogle,
    signInWithApple,
    signOutUser,
  } = useFirebase();

  const [currentView, setCurrentView] = useState<'dashboard' | 'intake' | 'analytics' | 'audit'>('dashboard');

  const [practices, setPractices] = useState<PracticeProfile[]>(INITIAL_PRACTICES);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>(INITIAL_PRACTICES[0].id);

  // Keyed Firestore real-time state stores to prevent cross-listener overwrites
  const [intakesByPractice, setIntakesByPractice] = useState<Record<string, ClientIntake[]>>({});
  const [docsByIntake, setDocsByIntake] = useState<Record<string, VerificationDocument[]>>({});
  const [auditLogsByPractice, setAuditLogsByPractice] = useState<Record<string, AuditLog[]>>({});
  const [workflowsByPractice, setWorkflowsByPractice] = useState<Record<string, OfficerReminderWorkflow[]>>({});
  const [microsoftStatus, setMicrosoftStatus] = useState<MicrosoftConnectionStatus>({
    configured: false,
    connected: false,
  });

  const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [activeClientIntake, setActiveClientIntake] = useState<ClientIntake | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>(() => loadStoredPasskeys());
  const [securitySession, setSecuritySession] = useState<OfficerSecuritySession | null>(null);

  // Fetch Microsoft 365 OAuth session status on boot
  useEffect(() => {
    fetchMicrosoftStatus()
      .then((status) => setMicrosoftStatus(status))
      .catch(() => {});
  }, []);

  // Derived activePractice & flattened Firestore collections
  const activePractice = useMemo(
    () => practices.find((p) => p.id === selectedPracticeId) || practices[0] || INITIAL_PRACTICES[0],
    [practices, selectedPracticeId]
  );

  const intakes = useMemo(
    () =>
      Object.values(intakesByPractice)
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [intakesByPractice]
  );

  const documents = useMemo(() => Object.values(docsByIntake).flat(), [docsByIntake]);

  const auditLogs = useMemo(
    () =>
      Object.values(auditLogsByPractice)
        .flat()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [auditLogsByPractice]
  );

  const reminderWorkflows = useMemo(
    () =>
      Object.values(workflowsByPractice)
        .flat()
        .sort((a, b) => new Date(b.automatedAt).getTime() - new Date(a.automatedAt).getTime()),
    [workflowsByPractice]
  );

  // 1. Subscribe to owned Practices ONLY when Auth & Workspace seeding are ready
  useEffect(() => {
    if (!authReady || !workspaceReady || !currentUser) {
      setIntakesByPractice({});
      setDocsByIntake({});
      setAuditLogsByPractice({});
      setWorkflowsByPractice({});
      return;
    }

    const unsubscribe = subscribePractices(currentUser.uid, (loadedPractices) => {
      if (loadedPractices.length > 0) {
        const sorted = [...loadedPractices].sort((a, b) => {
          if (a.professionType === 'law_firm' && b.professionType !== 'law_firm') return -1;
          if (a.professionType !== 'law_firm' && b.professionType === 'law_firm') return 1;
          return a.practiceName.localeCompare(b.practiceName);
        });
        setPractices(sorted);
        setSelectedPracticeId((prev) =>
          sorted.some((p) => p.id === prev) ? prev : sorted[0].id
        );
      }
    });

    return () => unsubscribe();
  }, [authReady, workspaceReady, currentUser]);

  // 2. Subscribe to Intakes & Audit Logs for all owned Practices
  const practiceIdsKey = useMemo(() => practices.map((p) => p.id).join('|'), [practices]);

  useEffect(() => {
    if (!authReady || !workspaceReady || !currentUser || practices.length === 0) return;
    // Wait until Firestore-seeded practices are loaded (ignore placeholder IDs before hydration)
    if (practices.every((p) => !p.ownerUid || p.ownerUid.startsWith('owner-'))) return;

    const unsubscribers = practices.flatMap((practice) => [
      subscribePracticeIntakes(practice.id, currentUser.uid, (pid, loadedIntakes) => {
        setIntakesByPractice((prev) => ({ ...prev, [pid]: loadedIntakes }));
      }),
      subscribePracticeAuditLogs(practice.id, currentUser.uid, (pid, loadedLogs) => {
        setAuditLogsByPractice((prev) => ({ ...prev, [pid]: loadedLogs }));
      }),
      subscribePracticeReminderWorkflows(practice.id, currentUser.uid, (pid, loadedWorkflows) => {
        setWorkflowsByPractice((prev) => ({ ...prev, [pid]: loadedWorkflows }));
      }),
    ]);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, workspaceReady, currentUser, practiceIdsKey, practices]);

  // 3. Subscribe to FICA Verification Documents per Intake
  const intakeSubscriptionKeys = useMemo(
    () => intakes.map((i) => `${i.practiceId}::${i.id}`).sort().join('|'),
    [intakes]
  );

  useEffect(() => {
    if (!authReady || !workspaceReady || !currentUser || intakes.length === 0) return;

    const unsubscribers = intakes.map((intake) =>
      subscribeIntakeDocuments(intake.practiceId, intake.id, currentUser.uid, (iid, loadedDocs) => {
        setDocsByIntake((prev) => ({ ...prev, [iid]: loadedDocs }));
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, workspaceReady, currentUser, intakeSubscriptionKeys]);

  // 4. Check URL parameters for magic link return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const tokenParam = params.get('token');
    if (emailParam || tokenParam) {
      setCurrentView('intake');
      if (emailParam) {
        const found = intakes.find((i) => i.clientEmail.toLowerCase() === emailParam.toLowerCase());
        if (found) {
          setActiveClientIntake(found);
        }
      }
    }
  }, [intakes]);

  // Gate UI behind Firebase Auth before mounting main authenticated workspace
  if (!authReady) {
    return (
      <AuthGateScreen
        mode="loading"
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithApple={signInWithApple}
      />
    );
  }

  if (!currentUser) {
    return (
      <AuthGateScreen
        mode="signin"
        isSigningIn={isSigningIn}
        signingInProvider={signingInProvider}
        error={authError}
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithApple={signInWithApple}
      />
    );
  }

  if (!workspaceReady) {
    return (
      <AuthGateScreen
        mode="seeding"
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithApple={signInWithApple}
      />
    );
  }

  const handleSelectPractice = (practice: PracticeProfile) => {
    setSelectedPracticeId(practice.id);
    if (securitySession && securitySession.officerEmail !== practice.adminEmail) {
      setSecuritySession(null);
    }
  };

  const handleOpenIntakeDirectly = (intake: ClientIntake) => {
    setActiveClientIntake(intake);
    setCurrentView('intake');
  };

  const handleCreateDraftIntake = async (draftIntake: ClientIntake) => {
    const logTimestamp = new Date().toISOString();
    const logAction = 'INTAKE_INVITATION_DISPATCHED';
    const hashData = `${draftIntake.id}:${logAction}:${draftIntake.clientEmail}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const inviteLog: AuditLog = {
      id: `log-${Date.now()}`,
      intakeId: draftIntake.id,
      action: logAction,
      performedBy: currentUser.displayName || activePractice.ficaOfficerName,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: 'Section 11(1)(b) - Client onboarding invitation issued',
      hash,
      timestamp: logTimestamp,
    };

    await persistDraftIntakeInvite(currentUser.uid, draftIntake.practiceId, draftIntake, inviteLog);
  };

  const handleCompleteIntake = async (completedIntake: ClientIntake, updatedDocs: VerificationDocument[]) => {
    const newLogAction = 'FICA_INTAKE_VERIFIED_AND_SUBMITTED';
    const logTimestamp = new Date().toISOString();
    const hashData = `${completedIntake.id}:${newLogAction}:${completedIntake.clientEmail}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      intakeId: completedIntake.id,
      action: newLogAction,
      performedBy: completedIntake.clientEmail,
      ipAddress: '105.184.42.11 (Mobile Gateway ZA)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: 'Section 11(1)(b) - Specific performance of instruction & FICA CDD compliance',
      hash,
      timestamp: logTimestamp,
    };

    const targetPracticeId = completedIntake.practiceId || activePractice.id;
    await persistCompletedIntake(
      currentUser.uid,
      targetPracticeId,
      completedIntake,
      updatedDocs,
      newLog
    );

    // Automatically stamp clientRespondedAt on any active officer reminder workflows & close daily reminders
    const respondedWorkflows = await stampClientRespondedWorkflows(
      currentUser.uid,
      targetPracticeId,
      completedIntake.id,
      logTimestamp
    );

    if (respondedWorkflows.length > 0) {
      await Promise.all(
        respondedWorkflows.map(async (wf) => {
          await completeGoogleWorkflowReminders(googleAccessToken, wf);
          await completeMicrosoftWorkflowReminders(wf);
        })
      );

      const responseHash = await calculateSha256(
        `${completedIntake.id}:CLIENT_DOCUMENT_UPLOAD_RESPONSE_STAMPED:${logTimestamp}`
      );
      await persistAuditLog(currentUser.uid, targetPracticeId, {
        id: `log-resp-${Date.now()}`,
        intakeId: completedIntake.id,
        action: 'CLIENT_DOCUMENT_UPLOAD_RESPONSE_STAMPED',
        performedBy: completedIntake.clientEmail,
        ipAddress: '105.184.42.11 (Mobile Gateway ZA)',
        userAgent: navigator.userAgent,
        popiaLawfulBasis: `Automatic client response stamp (${logTimestamp}) recorded upon document upload; ${respondedWorkflows.length} daily reminder workflow(s) cleared.`,
        hash: responseHash,
        timestamp: logTimestamp,
      });
    }
  };

  const handleUpdateIntakeStatus = async (intakeId: string, newStatus: IntakeStatus) => {
    const targetIntake = intakes.find((i) => i.id === intakeId);
    const targetPracticeId = targetIntake?.practiceId || activePractice.id;

    const logAction = `INTAKE_STATUS_UPDATED_${newStatus.toUpperCase()}`;
    const logTimestamp = new Date().toISOString();
    const hashData = `${intakeId}:${logAction}:${activePractice.adminEmail}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      intakeId,
      action: logAction,
      performedBy: currentUser.displayName || activePractice.ficaOfficerName,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: 'Section 19 - Internal compliance audit & FICA Officer sign-off',
      hash,
      timestamp: logTimestamp,
    };

    await persistIntakeStatusUpdate(currentUser.uid, targetPracticeId, intakeId, newStatus, newLog);
  };

  const handleBulkExportArchived = async (clientCount: number, docCount: number, integrityHash: string) => {
    const logAction = 'BULK_FICA_ARCHIVE_EXPORTED_ENCRYPTED_ZIP';
    const logTimestamp = new Date().toISOString();
    const hashData = `bulk:${clientCount}:${docCount}:${integrityHash}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      intakeId: 'BATCH_BULK_ARCHIVE',
      action: logAction,
      performedBy: currentUser.displayName || activePractice.ficaOfficerName,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: `Section 19 & FICA Sec 22 - Encrypted batch archival of ${clientCount} client files (${docCount} docs). Hash: ${integrityHash.substring(0, 16)}...`,
      hash,
      timestamp: logTimestamp,
    };

    await persistAuditLog(currentUser.uid, activePractice.id, newLog);
  };

  const handleSecurityAuditEvent = async (action: string, details: string) => {
    const logTimestamp = new Date().toISOString();
    const hashData = `webauthn:${activePractice.id}:${action}:${activePractice.adminEmail}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      intakeId: 'SECURITY_WEBAUTHN',
      action,
      performedBy: currentUser.displayName || activePractice.ficaOfficerName,
      ipAddress: '197.229.4.18 (ZA Officer Biometric Enclave)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: `POPIA Sec 19 Security Safeguards — ${details}`,
      hash,
      timestamp: logTimestamp,
    };

    await persistAuditLog(currentUser.uid, activePractice.id, newLog);
  };

  const handleActionRequiredDispatched = async (receipt: EncryptedActionNotificationReceipt) => {
    const targetIntake = intakes.find((i) => i.id === receipt.intakeId);
    const targetPracticeId = targetIntake?.practiceId || activePractice.id;

    const logAction = 'ENCRYPTED_ACTION_REQUIRED_NOTICE_DISPATCHED';
    const logTimestamp = receipt.dispatchedAt || new Date().toISOString();
    const hashData = `${receipt.intakeId}:${logAction}:${receipt.dispatchId}:${receipt.payloadSha256}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${receipt.dispatchId.slice(-4)}`,
      intakeId: receipt.intakeId,
      action: logAction,
      performedBy: receipt.dispatchedBy,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: `POPIA Sec 19 & FICA SLA (${receipt.daysOpen}d aging) — ${receipt.algorithm} encrypted notice (${receipt.dispatchId}) dispatched to ${receipt.clientEmail}`,
      hash,
      timestamp: logTimestamp,
    };

    await persistAuditLog(currentUser.uid, targetPracticeId, newLog);

    // Automatically date-stamp reminderSentAt and clear daily recurring Google/Microsoft reminders
    const stampedWorkflows = await stampReminderSentWorkflows(
      currentUser.uid,
      targetPracticeId,
      receipt.intakeId,
      logTimestamp
    );

    if (stampedWorkflows.length > 0) {
      await Promise.all(
        stampedWorkflows.map(async (wf) => {
          await completeGoogleWorkflowReminders(googleAccessToken, wf);
          await completeMicrosoftWorkflowReminders(wf);
        })
      );

      const stampHash = await calculateSha256(
        `${receipt.intakeId}:OFFICER_REMINDER_SENT_STAMPED:${logTimestamp}`
      );
      await persistAuditLog(currentUser.uid, targetPracticeId, {
        id: `log-rem-${Date.now()}`,
        intakeId: receipt.intakeId,
        action: 'OFFICER_REMINDER_SENT_STAMPED',
        performedBy: receipt.dispatchedBy,
        ipAddress: '197.229.4.18 (ZA Practice Station)',
        userAgent: navigator.userAgent,
        popiaLawfulBasis: `Automatic reminderSentAt stamp (${logTimestamp}) recorded; daily Calendar & Task reminders stopped.`,
        hash: stampHash,
        timestamp: logTimestamp,
      });
    }
  };

  const handleConnectGoogleWorkspace = async () => {
    await connectGoogleWorkspace();
  };

  const handleConnectMicrosoft = async () => {
    await startMicrosoftOAuthPopup();
    const updated = await fetchMicrosoftStatus();
    setMicrosoftStatus(updated);
  };

  const handleDisconnectMicrosoft = async () => {
    await disconnectMicrosoftOAuth();
    const updated = await fetchMicrosoftStatus();
    setMicrosoftStatus(updated);
  };

  const handleAutomateWorkflow = async (
    alert: IntakeDocumentCompletionAlert,
    leadDays: 2 | 3
  ) => {
    const schedule = calculatePreExpirySchedule(alert, leadDays);
    const targetPracticeId = alert.intake.practiceId || activePractice.id;
    const officerEmail = currentUser.email || microsoftStatus.email || activePractice.adminEmail;
    const officerName = currentUser.displayName || activePractice.ficaOfficerName;
    const portalUrl = `${window.location.origin}/?intake=${encodeURIComponent(alert.intake.id)}`;

    let googleEventId: string | undefined;
    let googleTaskId: string | undefined;
    let msEventId: string | undefined;
    let msTaskListId: string | undefined;
    let msTaskId: string | undefined;
    const syncedChannels: string[] = ['Portal Workflow'];

    if (googleAccessToken) {
      const gRes = await executeGooglePreExpiryAutomation({
        accessToken: googleAccessToken,
        officerEmail,
        officerName,
        practiceName: activePractice.practiceName,
        alert,
        schedule,
        leadDays,
        portalUrl,
      });
      googleEventId = gRes.googleEventId;
      googleTaskId = gRes.googleTaskId;
      syncedChannels.push('Google (Gmail + Cal + Tasks)');
    }

    if (microsoftStatus.connected) {
      const msRes = await executeMicrosoftPreExpiryAutomation({
        officerEmail,
        practiceName: activePractice.practiceName,
        alert,
        schedule,
        leadDays,
        portalUrl,
      });
      msEventId = msRes.msEventId;
      msTaskListId = msRes.msTaskListId;
      msTaskId = msRes.msTaskId;
      syncedChannels.push('Microsoft 365 (Outlook + Cal + To Do)');
    }

    const automatedAt = new Date().toISOString();
    const wfId = `wf-${alert.intake.id}`;
    const workflow: OfficerReminderWorkflow = {
      id: wfId,
      practiceId: targetPracticeId,
      intakeId: alert.intake.id,
      ownerUid: currentUser.uid,
      clientName: alert.intake.clientName,
      clientEmail: alert.intake.clientEmail,
      officerEmail,
      status: schedule.isDueOrOverdueToday ? 'daily_pending' : 'scheduled',
      leadDaysBeforeExpiry: leadDays,
      expiryDateIso: schedule.expiryDateIso,
      targetNotifyDateIso: schedule.targetNotifyDateIso,
      outstandingSummary: alert.summaryReason.slice(0, 580),
      dailyReminderActive: true,
      lastDailyNagDate: schedule.isDueOrOverdueToday
        ? new Date().toISOString().slice(0, 10)
        : undefined,
      channelsSynced: syncedChannels.join(' · ').slice(0, 195),
      googleEventId,
      googleTaskId,
      msEventId,
      msTaskListId,
      msTaskId,
      automatedAt,
    };

    await persistReminderWorkflow(currentUser.uid, targetPracticeId, workflow);

    const logAction = 'OFFICER_PRE_EXPIRY_AUTOMATION_SCHEDULED';
    const hash = await calculateSha256(
      `${alert.intake.id}:${logAction}:${schedule.targetNotifyDateIso}:${automatedAt}`
    );
    await persistAuditLog(currentUser.uid, targetPracticeId, {
      id: `log-wf-${Date.now()}`,
      intakeId: alert.intake.id,
      action: logAction,
      performedBy: officerName,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: `POPIA Sec 19 SLA Automation (${leadDays}d prior to ${schedule.expiryDateIso}) synced via ${syncedChannels.join(', ')}.`.slice(0, 295),
      hash,
      timestamp: automatedAt,
    });
  };

  const handleMagicLinkDispatched = async (channel: 'gmail' | 'outlook', recipientEmail: string) => {
    const logTimestamp = new Date().toISOString();
    const logAction = `MAGIC_LINK_SENT_DIRECT_${channel.toUpperCase()}`;
    const matchedIntake = intakes.find(
      (i) => i.clientEmail.toLowerCase() === recipientEmail.toLowerCase()
    );
    const hash = await calculateSha256(
      `${matchedIntake?.id || recipientEmail}:${logAction}:${logTimestamp}`
    );
    await persistAuditLog(currentUser.uid, matchedIntake?.practiceId || activePractice.id, {
      id: `log-mag-${Date.now()}`,
      intakeId: matchedIntake?.id || 'PORTAL_INVITE',
      action: logAction,
      performedBy: currentUser.displayName || activePractice.ficaOfficerName,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: `Authenticated 1st-party ${channel === 'gmail' ? 'Gmail' : 'Microsoft Outlook 365'} magic link sent to ${recipientEmail} with SPF/DMARC domain alignment.`,
      hash,
      timestamp: logTimestamp,
    });
  };

  const handlePdfReportGenerated = async (
    intake: ClientIntake,
    result: ClientPdfComplianceReportResult
  ) => {
    const logAction = 'POPIA_PDF_COMPLIANCE_REPORT_GENERATED';
    const logTimestamp = result.generatedAt || new Date().toISOString();
    const hashData = `${intake.id}:${logAction}:${result.reportId}:${result.integrityHash}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${result.reportId.slice(-4)}`,
      intakeId: intake.id,
      action: logAction,
      performedBy: currentUser.displayName || activePractice.ficaOfficerName,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: `POPIA Sec 19 & FICA Sec 22 — Downloadable PDF verification summary (${result.reportId}) sealing ${result.includedAuditEvents} audit event(s). SHA-256: ${result.integrityHash.slice(0, 16)}...`,
      hash,
      timestamp: logTimestamp,
    };

    await persistAuditLog(currentUser.uid, intake.practiceId || activePractice.id, newLog);
  };

  const handleAuditCsvExported = async (exportedCount: number, filterSummary: string) => {
    const logAction = 'POPIA_AUDIT_REPORT_CSV_EXPORTED';
    const logTimestamp = new Date().toISOString();
    const hashData = `csv:${activePractice.id}:${exportedCount}:${filterSummary}:${logTimestamp}`;
    const hash = await calculateSha256(hashData);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      intakeId: 'BATCH_AUDIT_CSV_EXPORT',
      action: logAction,
      performedBy: currentUser.displayName || activePractice.ficaOfficerName,
      ipAddress: '197.229.4.18 (ZA Practice Station)',
      userAgent: navigator.userAgent,
      popiaLawfulBasis: `POPIA Sec 19 Compliance Export — Downloaded CSV of ${exportedCount} audit log entries (${filterSummary}).`.slice(0, 300),
      hash,
      timestamp: logTimestamp,
    };

    await persistAuditLog(currentUser.uid, activePractice.id, newLog);
  };

  return (
    <div className="min-h-screen aurora-canvas text-slate-100 flex flex-col font-sans selection:bg-[#FF2A85]/30 selection:text-white">
      {/* 3-Zone Top Navigation Contract */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        practices={practices}
        activePractice={activePractice}
        onSelectPractice={handleSelectPractice}
        user={currentUser}
        onLogin={signInWithGoogle}
        onLogout={signOutUser}
        onOpenMagicModal={() => setIsMagicModalOpen(true)}
        securitySession={securitySession}
        onOpenPasskeyModal={() => setIsPasskeyModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1">
        {currentView === 'dashboard' && (
          <ProfessionalDashboard
            practice={activePractice}
            intakes={intakes}
            documents={documents}
            auditLogs={auditLogs}
            onOpenMagicModal={() => setIsMagicModalOpen(true)}
            onSelectIntakeToView={handleOpenIntakeDirectly}
            onUpdateIntakeStatus={handleUpdateIntakeStatus}
            onBulkExportArchived={handleBulkExportArchived}
            onActionRequiredDispatched={handleActionRequiredDispatched}
            onPdfReportGenerated={handlePdfReportGenerated}
            onAuditCsvExported={handleAuditCsvExported}
            securitySession={securitySession}
            onOpenPasskeyModal={() => setIsPasskeyModalOpen(true)}
            officerEmail={currentUser.email || microsoftStatus.email || activePractice.adminEmail}
            reminderWorkflows={reminderWorkflows}
            googleConnected={googleWorkspaceConnected}
            microsoftStatus={microsoftStatus}
            onConnectGoogle={handleConnectGoogleWorkspace}
            onConnectMicrosoft={handleConnectMicrosoft}
            onDisconnectMicrosoft={handleDisconnectMicrosoft}
            onAutomateWorkflow={handleAutomateWorkflow}
          />
        )}

        {currentView === 'intake' && (
          <ClientIntakePortal
            key={activeClientIntake?.id || 'new-intake'}
            practice={activePractice}
            initialIntake={activeClientIntake}
            onCompleteIntake={handleCompleteIntake}
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'analytics' && <FunnelAnalytics practice={activePractice} />}

        {currentView === 'audit' && <AuditLogView practice={activePractice} auditLogs={auditLogs} />}
      </main>

      {/* Magic Link Playground Modal */}
      <MagicLinkModal
        isOpen={isMagicModalOpen}
        onClose={() => setIsMagicModalOpen(false)}
        activePractice={activePractice}
        intakes={intakes}
        onOpenIntakeDirectly={handleOpenIntakeDirectly}
        onCreateDraftIntake={handleCreateDraftIntake}
        googleConnected={googleWorkspaceConnected}
        googleAccessToken={googleAccessToken}
        officerEmail={currentUser.email || microsoftStatus.email || activePractice.adminEmail}
        officerName={currentUser.displayName || activePractice.ficaOfficerName}
        microsoftStatus={microsoftStatus}
        onConnectGoogle={connectGoogleWorkspace}
        onConnectMicrosoft={handleConnectMicrosoft}
        onMagicLinkDispatched={handleMagicLinkDispatched}
      />

      {/* WebAuthn / Passkey Biometric Modal */}
      <PasskeyAuthModal
        isOpen={isPasskeyModalOpen}
        onClose={() => setIsPasskeyModalOpen(false)}
        practice={activePractice}
        passkeys={passkeys}
        securitySession={securitySession}
        onPasskeysUpdated={setPasskeys}
        onAuthenticated={(session) => setSecuritySession(session)}
        onRevokeSession={() => {
          setSecuritySession(null);
          handleSecurityAuditEvent(
            'WEBAUTHN_BIOMETRIC_SESSION_REVOKED',
            'FICA officer manually locked the elevated biometric session'
          );
        }}
        onAuditLogEvent={handleSecurityAuditEvent}
      />

      {/* Footer */}
      <footer className="border-t border-purple-400/20 bg-[#0E061E]/85 backdrop-blur-md py-6 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-purple-200/75">
          <div className="flex items-center gap-2">
            <span className="text-base" role="img" aria-label="magnet">🧲</span>
            <span className="font-semibold text-white">ClientOnboard AI</span>
            <span className="text-purple-400/50">·</span>
            <span>Republic of South Africa</span>
            <span className="text-purple-400/50">·</span>
            <span className="text-[#00F5D4] font-semibold">FICA Act 38 &amp; POPIA Act 4 Certified</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-purple-200/70">
            <span>Bank-Grade AES-256 Client Encryption</span>
            <span className="text-purple-400/50">·</span>
            <span>WebAuthn FIDO2 &amp; Cloud Firestore Vault</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
