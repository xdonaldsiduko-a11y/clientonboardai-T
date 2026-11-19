import React, { useMemo, useState } from 'react';
import {
  Siren,
  CheckCircle2,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lock,
  Copy,
  Check,
  FileSearch,
  MailCheck,
  FileWarning,
  Clock,
  MessageSquarePlus,
  CalendarClock,
  CalendarPlus,
  BellRing,
  X,
  Mail,
  ListTodo
} from 'lucide-react';
import {
  ClientIntake,
  VerificationDocument,
  EncryptedActionNotificationReceipt,
  IntakeDocumentCompletionAlert,
  OfficerReminderWorkflow,
  MicrosoftConnectionStatus
} from '../types';
import {
  getEmergencyOutstandingIntakes,
  buildOutstandingReminderText
} from '../utils/sa-fica';
import { calculatePreExpirySchedule } from '../utils/workspaceAutomation';

type EmergencyFilterMode = 'all' | 'stalled_7d' | 'overdue_critical' | 'countdown_soon';

interface AgingIntakeAlertProps {
  practiceName: string;
  officerEmail: string;
  intakes: ClientIntake[];
  documents: VerificationDocument[];
  sendingIntakeIds: string[];
  dispatchedReceipts: Record<string, EncryptedActionNotificationReceipt>;
  reminderWorkflows: OfficerReminderWorkflow[];
  googleConnected: boolean;
  microsoftStatus: MicrosoftConnectionStatus;
  onConnectGoogle: () => Promise<void>;
  onConnectMicrosoft: () => Promise<void>;
  onDisconnectMicrosoft: () => Promise<void>;
  onAutomateWorkflow: (
    alert: IntakeDocumentCompletionAlert,
    leadDays: 2 | 3
  ) => Promise<void>;
  onDispatchReengagement: (
    alert: IntakeDocumentCompletionAlert,
    customNote?: string
  ) => Promise<void>;
  onSelectIntake: (intake: ClientIntake) => void;
}

function formatStamp(iso?: string): string {
  if (!iso) return 'Pending';
  try {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return iso;
    return dt.toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AgingIntakeAlert: React.FC<AgingIntakeAlertProps> = ({
  practiceName,
  officerEmail,
  intakes,
  documents,
  sendingIntakeIds,
  dispatchedReceipts,
  reminderWorkflows,
  googleConnected,
  microsoftStatus,
  onConnectGoogle,
  onConnectMicrosoft,
  onDisconnectMicrosoft,
  onAutomateWorkflow,
  onDispatchReengagement,
  onSelectIntake,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<EmergencyFilterMode>('all');
  const [isBatchDispatching, setIsBatchDispatching] = useState<boolean>(false);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [editingNoteIntakeId, setEditingNoteIntakeId] = useState<string | null>(null);
  const [customNotesByIntake, setCustomNotesByIntake] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [leadDays, setLeadDays] = useState<2 | 3>(2);
  const [confirmAlert, setConfirmAlert] = useState<IntakeDocumentCompletionAlert | null>(null);
  const [isScheduling, setIsScheduling] = useState<boolean>(false);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
  const [workspaceConnectBusy, setWorkspaceConnectBusy] = useState<'google' | 'ms' | null>(null);

  const workflowsByIntake = useMemo(() => {
    const map: Record<string, OfficerReminderWorkflow> = {};
    for (const wf of reminderWorkflows) {
      const prev = map[wf.intakeId];
      if (!prev || new Date(wf.automatedAt).getTime() >= new Date(prev.automatedAt).getTime()) {
        map[wf.intakeId] = wf;
      }
    }
    return map;
  }, [reminderWorkflows]);

  const activeDailyNagWorkflows = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return reminderWorkflows.filter(
      (wf) =>
        wf.dailyReminderActive &&
        !wf.reminderSentAt &&
        !wf.clientRespondedAt &&
        wf.targetNotifyDateIso <= todayStr
    );
  }, [reminderWorkflows]);

  const allEmergencyAlerts = useMemo(
    () => getEmergencyOutstandingIntakes(intakes, documents),
    [intakes, documents]
  );

  const filteredAlerts = useMemo(() => {
    switch (filterMode) {
      case 'stalled_7d':
        return allEmergencyAlerts.filter((a) => a.exceeds7DaysWithoutDocs);
      case 'overdue_critical':
        return allEmergencyAlerts.filter(
          (a) =>
            a.slaDaysOverdue > 0 ||
            a.outstandingItems.some((item) => item.issue === 'expired' || item.issue === 'rejected')
        );
      case 'countdown_soon':
        return allEmergencyAlerts.filter(
          (a) =>
            (a.slaDaysRemaining > 0 && a.slaDaysRemaining <= 10) ||
            (a.earliestDocDaysRemaining !== null &&
              a.earliestDocDaysRemaining > 0 &&
              a.earliestDocDaysRemaining <= 15)
        );
      default:
        return allEmergencyAlerts;
    }
  }, [allEmergencyAlerts, filterMode]);

  const criticalCount = useMemo(
    () =>
      allEmergencyAlerts.filter(
        (a) =>
          a.slaDaysOverdue > 0 ||
          a.outstandingItems.some((item) => item.issue === 'expired' || item.issue === 'rejected')
      ).length,
    [allEmergencyAlerts]
  );

  const stalled7dCount = useMemo(
    () => allEmergencyAlerts.filter((a) => a.exceeds7DaysWithoutDocs).length,
    [allEmergencyAlerts]
  );

  const countdownSoonCount = useMemo(
    () =>
      allEmergencyAlerts.filter(
        (a) =>
          (a.slaDaysRemaining > 0 && a.slaDaysRemaining <= 10) ||
          (a.earliestDocDaysRemaining !== null &&
            a.earliestDocDaysRemaining > 0 &&
            a.earliestDocDaysRemaining <= 15)
      ).length,
    [allEmergencyAlerts]
  );

  const minDaysLeftPositive = useMemo(() => {
    const remainingPool: number[] = [];
    allEmergencyAlerts.forEach((a) => {
      if (a.slaDaysOverdue === 0) remainingPool.push(a.slaDaysRemaining);
      if (a.earliestDocDaysRemaining !== null && a.earliestDocDaysRemaining > 0) {
        remainingPool.push(a.earliestDocDaysRemaining);
      }
    });
    return remainingPool.length > 0 ? Math.min(...remainingPool) : 0;
  }, [allEmergencyAlerts]);

  const pendingDispatchAlerts = useMemo(
    () => filteredAlerts.filter((item) => !dispatchedReceipts[item.intake.id]),
    [filteredAlerts, dispatchedReceipts]
  );

  const handleBatchDispatch = async () => {
    if (pendingDispatchAlerts.length === 0 || isBatchDispatching) return;
    setIsBatchDispatching(true);
    try {
      for (const alert of pendingDispatchAlerts) {
        await onDispatchReengagement(alert, customNotesByIntake[alert.intake.id]);
      }
    } finally {
      setIsBatchDispatching(false);
    }
  };

  const handleConfirmScheduleAutomation = async () => {
    if (!confirmAlert || isScheduling) return;
    setIsScheduling(true);
    setWorkspaceActionError(null);
    try {
      await onAutomateWorkflow(confirmAlert, leadDays);
      setConfirmAlert(null);
    } catch (err) {
      setWorkspaceActionError(
        err instanceof Error ? err.message : 'Unable to execute workspace reminder automation.'
      );
    } finally {
      setIsScheduling(false);
    }
  };

  const handleConnectGoogleClick = async () => {
    setWorkspaceConnectBusy('google');
    setWorkspaceActionError(null);
    try {
      await onConnectGoogle();
    } catch (err) {
      setWorkspaceActionError(err instanceof Error ? err.message : 'Google connect cancelled.');
    } finally {
      setWorkspaceConnectBusy(null);
    }
  };

  const handleConnectMsClick = async () => {
    setWorkspaceConnectBusy('ms');
    setWorkspaceActionError(null);
    try {
      await onConnectMicrosoft();
    } catch (err) {
      setWorkspaceActionError(err instanceof Error ? err.message : 'Microsoft 365 connect failed.');
    } finally {
      setWorkspaceConnectBusy(null);
    }
  };

  const handleCopyText = async (text: string, copyKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(copyKey);
      setTimeout(() => setCopiedId(null), 3000);
    } catch {
      // Clipboard fallback unavailable
    }
  };

  const formatClientTypeLabel = (clientType: ClientIntake['clientType']) => {
    if (clientType === 'company') return 'Corporate Entity';
    if (clientType === 'trust') return 'Trust / FID';
    return 'Individual';
  };

  const confirmSchedulePreview = confirmAlert
    ? calculatePreExpirySchedule(confirmAlert, leadDays)
    : null;

  if (allEmergencyAlerts.length === 0 && reminderWorkflows.length === 0) {
    return (
      <section
        aria-label="Emergency Outstanding Documents Status"
        className="synth-glass p-4 sm:px-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-[#00F5D4] shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white">Emergency Outstanding Documents</span>
            <span className="text-purple-400/50" aria-hidden="true">·</span>
            <span className="text-purple-200/80">
              All active clients have valid FICA documents within SLA &amp; 90-day limits
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-[#00F5D4] whitespace-nowrap">
          0 outstanding docs
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label="Emergency Outstanding Documents & SLA Countdown"
      className={`synth-glass p-5 sm:p-6 rounded-3xl space-y-4 ${
        criticalCount > 0 ? 'glow-magenta' : 'glow-amber'
      }`}
    >
      {/* Top Emergency Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Siren className={`w-5 h-5 shrink-0 ${criticalCount > 0 ? 'text-[#FF2A85]' : 'text-[#FFE600]'}`} />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Emergency Outstanding Documents &amp; SLA Countdown
            </h2>
          </div>
          <p className="text-xs text-purple-200/80">
            <span className="text-[#FF2A85] font-bold font-mono tabular-nums">
              {allEmergencyAlerts.length} client{allEmergencyAlerts.length !== 1 ? 's' : ''}
            </span>{' '}
            with outstanding or expiring FICA documents
            <span className="text-purple-400/50" aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums text-[#FFE600]">
              {criticalCount} critical/overdue
            </span>
            <span className="text-purple-400/50" aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums text-purple-100">
              Shortest deadline: {minDaysLeftPositive}d left
            </span>
            <span className="text-purple-400/50" aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums text-[#00F5D4]">
              {allEmergencyAlerts.length - pendingDispatchAlerts.length}/{filteredAlerts.length} reminded
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {pendingDispatchAlerts.length > 0 && (
            <button
              type="button"
              disabled={isBatchDispatching}
              onClick={handleBatchDispatch}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 shadow-[0_0_22px_-4px_rgba(255,42,133,0.55)] active:scale-95 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {isBatchDispatching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending Reminders...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Send Outstanding Docs Reminder ({pendingDispatchAlerts.length})
                  </span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold text-purple-100 synth-inset border border-purple-400/20 hover:border-purple-300/40 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-purple-300" />
                <span>Minimize</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-[#FFE600]" />
                <span>Inspect {allEmergencyAlerts.length} Urgent</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Connected Google Workspace & Microsoft 365 Officer Automation Bar */}
      <div className="p-3.5 synth-inset rounded-2xl border border-purple-400/20 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <CalendarPlus className="w-4 h-4 text-[#00F5D4] shrink-0" />
            <span>Pre-Expiry Officer Sync:</span>
          </div>

          <div className="inline-flex items-center rounded-xl bg-[#0B0518]/80 border border-purple-400/20 p-0.5">
            {([2, 3] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setLeadDays(days)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  leadDays === days
                    ? 'bg-[#00F5D4]/20 text-[#00F5D4] border border-[#00F5D4]/45'
                    : 'text-purple-200/70 hover:text-white'
                }`}
              >
                {days}d Before Expiry
              </button>
            ))}
          </div>

          <span className="text-[11px] text-purple-200/70">
            Emails <strong className="text-white font-mono">{officerEmail}</strong> + daily Calendar &amp; Tasks nag
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Google Workspace Connection */}
          {googleConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-[#00F5D4] bg-[#00F5D4]/12 border border-[#00F5D4]/35 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Google Connected (Gmail · Cal · Tasks)</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={workspaceConnectBusy === 'google'}
              onClick={handleConnectGoogleClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white synth-inset border border-purple-400/30 hover:border-[#4CC9F0]/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Mail className="w-3.5 h-3.5 text-[#4CC9F0]" />
              <span>
                {workspaceConnectBusy === 'google'
                  ? 'Connecting Google...'
                  : 'Connect Google Workspace'}
              </span>
            </button>
          )}

          {/* Microsoft 365 Connection */}
          {microsoftStatus.connected ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold text-[#4CC9F0] bg-[#4CC9F0]/12 border border-[#4CC9F0]/40 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Microsoft 365 ({microsoftStatus.email || 'Outlook · Cal · To Do'})</span>
              <button
                type="button"
                onClick={onDisconnectMicrosoft}
                className="text-[10px] text-purple-200/75 hover:text-white underline cursor-pointer ml-1"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={workspaceConnectBusy === 'ms'}
              onClick={handleConnectMsClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white synth-inset border border-[#4CC9F0]/35 hover:border-[#00F5D4]/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CalendarClock className="w-3.5 h-3.5 text-[#4CC9F0]" />
              <span>
                {workspaceConnectBusy === 'ms'
                  ? 'Connecting Outlook...'
                  : microsoftStatus.configured
                    ? 'Connect Microsoft 365 (Outlook/To Do)'
                    : 'Connect Microsoft 365'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Active Daily Officer Nag Banner */}
      {activeDailyNagWorkflows.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#FF2A85]/14 border border-[#FF2A85]/45 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-start sm:items-center gap-2 text-rose-100">
            <BellRing className="w-4 h-4 text-[#FF2A85] shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
            <div>
              <strong className="text-white">
                Daily Action Pending ({activeDailyNagWorkflows.length}):
              </strong>{' '}
              Scheduled pre-expiry reminders due today for{' '}
              <span className="font-semibold text-[#FFE600]">
                {activeDailyNagWorkflows.map((w) => w.clientName).join(', ')}
              </span>
              . Daily Calendar &amp; Task nagging stops automatically once you click &ldquo;Send Reminder&rdquo;.
            </div>
          </div>
        </div>
      )}

      {workspaceActionError && (
        <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-400/45 text-xs text-rose-100 flex items-center justify-between gap-2">
          <span>{workspaceActionError}</span>
          <button
            type="button"
            onClick={() => setWorkspaceActionError(null)}
            className="text-rose-200 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Emergency Triage Filter Tabs */}
      {isExpanded && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'all' as const, label: 'All Outstanding', count: allEmergencyAlerts.length },
            { id: 'stalled_7d' as const, label: '>7d Stalled Incomplete', count: stalled7dCount },
            { id: 'overdue_critical' as const, label: 'Expired / Past 30d SLA', count: criticalCount },
            { id: 'countdown_soon' as const, label: 'Days Left <= 15d', count: countdownSoonCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === tab.id
                  ? 'bg-[#FF2A85]/20 text-white border border-[#FF2A85]/55'
                  : 'synth-inset text-purple-200/75 hover:text-white border border-purple-400/15'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono tabular-nums text-[10px] text-[#00F5D4]">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Hairline-separated Triage Queue */}
      {isExpanded && (
        <div className="divide-y divide-purple-400/15 border-t border-purple-400/15 pt-1">
          {filteredAlerts.length === 0 ? (
            <div className="py-4 text-xs text-purple-200/75">
              No clients match the selected emergency filter. Switch to &ldquo;All Outstanding&rdquo; to view all urgent cases.
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const {
                intake,
                daysOpen,
                slaDaysRemaining,
                slaDaysOverdue,
                earliestDocDaysRemaining,
                completedDocsCount,
                requiredDocsCount,
                outstandingItems,
              } = alert;

              const isSending = sendingIntakeIds.includes(intake.id) || isBatchDispatching;
              const receipt = dispatchedReceipts[intake.id];
              const isReceiptOpen = expandedReceiptId === intake.id && Boolean(receipt);
              const isEditingNote = editingNoteIntakeId === intake.id;
              const customNote = customNotesByIntake[intake.id] || '';
              const liveReminderPreview = buildOutstandingReminderText(
                practiceName,
                alert,
                customNote
              );
              const workflow = workflowsByIntake[intake.id];

              return (
                <div key={intake.id} className="py-4 first:pt-3 last:pb-0 space-y-3">
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Identity & Elapsed / Countdown Line */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => onSelectIntake(intake)}
                          className="font-bold text-white hover:text-[#00F5D4] transition-colors cursor-pointer text-left truncate max-w-xs sm:max-w-sm"
                        >
                          {intake.clientName}
                        </button>
                        <span className="text-purple-400/50" aria-hidden="true">·</span>
                        <span className="text-purple-200/75">{formatClientTypeLabel(intake.clientType)}</span>
                        <span className="text-purple-400/50" aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] text-purple-200/70 truncate">
                          {intake.clientEmail}
                        </span>
                      </div>

                      {/* Days Open & Days Left Countdown Strip */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1.5 text-purple-100">
                          <Clock className="w-3.5 h-3.5 text-[#4CC9F0]" />
                          <span>
                            Open: <strong className="text-white">{daysOpen}d</strong>
                          </span>
                        </span>

                        <span className={slaDaysOverdue > 0 ? 'text-[#FF2A85] font-bold' : 'text-[#FFE600] font-bold'}>
                          {slaDaysOverdue > 0
                            ? `30d SLA: 0d left (+${slaDaysOverdue}d overdue)`
                            : `30d SLA: ${slaDaysRemaining}d left`}
                        </span>

                        {earliestDocDaysRemaining !== null && (
                          <span
                            className={
                              earliestDocDaysRemaining <= 0
                                ? 'text-[#FF2A85] font-bold'
                                : earliestDocDaysRemaining < 30
                                  ? 'text-[#FFE600] font-semibold'
                                  : 'text-[#00F5D4]'
                            }
                          >
                            {earliestDocDaysRemaining <= 0
                              ? `Doc Validity: Expired (${Math.abs(earliestDocDaysRemaining)}d ago)`
                              : `Doc Refresh: ${earliestDocDaysRemaining}d left`}
                          </span>
                        )}

                        <span className="text-purple-200/75">
                          Ready: <strong className="text-white">{completedDocsCount}/{requiredDocsCount} docs</strong>
                        </span>
                      </div>

                      {/* Itemized Current Outstanding Documents List */}
                      <div className="space-y-1 pt-0.5">
                        {outstandingItems.map((item, idx) => (
                          <div
                            key={`${intake.id}-${item.docType}-${idx}`}
                            className="flex flex-wrap items-center gap-2 text-[11px] text-purple-100/90"
                          >
                            <FileWarning
                              className={`w-3.5 h-3.5 shrink-0 ${
                                item.issue === 'expired' || item.issue === 'missing' || item.issue === 'rejected'
                                  ? 'text-[#FF2A85]'
                                  : 'text-[#FFE600]'
                              }`}
                            />
                            <span className="font-semibold text-white">{item.label}</span>
                            <span className="text-purple-400/50" aria-hidden="true">—</span>
                            <span
                              className={
                                item.issue === 'expired' || item.issue === 'missing' || item.issue === 'rejected'
                                  ? 'text-[#FF9EBB]'
                                  : 'text-[#FFF099]'
                              }
                            >
                              {item.detail}
                            </span>
                            {item.fileName && (
                              <>
                                <span className="text-purple-400/40" aria-hidden="true">·</span>
                                <span className="font-mono text-[10px] text-purple-300/65 truncate max-w-[220px]">
                                  {item.fileName}
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Automatic Date-Stamped Officer Reminder & Client Upload Lifecycle Strip */}
                      {workflow && (
                        <div className="p-2.5 rounded-xl bg-[#0B0518]/75 border border-[#4CC9F0]/25 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#4CC9F0]">
                            <ListTodo className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Synced ({workflow.leadDaysBeforeExpiry}d prior: {workflow.targetNotifyDateIso}) via {workflow.channelsSynced}
                            </span>
                          </span>
                          <span className="font-mono tabular-nums text-purple-200/80">
                            Automated: <strong className="text-white">{formatStamp(workflow.automatedAt)}</strong>
                          </span>
                          <span className="font-mono tabular-nums">
                            {workflow.reminderSentAt ? (
                              <span className="text-[#00F5D4] font-semibold">
                                Reminder Sent: {formatStamp(workflow.reminderSentAt)}
                              </span>
                            ) : (
                              <span className="text-[#FFE600] font-semibold">
                                Reminder Pending ({workflow.dailyReminderActive ? 'Daily Cal/Task Active' : 'Scheduled'})
                              </span>
                            )}
                          </span>
                          <span className="font-mono tabular-nums">
                            {workflow.clientRespondedAt ? (
                              <span className="text-[#00F5D4] font-bold">
                                Client Responded (Docs Uploaded): {formatStamp(workflow.clientRespondedAt)}
                              </span>
                            ) : (
                              <span className="text-purple-300/70">
                                Client Upload Stamp: Awaiting upload
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceActionError(null);
                          setConfirmAlert(alert);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#00F5D4] synth-inset border border-[#00F5D4]/40 hover:bg-[#00F5D4]/12 transition-colors cursor-pointer whitespace-nowrap"
                        title={`Schedule officer alert ${leadDays} days before expiry in Google & Microsoft Calendar/Tasks`}
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>{workflow ? `Re-Sync (${leadDays}d Prior)` : `Automate Alert (${leadDays}d Prior)`}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingNoteIntakeId(isEditingNote ? null : intake.id)
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap border ${
                          isEditingNote
                            ? 'bg-[#9D4EDD]/20 border-[#9D4EDD]/60 text-white'
                            : 'synth-inset border-purple-400/20 text-purple-100 hover:border-purple-300/45'
                        }`}
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5 text-[#4CC9F0]" />
                        <span>{isEditingNote ? 'Hide Message' : 'Preview / Note'}</span>
                      </button>

                      {receipt ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReceiptId(isReceiptOpen ? null : intake.id)
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#00F5D4] bg-[#00F5D4]/12 border border-[#00F5D4]/45 hover:bg-[#00F5D4]/20 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <MailCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>Reminder Sent ({receipt.dispatchId})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => onDispatchReengagement(alert, customNote)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 shadow-[0_0_18px_-4px_rgba(255,42,133,0.5)] active:scale-95 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          {isSending ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Encrypting Reminder...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>
                                Send Reminder ({outstandingItems.length} Doc{outstandingItems.length !== 1 ? 's' : ''})
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectIntake(intake)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-purple-100 synth-inset border border-purple-400/20 hover:border-purple-300/45 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <FileSearch className="w-3.5 h-3.5 text-purple-300" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable Live Reminder Preview & Custom Officer Note Composer */}
                  {isEditingNote && (
                    <div className="p-3.5 synth-inset rounded-xl border border-[#4CC9F0]/35 space-y-2.5 text-xs animate-in fade-in duration-150">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[#4CC9F0]">
                          Reminder Payload Preview (Current Outstanding Docs Included)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(liveReminderPreview, `preview-${intake.id}`)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00F5D4] hover:underline cursor-pointer"
                        >
                          {copiedId === `preview-${intake.id}` ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied Reminder Text</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Reminder Text</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="p-3 rounded-lg bg-[#0B0518]/80 border border-purple-400/20 text-[11px] font-mono text-purple-100 whitespace-pre-wrap leading-relaxed">
                        {liveReminderPreview}
                      </pre>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={customNote}
                          onChange={(e) =>
                            setCustomNotesByIntake((prev) => ({
                              ...prev,
                              [intake.id]: e.target.value,
                            }))
                          }
                          placeholder="Optional officer note (e.g. Please upload fresh municipal account via magic link before Friday)..."
                          className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0B0518]/85 border border-purple-400/25 text-white placeholder:text-purple-300/45 focus:outline-none focus:border-[#00F5D4]"
                        />
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => onDispatchReengagement(alert, customNote)}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] hover:opacity-95 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          {isSending ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>{receipt ? 'Re-Send With Note' : 'Dispatch With Note'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Sent Receipt Showing Outstanding Docs Dispatched */}
                  {isReceiptOpen && receipt && (
                    <div className="p-3.5 synth-inset rounded-xl border border-[#00F5D4]/30 text-[11px] space-y-2 animate-in fade-in duration-150">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-purple-200/85">
                        <div className="flex flex-wrap items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
                          <span className="font-semibold text-[#00F5D4]">{receipt.algorithm}</span>
                          <span className="text-purple-400/50" aria-hidden="true">·</span>
                          <span>
                            Sent to <strong className="text-white">{receipt.clientEmail}</strong>
                          </span>
                          <span className="text-purple-400/50" aria-hidden="true">·</span>
                          <span className="font-mono text-[10px] text-purple-300/75">
                            Key {receipt.keyFingerprint} · {new Date(receipt.dispatchedAt).toLocaleTimeString('en-ZA')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {receipt.reminderSummary && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(receipt.reminderSummary!, `msg-${receipt.dispatchId}`)}
                              className="inline-flex items-center gap-1 text-[#4CC9F0] font-bold hover:underline cursor-pointer whitespace-nowrap"
                            >
                              {copiedId === `msg-${receipt.dispatchId}` ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Reminder Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Sent Reminder</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyText(receipt.magicResumeUrl, `link-${receipt.dispatchId}`)}
                            className="inline-flex items-center gap-1 text-[#00F5D4] font-bold hover:underline cursor-pointer whitespace-nowrap"
                          >
                            {copiedId === `link-${receipt.dispatchId}` ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Link Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Secure Resume Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {receipt.outstandingDocuments && receipt.outstandingDocuments.length > 0 && (
                        <div className="text-[11px] text-purple-100/85 pt-1 border-t border-purple-400/15">
                          <span className="text-purple-300/75 font-semibold">Included Outstanding Docs: </span>
                          <span>{receipt.outstandingDocuments.join(' · ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Explicit Confirmation Modal Before Executing Google / Microsoft Workspace Mutations */}
      {confirmAlert && confirmSchedulePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060211]/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="synth-glass rounded-3xl max-w-lg w-full p-6 space-y-4 text-slate-100 border border-[#00F5D4]/35">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="w-5 h-5 text-[#00F5D4] shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Confirm Pre-Expiry Officer Reminder Automation
                  </h3>
                  <p className="text-xs text-purple-200/75">
                    {confirmAlert.intake.clientName} · {leadDays} days before {confirmSchedulePreview.expiryDateIso}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAlert(null)}
                className="text-purple-200/70 hover:text-white cursor-pointer"
                aria-label="Cancel workspace automation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 synth-inset rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-purple-200/75">Officer Email Recipient:</span>
                <span className="font-mono font-semibold text-white">{officerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200/75">Compliance Expiry / SLA Date:</span>
                <span className="font-mono font-semibold text-[#FF2A85]">{confirmSchedulePreview.expiryDateIso}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200/75">Trigger Date ({leadDays}d Before):</span>
                <span className="font-mono font-bold text-[#00F5D4]">{confirmSchedulePreview.targetNotifyDateIso}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200/75">Daily Nag Policy:</span>
                <span className="text-[#FFE600] font-semibold">Daily 08:30 SAST until reminder sent</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-purple-100">Active Channels to Execute:</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0518]/75 border border-purple-400/20">
                  <span>Google Workspace (Gmail + Daily Calendar + Tasks)</span>
                  {googleConnected ? (
                    <span className="text-[#00F5D4] font-bold">Ready</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectGoogleClick}
                      className="text-[#4CC9F0] font-bold hover:underline cursor-pointer"
                    >
                      Connect Now
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0518]/75 border border-purple-400/20">
                  <span>Microsoft 365 (Outlook Mail + Daily Calendar + To Do)</span>
                  {microsoftStatus.connected ? (
                    <span className="text-[#4CC9F0] font-bold">Ready</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnectMsClick}
                      className="text-[#4CC9F0] font-bold hover:underline cursor-pointer"
                    >
                      Connect Now
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0518]/75 border border-[#00F5D4]/25">
                  <span>Portal Date-Stamped Workflow Tracker (Firestore)</span>
                  <span className="text-[#00F5D4] font-bold">Always Active</span>
                </div>
              </div>
            </div>

            {workspaceActionError && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/45 text-xs text-rose-100">
                {workspaceActionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAlert(null)}
                className="px-4 py-2 text-xs font-semibold text-purple-100 synth-inset rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isScheduling}
                onClick={handleConfirmScheduleAutomation}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] via-[#4CC9F0] to-[#FFE600] hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                {isScheduling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scheduling Workspace Alerts...</span>
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Schedule Daily Reminders</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
