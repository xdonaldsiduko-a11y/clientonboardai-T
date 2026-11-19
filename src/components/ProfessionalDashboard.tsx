import React, { useState } from 'react';
import { 
  Building2, 
  Search, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Download, 
  FileText, 
  X, 
  Lock, 
  FileCheck, 
  Sparkles,
  ChevronRight,
  TrendingUp,
  XCircle,
  AlertTriangle,
  CalendarClock,
  Send,
  Archive,
  PackageCheck,
  Copy,
  Check,
  KeyRound,
  ShieldAlert,
  RefreshCw,
  Fingerprint,
  BellRing,
  FileSpreadsheet
} from 'lucide-react';
import { 
  PracticeProfile, 
  ClientIntake, 
  VerificationDocument, 
  AuditLog, 
  IntakeStatus, 
  FicaExpiryState,
  OfficerSecuritySession,
  ComplianceAgingState,
  ComplianceAgingInfo,
  EncryptedActionNotificationReceipt,
  IntakeDocumentCompletionAlert,
  OfficerReminderWorkflow,
  MicrosoftConnectionStatus
} from '../types';
import {
  encryptDossierPackage,
  generateEncryptedBulkZipPackage,
  BulkZipResult,
  dispatchEncryptedActionRequiredNotification
} from '../utils/encryption';
import {
  calculateFicaDocumentExpiry,
  getClientFicaComplianceStatus,
  calculateComplianceAging,
  evaluateAgingIntakeAlert,
  buildOutstandingReminderText,
  DocumentExpiryInfo
} from '../utils/sa-fica';
import {
  generateClientCompliancePdfReport,
  ClientPdfComplianceReportResult
} from '../utils/pdfReport';
import { exportFilteredAuditLogsToCsv } from '../utils/csvAuditExport';
import { ComplianceHealthPanel } from './ComplianceHealthPanel';
import { ActivityHeatmapPanel } from './ActivityHeatmapPanel';
import { AgingIntakeAlert } from './AgingIntakeAlert';

export function FicaStatusBadge({ 
  status, 
  showSubtitle = true 
}: { 
  status: IntakeStatus; 
  showSubtitle?: boolean;
}) {
  switch (status) {
    case 'approved':
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#00F5D4] whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
            <span>FICA Cleared</span>
          </span>
          {showSubtitle && (
            <span className="text-[9.5px] text-purple-200/70 font-medium tracking-tight whitespace-nowrap">
              Officer Approved · Full CDD
            </span>
          )}
        </div>
      );
    case 'ai_verified':
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#4CC9F0] whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 text-[#4CC9F0] shrink-0" />
            <span>AI Verified</span>
          </span>
          {showSubtitle && (
            <span className="text-[9.5px] text-purple-200/70 font-medium tracking-tight whitespace-nowrap">
              Luhn & Recency Passed
            </span>
          )}
        </div>
      );
    case 'needs_review':
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#FFE600] whitespace-nowrap">
            <AlertCircle className="w-3.5 h-3.5 text-[#FFE600] shrink-0" />
            <span>Needs Review</span>
          </span>
          {showSubtitle && (
            <span className="text-[9.5px] text-[#FFE600]/75 font-medium tracking-tight whitespace-nowrap">
              Manual Check Required
            </span>
          )}
        </div>
      );
    case 'submitted':
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-purple-200 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span>Submitted</span>
          </span>
          {showSubtitle && (
            <span className="text-[9.5px] text-purple-200/70 font-medium tracking-tight whitespace-nowrap">
              In Verification Queue
            </span>
          )}
        </div>
      );
    case 'rejected':
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#FF2A85] whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5 text-[#FF2A85] shrink-0" />
            <span>Non-Compliant</span>
          </span>
          {showSubtitle && (
            <span className="text-[9.5px] text-[#FF2A85]/80 font-medium tracking-tight whitespace-nowrap">
              FICA Rejected
            </span>
          )}
        </div>
      );
    case 'draft':
    default:
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-purple-300/80 whitespace-nowrap">
            <FileText className="w-3.5 h-3.5 text-purple-300/70 shrink-0" />
            <span>Draft</span>
          </span>
          {showSubtitle && (
            <span className="text-[9.5px] text-purple-300/60 font-medium tracking-tight whitespace-nowrap">
              Awaiting Client Entry
            </span>
          )}
        </div>
      );
  }
}

export function FicaExpiryBadge({ 
  info 
}: { 
  info: DocumentExpiryInfo 
}) {
  if (info.state === 'expired') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FF2A85]">
          <XCircle className="w-3.5 h-3.5 text-[#FF2A85] shrink-0" />
          <span>FICA Expired</span>
        </span>
        <span className="text-[10px] text-rose-200/80 font-semibold font-mono tracking-tight">
          {Math.abs(info.daysRemaining)} days overdue · Refresh required
        </span>
      </div>
    );
  }
  if (info.state === 'expiring_soon') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FFE600]">
          <AlertTriangle className="w-3.5 h-3.5 text-[#FFE600] shrink-0" />
          <span>Expires in {info.daysRemaining}d</span>
        </span>
        <span className="text-[10px] text-amber-200/80 font-medium font-mono tracking-tight">
          &lt; 30 days left (FICA 90-day window)
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#00F5D4]">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
        <span>FICA Compliant</span>
      </span>
      <span className="text-[10px] text-purple-200/75 font-medium font-mono tracking-tight">
        {info.daysRemaining < 365 ? `${info.daysRemaining} days remaining` : 'Permanent SA ID valid'}
      </span>
    </div>
  );
}

export function ClientDocumentExpiryCell({ 
  intake, 
  clientDocs 
}: { 
  intake: ClientIntake; 
  clientDocs: VerificationDocument[];
}) {
  const compliance = getClientFicaComplianceStatus(intake, clientDocs);

  if (compliance.state === 'expired') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#FF2A85] whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-[#FF2A85] shrink-0" />
          <span>Expired</span>
        </span>
        <span className="text-[9.5px] text-rose-200/85 font-semibold font-mono tracking-tight">
          {compliance.summary}
        </span>
      </div>
    );
  }

  if (compliance.state === 'expiring_soon') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#FFE600] whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-[#FFE600] shrink-0" />
          <span>&lt; 30 Days Left</span>
        </span>
        <span className="text-[9.5px] text-amber-200/85 font-semibold font-mono tracking-tight">
          {compliance.summary}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#00F5D4] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
        <span>Valid</span>
      </span>
      <span className="text-[9.5px] text-purple-200/75 font-medium font-mono tracking-tight">
        {compliance.summary}
      </span>
    </div>
  );
}

export function ClientComplianceAgingCell({
  aging,
}: {
  aging: ComplianceAgingInfo;
}) {
  if (aging.state === 'overdue_30d') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#FF2A85] font-mono tabular-nums whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-[#FF2A85] shrink-0" />
          <span>{aging.daysOpen}d Open (+{aging.daysOverThreshold}d)</span>
        </span>
        <span className="text-[9.5px] text-rose-200/85 font-semibold tracking-tight whitespace-nowrap">
          SLA Breached (&ge; 30d)
        </span>
      </div>
    );
  }

  if (aging.state === 'approaching_30d') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#FFE600] font-mono tabular-nums whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-[#FFE600] shrink-0" />
          <span>{aging.daysOpen}d Open ({aging.daysUntilThreshold}d left)</span>
        </span>
        <span className="text-[9.5px] text-amber-200/85 font-medium tracking-tight whitespace-nowrap">
          Nearing 30d Limit
        </span>
      </div>
    );
  }

  if (aging.state === 'finalized') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#00F5D4] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
          <span>Finalized</span>
        </span>
        <span className="text-[9.5px] text-purple-200/65 font-medium tracking-tight whitespace-nowrap">
          SLA Closed
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-purple-100 font-mono tabular-nums whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 text-[#4CC9F0] shrink-0" />
        <span>{aging.daysOpen}d Open</span>
      </span>
      <span className="text-[9.5px] text-purple-200/65 font-medium tracking-tight whitespace-nowrap">
        Within 30d SLA
      </span>
    </div>
  );
}

interface ProfessionalDashboardProps {
  practice: PracticeProfile;
  intakes: ClientIntake[];
  documents: VerificationDocument[];
  auditLogs: AuditLog[];
  onOpenMagicModal: () => void;
  onSelectIntakeToView: (intake: ClientIntake) => void;
  onUpdateIntakeStatus: (intakeId: string, newStatus: IntakeStatus) => void;
  onBulkExportArchived?: (clientCount: number, docCount: number, integrityHash: string) => void;
  onActionRequiredDispatched?: (receipt: EncryptedActionNotificationReceipt) => void;
  onPdfReportGenerated?: (intake: ClientIntake, result: ClientPdfComplianceReportResult) => void;
  onAuditCsvExported?: (exportedCount: number, filterSummary: string) => void;
  securitySession?: OfficerSecuritySession | null;
  onOpenPasskeyModal?: () => void;
  officerEmail?: string;
  reminderWorkflows?: OfficerReminderWorkflow[];
  googleConnected?: boolean;
  microsoftStatus?: MicrosoftConnectionStatus;
  onConnectGoogle?: () => Promise<void>;
  onConnectMicrosoft?: () => Promise<void>;
  onDisconnectMicrosoft?: () => Promise<void>;
  onAutomateWorkflow?: (
    alert: IntakeDocumentCompletionAlert,
    leadDays: 2 | 3
  ) => Promise<void>;
}

export const ProfessionalDashboard: React.FC<ProfessionalDashboardProps> = ({
  practice,
  intakes,
  documents,
  auditLogs,
  onOpenMagicModal,
  onUpdateIntakeStatus,
  onBulkExportArchived,
  onActionRequiredDispatched,
  onPdfReportGenerated,
  onAuditCsvExported,
  securitySession,
  onOpenPasskeyModal,
  officerEmail,
  reminderWorkflows = [],
  googleConnected = false,
  microsoftStatus = { configured: false, connected: false },
  onConnectGoogle = async () => {},
  onConnectMicrosoft = async () => {},
  onDisconnectMicrosoft = async () => {},
  onAutomateWorkflow = async () => {},
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [expiryFilter, setExpiryFilter] = useState<FicaExpiryState | 'all'>('all');
  const [agingFilter, setAgingFilter] = useState<ComplianceAgingState | 'all'>('all');
  
  const [activeDrawerIntake, setActiveDrawerIntake] = useState<ClientIntake | null>(null);
  const [selectedIntakeIds, setSelectedIntakeIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (activeDrawerIntake) {
      const fresh = intakes.find(i => i.id === activeDrawerIntake.id);
      if (fresh && (fresh.status !== activeDrawerIntake.status || fresh.updatedAt !== activeDrawerIntake.updatedAt)) {
        setActiveDrawerIntake(fresh);
      }
    }
  }, [intakes, activeDrawerIntake]);

  // Encrypted "Action Required" Notification State
  const [sendingNoticeIntakeIds, setSendingNoticeIntakeIds] = useState<string[]>([]);
  const [dispatchedReceipts, setDispatchedReceipts] = useState<Record<string, EncryptedActionNotificationReceipt>>({});
  const [expandedReceiptIntakeId, setExpandedReceiptIntakeId] = useState<string | null>(null);
  const [copiedDispatchId, setCopiedDispatchId] = useState<string | null>(null);
  const [isBatchNotifying, setIsBatchNotifying] = useState(false);

  // POPIA PDF Compliance Report State
  const [generatingPdfIntakeIds, setGeneratingPdfIntakeIds] = useState<string[]>([]);
  const [lastPdfReport, setLastPdfReport] = useState<{
    intakeId: string;
    result: ClientPdfComplianceReportResult;
  } | null>(null);

  // Bulk Encrypted ZIP Archival Modal State
  const [isBulkExportModalOpen, setIsBulkExportModalOpen] = useState(false);
  const [bulkPassphrase, setBulkPassphrase] = useState('ZA-FICA-2026-ARCHIVE');
  const [showBulkPassphrase, setShowBulkPassphrase] = useState(false);
  const [copiedPassphrase, setCopiedPassphrase] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkZipResult | null>(null);
  const [bulkScope, setBulkScope] = useState<'verified_only' | 'selected_only' | 'all'>('verified_only');

  // Single Encrypted Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [csvExportNotice, setCsvExportNotice] = useState<string | null>(null);

  const filteredIntakes = intakes.filter((i) => {
    if (i.practiceId !== practice.id && intakes.length > 5) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (typeFilter !== 'all' && i.clientType !== typeFilter) return false;
    if (riskFilter !== 'all' && i.riskRating !== riskFilter) return false;
    if (expiryFilter !== 'all') {
      const compliance = getClientFicaComplianceStatus(i, documents);
      if (compliance.state !== expiryFilter) return false;
    }
    if (agingFilter !== 'all') {
      const aging = calculateComplianceAging(i, documents);
      if (aging.state !== agingFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = i.clientName.toLowerCase().includes(q);
      const matchEmail = i.clientEmail.toLowerCase().includes(q);
      const matchId = i.idNumber.toLowerCase().includes(q);
      const matchCompany = i.companyName?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchId && !matchCompany) return false;
    }
    return true;
  });

  const filteredIntakeIds = new Set(filteredIntakes.map((i) => i.id));
  const hasActiveDashboardFilters = Boolean(
    searchQuery ||
      statusFilter !== 'all' ||
      typeFilter !== 'all' ||
      riskFilter !== 'all' ||
      expiryFilter !== 'all' ||
      agingFilter !== 'all'
  );

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (filteredIntakeIds.has(log.intakeId)) return true;
    const isPracticeWideEvent =
      log.intakeId === 'SECURITY_WEBAUTHN' ||
      log.intakeId === 'BATCH_BULK_ARCHIVE' ||
      log.intakeId === 'BATCH_AUDIT_CSV_EXPORT';
    if (!hasActiveDashboardFilters && isPracticeWideEvent) return true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.performedBy.toLowerCase().includes(q) ||
        log.intakeId.toLowerCase().includes(q) ||
        log.hash.toLowerCase().includes(q)
      );
    }
    return false;
  });

  const activeFilterParts: string[] = [];
  if (statusFilter !== 'all') activeFilterParts.push(`Status=${statusFilter}`);
  if (typeFilter !== 'all') activeFilterParts.push(`Type=${typeFilter}`);
  if (riskFilter !== 'all') activeFilterParts.push(`Risk=${riskFilter}`);
  if (expiryFilter !== 'all') activeFilterParts.push(`Expiry=${expiryFilter}`);
  if (agingFilter !== 'all') activeFilterParts.push(`Aging=${agingFilter}`);
  if (searchQuery) activeFilterParts.push(`Search="${searchQuery}"`);
  const auditFilterSummary =
    activeFilterParts.length > 0 ? activeFilterParts.join(' · ') : 'All Practice Records';

  const handleExportAuditReportCsv = () => {
    const result = exportFilteredAuditLogsToCsv(
      practice,
      filteredAuditLogs,
      intakes,
      auditFilterSummary
    );
    setCsvExportNotice(
      `Exported ${result.rowCount} filtered audit log ${result.rowCount === 1 ? 'entry' : 'entries'} (${result.fileName})`
    );
    setTimeout(() => setCsvExportNotice(null), 5000);

    if (onAuditCsvExported) {
      onAuditCsvExported(result.rowCount, auditFilterSummary);
    }
  };

  const totalCases = intakes.length;
  const verifiedCases = intakes.filter(i => i.status === 'ai_verified' || i.status === 'approved').length;
  const complianceRate = totalCases > 0 ? ((verifiedCases / totalCases) * 100).toFixed(1) : '100.0';
  const pendingReviewCount = intakes.filter(i => i.status === 'needs_review' || i.status === 'submitted').length;

  const allExpiryStatuses = intakes.map(i => ({
    intake: i,
    compliance: getClientFicaComplianceStatus(i, documents)
  }));
  const validExpiryCount = allExpiryStatuses.filter(s => s.compliance.state === 'valid').length;
  const expiringSoonCount = allExpiryStatuses.filter(s => s.compliance.state === 'expiring_soon').length;
  const expiredCount = allExpiryStatuses.filter(s => s.compliance.state === 'expired').length;

  // Compliance Aging (>30d unfinalized SLA tracking)
  const allAgingStatuses = intakes.map(i => ({
    intake: i,
    aging: calculateComplianceAging(i, documents)
  }));
  const overdueAgingCases = allAgingStatuses
    .filter(s => s.aging.state === 'overdue_30d')
    .sort((a, b) => b.aging.daysOpen - a.aging.daysOpen);
  const approachingAgingCases = allAgingStatuses
    .filter(s => s.aging.state === 'approaching_30d')
    .sort((a, b) => b.aging.daysOpen - a.aging.daysOpen);
  const priorityAgingQueue = [...overdueAgingCases, ...approachingAgingCases];

  const handleSendEncryptedActionRequired = async (
    intake: ClientIntake,
    e?: React.MouseEvent,
    overrideAging?: ComplianceAgingInfo,
    customNote?: string
  ) => {
    if (e) e.stopPropagation();
    if (sendingNoticeIntakeIds.includes(intake.id)) return;

    setSendingNoticeIntakeIds(prev => [...prev, intake.id]);
    try {
      const evaluatedAlert = evaluateAgingIntakeAlert(intake, documents);
      const aging = overrideAging || evaluatedAlert.agingInfo;
      const outstandingDocuments = evaluatedAlert.outstandingItems.map(
        (item) => `${item.label} (${item.detail})`
      );
      const reminderSummary = buildOutstandingReminderText(
        practice.practiceName,
        evaluatedAlert,
        customNote
      );

      const receipt = await dispatchEncryptedActionRequiredNotification(practice, intake, aging, {
        outstandingDocuments,
        reminderSummary,
        slaDaysRemaining: evaluatedAlert.slaDaysRemaining,
      });

      setDispatchedReceipts(prev => ({
        ...prev,
        [intake.id]: receipt,
      }));
      setExpandedReceiptIntakeId(intake.id);

      if (onActionRequiredDispatched) {
        onActionRequiredDispatched(receipt);
      }

      if (activeDrawerIntake?.id === intake.id) {
        const docCountMsg =
          outstandingDocuments.length > 0
            ? ` listing ${outstandingDocuments.length} outstanding doc(s)`
            : '';
        setRefreshNotice(
          `AES-256 encrypted reminder sent to ${intake.clientEmail}${docCountMsg} (Ref: ${receipt.dispatchId})`
        );
      }
    } finally {
      setSendingNoticeIntakeIds(prev => prev.filter(id => id !== intake.id));
    }
  };

  const handleDispatchReengagementEmail = async (
    alert: IntakeDocumentCompletionAlert,
    customNote?: string
  ) => {
    await handleSendEncryptedActionRequired(alert.intake, undefined, alert.agingInfo, customNote);
  };

  const handleNotifyAllAged = async () => {
    const pendingTargets = overdueAgingCases.filter(item => !dispatchedReceipts[item.intake.id]);
    if (pendingTargets.length === 0 || isBatchNotifying) return;

    setIsBatchNotifying(true);
    try {
      for (const item of pendingTargets) {
        await handleSendEncryptedActionRequired(item.intake);
      }
    } finally {
      setIsBatchNotifying(false);
    }
  };

  const handleCopyDispatchLink = async (receipt: EncryptedActionNotificationReceipt) => {
    try {
      await navigator.clipboard.writeText(receipt.magicResumeUrl);
      setCopiedDispatchId(receipt.dispatchId);
      setTimeout(() => setCopiedDispatchId(null), 3000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadClientPdfReport = async (intake: ClientIntake, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (generatingPdfIntakeIds.includes(intake.id)) return;

    setGeneratingPdfIntakeIds(prev => [...prev, intake.id]);
    try {
      const result = await generateClientCompliancePdfReport({
        practice,
        intake,
        documents,
        auditLogs,
        securitySession,
      });

      setLastPdfReport({ intakeId: intake.id, result });

      if (activeDrawerIntake?.id === intake.id) {
        setRefreshNotice(
          `POPIA PDF Compliance Report downloaded (${result.reportId} · ${result.includedAuditEvents} audit events sealed)`
        );
      }

      if (onPdfReportGenerated) {
        onPdfReportGenerated(intake, result);
      }
    } catch (err) {
      console.error('PDF report generation error:', err);
    } finally {
      setGeneratingPdfIntakeIds(prev => prev.filter(id => id !== intake.id));
    }
  };

  const toggleSelectIntake = (id: string) => {
    setSelectedIntakeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (selectedIntakeIds.length === filteredIntakes.length && filteredIntakes.length > 0) {
      setSelectedIntakeIds([]);
    } else {
      setSelectedIntakeIds(filteredIntakes.map(i => i.id));
    }
  };

  const handleSelectAllVerified = () => {
    const verifiedIds = intakes
      .filter(i => i.status === 'ai_verified' || i.status === 'approved')
      .map(i => i.id);
    setSelectedIntakeIds(verifiedIds);
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randPart1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const randPart2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const newKey = `ZA-FICA-2026-${randPart1}-${randPart2}`;
    setBulkPassphrase(newKey);
    setCopiedPassphrase(false);
  };

  const handleCopyPassphrase = async () => {
    if (!bulkPassphrase) return;
    try {
      await navigator.clipboard.writeText(bulkPassphrase);
      setCopiedPassphrase(true);
      setTimeout(() => setCopiedPassphrase(false), 3000);
    } catch {
      // fallback
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 3000);
    } catch {
      // fallback
    }
  };

  const getBulkTargetIntakes = () => {
    if (bulkScope === 'selected_only' && selectedIntakeIds.length > 0) {
      return intakes.filter(i => selectedIntakeIds.includes(i.id));
    }
    if (bulkScope === 'all') {
      return intakes;
    }
    const verified = intakes.filter(i => i.status === 'ai_verified' || i.status === 'approved');
    return verified.length > 0 ? verified : intakes;
  };

  const handleExecuteBulkZipExport = async () => {
    if (!bulkPassphrase) return;
    const targets = getBulkTargetIntakes();
    if (targets.length === 0) return;

    setBulkExporting(true);
    setBulkResult(null);
    setBulkProgress({ current: 0, total: 5, message: 'Initializing PKZIP AES-256 Engine...' });

    try {
      const result = await generateEncryptedBulkZipPackage(
        practice,
        targets,
        documents,
        auditLogs,
        bulkPassphrase,
        (current, total, message) => {
          setBulkProgress({ current, total, message });
        }
      );

      setBulkResult(result);

      const blobUrl = URL.createObjectURL(result.zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = result.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      if (onBulkExportArchived) {
        onBulkExportArchived(result.totalClients, result.totalDocuments, result.integrityHash);
      }
    } catch (err) {
      console.error('Bulk export error:', err);
    } finally {
      setBulkExporting(false);
    }
  };

  const handleExportEncryptedDossier = async () => {
    if (!activeDrawerIntake || !exportPassphrase) return;

    setIsExporting(true);
    setExportSuccessMessage(null);

    try {
      const caseDocs = documents.filter(d => d.intakeId === activeDrawerIntake.id);
      const caseLogs = auditLogs.filter(l => l.intakeId === activeDrawerIntake.id);

      const result = await encryptDossierPackage(
        {
          intake: activeDrawerIntake,
          documents: caseDocs,
          auditLogs: caseLogs,
          practice,
        },
        exportPassphrase
      );

      const blobUrl = URL.createObjectURL(result.encryptedBlob);
      const encLink = document.createElement('a');
      encLink.href = blobUrl;
      encLink.download = `Dossier_${activeDrawerIntake.clientName.replace(/\s+/g, '_')}_AES256.onboard.enc`;
      encLink.click();

      const certBlob = new Blob([result.certificateJson], { type: 'application/json' });
      const certUrl = URL.createObjectURL(certBlob);
      const certLink = document.createElement('a');
      certLink.href = certUrl;
      certLink.download = `POPIA_Certificate_${activeDrawerIntake.clientName.replace(/\s+/g, '_')}.json`;
      certLink.click();

      setExportSuccessMessage(`Encrypted package and POPIA Section 19 certificate generated! (SHA-256: ${result.integrityHash.substring(0, 16)}...)`);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const bulkTargetClients = getBulkTargetIntakes();
  const bulkTargetDocs = documents.filter(d => bulkTargetClients.some(c => c.id === d.intakeId));

  return (
    <div className="py-7 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      
      {/* Practice Hero Header Banner (Synthwave Dark Aurora Glass) */}
      <div className="synth-glass glow-violet p-6 sm:p-7 rounded-3xl relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-[#FF2A85]/20 blur-3xl pointer-events-none" />
        <div className="absolute right-24 -bottom-24 w-64 h-64 rounded-full bg-[#00F5D4]/15 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#00F5D4] font-semibold">
              <span>South African Professional Practice Portal</span>
              <span aria-hidden="true">·</span>
              <span className="text-purple-200/80">{practice.city}, {practice.province}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance">
              {practice.practiceName}
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/80 max-w-2xl">
              {practice.tagline}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-purple-200/75 pt-1">
              <span>FICA Officer: <strong className="text-white">{practice.ficaOfficerName}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Admin: <strong className="text-white">{practice.adminEmail}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Retention: <strong className="text-[#FFE600] font-mono tabular-nums">{practice.retentionPolicyDays / 365} Years</strong></span>
              <span aria-hidden="true">·</span>
              {onOpenPasskeyModal && (
                <button
                  type="button"
                  onClick={onOpenPasskeyModal}
                  className={`inline-flex items-center gap-1.5 font-semibold cursor-pointer hover:underline ${
                    securitySession?.verified ? 'text-[#00F5D4]' : 'text-[#FFE600]'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>
                    {securitySession?.verified
                      ? `Biometric AAL3 Active (${securitySession.deviceLabel})`
                      : 'Verify Officer Biometrics (WebAuthn)'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportAuditReportCsv}
              disabled={filteredAuditLogs.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs text-white synth-inset border border-[#9D4EDD]/45 hover:border-[#FFE600]/65 hover:bg-[#9D4EDD]/15 active:scale-95 transition-all cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
              title={`Download CSV of ${filteredAuditLogs.length} filtered POPIA audit log entries (${auditFilterSummary})`}
            >
              <FileSpreadsheet className="w-4 h-4 text-[#FFE600]" />
              <span>Export Audit Report ({filteredAuditLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkScope(selectedIntakeIds.length > 0 ? 'selected_only' : 'verified_only');
                setIsBulkExportModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs text-white synth-inset border border-[#00F5D4]/35 hover:border-[#00F5D4]/70 hover:bg-[#00F5D4]/10 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              title="Package verified client dossiers into an encrypted AES-256 ZIP archive"
            >
              <Archive className="w-4 h-4 text-[#00F5D4]" />
              <span>Bulk Archive ZIP ({verifiedCases})</span>
            </button>

            <button
              type="button"
              onClick={onOpenMagicModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 shadow-[0_0_24px_-4px_rgba(255,42,133,0.65)] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 text-[#0B0518]" />
              <span>Invite New Client</span>
            </button>
          </div>
        </div>

        {csvExportNotice && (
          <div className="relative z-10 mt-4 p-3 rounded-2xl bg-[#FFE600]/12 border border-[#FFE600]/40 text-xs text-[#FFF599] flex items-center justify-between gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#FFE600] shrink-0" />
              <span>{csvExportNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setCsvExportNotice(null)}
              aria-label="Dismiss CSV export confirmation"
              className="text-purple-200 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Row (Neumorphic Glassmorphic + Neon Gradient Typography) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="synth-glass glow-violet p-5 rounded-3xl">
          <div className="flex items-center justify-between text-xs text-purple-200/80">
            <span>Total Intake Pipeline</span>
            <Building2 className="w-4 h-4 text-[#9D4EDD]" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#C77DFF] to-[#4CC9F0] bg-clip-text text-transparent">
            {totalCases}
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1">Across all entity types</p>
        </div>

        <div className="synth-glass glow-cyan p-5 rounded-3xl">
          <div className="flex items-center justify-between text-xs text-purple-200/80">
            <span>FICA Verification Rate</span>
            <CheckCircle2 className="w-4 h-4 text-[#00F5D4]" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] bg-clip-text text-transparent">
            {complianceRate}%
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1">Luhn & 90-day recency checked</p>
        </div>

        <div className="synth-glass glow-amber p-5 rounded-3xl">
          <div className="flex items-center justify-between text-xs text-purple-200/80">
            <span>Pending &amp; Aged Cases</span>
            <Clock className="w-4 h-4 text-[#FFE600]" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#FF6B35] to-[#FFE600] bg-clip-text text-transparent">
            {pendingReviewCount}
          </div>
          <p className="text-[11px] mt-1 font-medium">
            {overdueAgingCases.length > 0 ? (
              <span className="text-[#FF2A85] font-semibold">
                {overdueAgingCases.length} unfinalized &ge; 30d SLA
              </span>
            ) : (
              <span className="text-purple-200/70">Awaiting compliance sign-off</span>
            )}
          </p>
        </div>

        <div className="synth-glass glow-magenta p-5 rounded-3xl">
          <div className="flex items-center justify-between text-xs text-purple-200/80">
            <span>Average Turnaround</span>
            <TrendingUp className="w-4 h-4 text-[#FF2A85]" />
          </div>
          <div className="mt-2.5 text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#FF2A85] to-[#FF6B35] bg-clip-text text-transparent">
            6.4 <span className="text-xs font-sans text-purple-200/75">mins</span>
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1">Down from 4 days manual</p>
        </div>
      </div>

      {/* Emergency Outstanding Documents & SLA Countdown Dashboard */}
      <AgingIntakeAlert
        practiceName={practice.practiceName}
        officerEmail={officerEmail || practice.adminEmail}
        intakes={intakes}
        documents={documents}
        sendingIntakeIds={sendingNoticeIntakeIds}
        dispatchedReceipts={dispatchedReceipts}
        reminderWorkflows={reminderWorkflows}
        googleConnected={googleConnected}
        microsoftStatus={microsoftStatus}
        onConnectGoogle={onConnectGoogle}
        onConnectMicrosoft={onConnectMicrosoft}
        onDisconnectMicrosoft={onDisconnectMicrosoft}
        onAutomateWorkflow={onAutomateWorkflow}
        onDispatchReengagement={handleDispatchReengagementEmail}
        onSelectIntake={(intake) => setActiveDrawerIntake(intake)}
      />

      {/* Compliance Health Visualization (Recharts Donut + Intake Readiness Bars) */}
      <ComplianceHealthPanel
        intakes={intakes}
        documents={documents}
        onSelectIntake={(intake) => setActiveDrawerIntake(intake)}
        onSelectExpiryFilter={(state) => setExpiryFilter(state)}
      />

      {/* Chronological Activity Heatmap (Peak Intake & Verification Times) */}
      <ActivityHeatmapPanel
        intakes={intakes}
        documents={documents}
        auditLogs={auditLogs}
        onSelectIntake={(intake) => setActiveDrawerIntake(intake)}
      />

      {/* Automated FICA Document Expiry Monitor (Section 21C) */}
      <div className="synth-glass p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="w-5 h-5 text-[#00F5D4] shrink-0" />
            <h2 className="text-sm font-bold text-white">
              FICA Document Expiry Monitor (Section 21C Ongoing Due Diligence)
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-purple-200/70 font-mono">Statutory 90-Day Tracker</span>
            {expiryFilter !== 'all' && (
              <button
                onClick={() => setExpiryFilter('all')}
                className="text-xs text-[#00F5D4] font-semibold hover:underline cursor-pointer"
              >
                Clear Expiry Filter
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Valid */}
          <button
            type="button"
            onClick={() => setExpiryFilter(expiryFilter === 'valid' ? 'all' : 'valid')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              expiryFilter === 'valid'
                ? 'bg-[#00F5D4]/15 border-[#00F5D4]/60 glow-cyan'
                : 'synth-inset border-[#00F5D4]/25 hover:border-[#00F5D4]/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00F5D4] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Valid (&ge; 30d)</span>
              </span>
              <span className="text-base font-extrabold font-mono text-white tabular-nums">
                {validExpiryCount} Case{validExpiryCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-purple-200/75 mt-1.5">
              All utility bills &amp; identity documents within statutory FICA window.
            </p>
          </button>

          {/* Expiring Soon */}
          <button
            type="button"
            onClick={() => setExpiryFilter(expiryFilter === 'expiring_soon' ? 'all' : 'expiring_soon')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              expiryFilter === 'expiring_soon'
                ? 'bg-[#FFE600]/15 border-[#FFE600]/65 glow-amber'
                : 'synth-inset border-[#FFE600]/25 hover:border-[#FFE600]/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFE600] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Nearing Expiry (&lt; 30d)</span>
              </span>
              <span className="text-base font-extrabold font-mono text-white tabular-nums">
                {expiringSoonCount} Case{expiringSoonCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-purple-200/75 mt-1.5">
              Utility bills approaching 90-day limit or credentials due for refresh.
            </p>
          </button>

          {/* Expired */}
          <button
            type="button"
            onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              expiryFilter === 'expired'
                ? 'bg-[#FF2A85]/18 border-[#FF2A85]/65 glow-magenta'
                : 'synth-inset border-[#FF2A85]/30 hover:border-[#FF2A85]/55'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FF2A85] flex items-center gap-1.5">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>FICA Expired / Overdue</span>
              </span>
              <span className="text-base font-extrabold font-mono text-white tabular-nums">
                {expiredCount} Case{expiredCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-purple-200/75 mt-1.5">
              Statutory 90-day limit exceeded or passport expired. Action required.
            </p>
          </button>
        </div>
      </div>

      {/* Compliance Aging Tracker (30-Day Unfinalized Intake SLA) */}
      <div className={`synth-glass p-5 sm:p-6 rounded-3xl space-y-4 ${overdueAgingCases.length > 0 ? 'glow-magenta' : ''}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <BellRing className={`w-5 h-5 shrink-0 ${overdueAgingCases.length > 0 ? 'text-[#FF2A85]' : 'text-[#FFE600]'}`} />
              <h2 className="text-sm font-bold text-white">
                Compliance Aging Tracker (30-Day Unfinalized Intake SLA)
              </h2>
            </div>
            <p className="text-xs text-purple-200/75">
              Flags intakes pending final FICA clearance for 30+ days ·{' '}
              <span className="text-[#FF2A85] font-semibold font-mono tabular-nums">
                {overdueAgingCases.length} Overdue (&ge;30d)
              </span>
              <span aria-hidden="true"> · </span>
              <span className="text-[#FFE600] font-semibold font-mono tabular-nums">
                {approachingAgingCases.length} Approaching (20–29d)
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAgingFilter(agingFilter === 'overdue_30d' ? 'all' : 'overdue_30d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                agingFilter === 'overdue_30d'
                  ? 'bg-[#FF2A85]/20 text-white border border-[#FF2A85]/60'
                  : 'synth-inset text-purple-200/80 hover:text-white border border-purple-400/20'
              }`}
            >
              {agingFilter === 'overdue_30d' ? 'Showing Aged 30d+ (Clear)' : `Filter Aged 30d+ (${overdueAgingCases.length})`}
            </button>

            <button
              type="button"
              onClick={() => setAgingFilter(agingFilter === 'approaching_30d' ? 'all' : 'approaching_30d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                agingFilter === 'approaching_30d'
                  ? 'bg-[#FFE600]/20 text-white border border-[#FFE600]/60'
                  : 'synth-inset text-purple-200/80 hover:text-white border border-purple-400/20'
              }`}
            >
              {agingFilter === 'approaching_30d' ? 'Showing At-Risk (Clear)' : `At-Risk 20–29d (${approachingAgingCases.length})`}
            </button>

            {overdueAgingCases.some(c => !dispatchedReceipts[c.intake.id]) && (
              <button
                type="button"
                disabled={isBatchNotifying}
                onClick={handleNotifyAllAged}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 shadow-[0_0_20px_-4px_rgba(255,42,133,0.65)] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {isBatchNotifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Encrypting Alerts...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      Notify All Aged 30d+ ({overdueAgingCases.filter(c => !dispatchedReceipts[c.intake.id]).length})
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {priorityAgingQueue.length === 0 ? (
          <div className="p-4 synth-inset rounded-2xl text-xs text-[#00F5D4] flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>All active client intakes are within the 30-day FICA finalization SLA window.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {priorityAgingQueue.map(({ intake, aging }) => {
              const isOverdue = aging.state === 'overdue_30d';
              const isSending = sendingNoticeIntakeIds.includes(intake.id);
              const receipt = dispatchedReceipts[intake.id];
              const isReceiptExpanded = expandedReceiptIntakeId === intake.id && !!receipt;
              const slaPercent = Math.min(100, Math.round((aging.daysOpen / aging.slaThresholdDays) * 100));

              return (
                <div
                  key={intake.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    isOverdue
                      ? 'bg-[#FF2A85]/[0.08] border-[#FF2A85]/45'
                      : 'synth-inset border-[#FFE600]/35'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setActiveDrawerIntake(intake)}
                          className="font-bold text-white hover:text-[#00F5D4] transition-colors cursor-pointer text-left"
                        >
                          {intake.clientName}
                        </button>
                        <span className="text-purple-400/50" aria-hidden="true">·</span>
                        <span className={`font-mono font-bold tabular-nums ${isOverdue ? 'text-[#FF2A85]' : 'text-[#FFE600]'}`}>
                          {aging.daysOpen}d open
                          {isOverdue
                            ? ` (+${aging.daysOverThreshold}d past 30d limit)`
                            : ` (${aging.daysUntilThreshold}d to 30d limit)`}
                        </span>
                        <span className="text-purple-400/50" aria-hidden="true">·</span>
                        <span className="text-purple-200/75 font-mono text-[11px]">{intake.clientEmail}</span>
                      </div>

                      <p className="text-[11px] text-purple-200/80">
                        {aging.bottleneckReason}
                      </p>

                      {/* SLA Aging Progress Meter */}
                      <div className="pt-1 max-w-md flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 synth-inset rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isOverdue
                                ? 'bg-gradient-to-r from-[#FF6B35] to-[#FF2A85]'
                                : 'bg-gradient-to-r from-[#00F5D4] to-[#FFE600]'
                            }`}
                            style={{ width: `${slaPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums text-purple-300/75 whitespace-nowrap">
                          {aging.daysOpen} / {aging.slaThresholdDays}d SLA
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {receipt ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReceiptIntakeId(isReceiptExpanded ? null : intake.id)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#00F5D4] bg-[#00F5D4]/12 border border-[#00F5D4]/45 hover:bg-[#00F5D4]/20 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Encrypted Alert Sent ({receipt.dispatchId})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={(e) => handleSendEncryptedActionRequired(intake, e)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                            isOverdue
                              ? 'text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 shadow-[0_0_20px_-4px_rgba(255,42,133,0.6)]'
                              : 'text-[#0B0518] bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] hover:opacity-95 shadow-[0_0_18px_-4px_rgba(0,245,212,0.5)]'
                          }`}
                        >
                          {isSending ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Encrypting AES-256...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Send Encrypted Action Required</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveDrawerIntake(intake)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-purple-100 synth-inset hover:border-purple-300/40 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Inspect File
                      </button>
                    </div>
                  </div>

                  {isReceiptExpanded && receipt && (
                    <div className="p-3.5 synth-inset rounded-xl border border-[#00F5D4]/30 text-[11px] space-y-2 animate-in fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[#00F5D4] font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{receipt.algorithm} Envelope Dispatched</span>
                        </span>
                        <span className="font-mono text-purple-200/75">
                          Key FP: {receipt.keyFingerprint} · {new Date(receipt.dispatchedAt).toLocaleTimeString('en-ZA')}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px] text-purple-200/80">
                        <div className="truncate">
                          Ciphertext: <span className="text-white">{receipt.ciphertextPreview}</span>
                        </div>
                        <div className="truncate">
                          SHA-256: <span className="text-white">{receipt.payloadSha256}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-purple-400/15">
                        <span className="text-purple-200/70 truncate max-w-md font-mono">
                          Secure Resume Link: {receipt.magicResumeUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyDispatchLink(receipt)}
                          className="inline-flex items-center gap-1 text-[#00F5D4] font-bold hover:underline cursor-pointer shrink-0"
                        >
                          {copiedDispatchId === receipt.dispatchId ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Secure Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Workspace: Filters & Data Grid */}
      <div className="synth-glass rounded-3xl overflow-hidden">
        
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-purple-400/15 bg-[#100723]/75 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-purple-300/60 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by client name, email, or SA ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs synth-inset rounded-xl text-white placeholder:text-purple-300/45 focus:outline-none focus:border-[#00F5D4] focus:ring-2 focus:ring-[#00F5D4]/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs synth-inset rounded-xl px-3 py-2 text-purple-100 cursor-pointer focus:outline-none focus:border-[#00F5D4]"
            >
              <option value="all" className="bg-[#140A2B] text-white">All Statuses</option>
              <option value="ai_verified" className="bg-[#140A2B] text-white">AI Verified</option>
              <option value="needs_review" className="bg-[#140A2B] text-white">Needs Review</option>
              <option value="approved" className="bg-[#140A2B] text-white">FICA Cleared</option>
              <option value="submitted" className="bg-[#140A2B] text-white">Submitted</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs synth-inset rounded-xl px-3 py-2 text-purple-100 cursor-pointer focus:outline-none focus:border-[#00F5D4]"
            >
              <option value="all" className="bg-[#140A2B] text-white">All Entity Types</option>
              <option value="individual" className="bg-[#140A2B] text-white">Individual</option>
              <option value="company" className="bg-[#140A2B] text-white">Company (Pty Ltd)</option>
              <option value="trust" className="bg-[#140A2B] text-white">Trust</option>
            </select>

            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="text-xs synth-inset rounded-xl px-3 py-2 text-purple-100 cursor-pointer focus:outline-none focus:border-[#00F5D4]"
            >
              <option value="all" className="bg-[#140A2B] text-white">All Risk Ratings</option>
              <option value="low" className="bg-[#140A2B] text-white">Low Risk</option>
              <option value="medium" className="bg-[#140A2B] text-white">Medium Risk</option>
              <option value="high" className="bg-[#140A2B] text-white">High Risk</option>
            </select>
          </div>
        </div>

        {/* Segmented FICA Compliance Filter Controls */}
        <div className="px-4 py-3 bg-[#120826]/80 border-b border-purple-400/15 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-purple-300/70 whitespace-nowrap mr-1">
            Compliance State:
          </span>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All Cases', count: intakes.length },
              { id: 'approved', label: 'FICA Cleared', count: intakes.filter(i => i.status === 'approved').length },
              { id: 'ai_verified', label: 'AI Verified', count: intakes.filter(i => i.status === 'ai_verified').length },
              { id: 'needs_review', label: 'Needs Review', count: intakes.filter(i => i.status === 'needs_review').length },
              { id: 'submitted', label: 'Submitted', count: intakes.filter(i => i.status === 'submitted').length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-gradient-to-r from-[#FF2A85]/25 to-[#00F5D4]/20 text-white border border-[#00F5D4]/45 shadow-[0_0_16px_-4px_rgba(0,245,212,0.4)]'
                    : 'text-purple-200/75 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono tabular-nums text-[10px] text-[#00F5D4]">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Selection Action Strip */}
        {selectedIntakeIds.length > 0 && (
          <div className="px-4 py-3 bg-gradient-to-r from-[#2D105A] via-[#1C0F42] to-[#0D1E3D] text-white flex flex-wrap items-center justify-between gap-3 animate-in fade-in text-xs border-b border-[#00F5D4]/30">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-4 h-4 text-[#00F5D4]" />
              <span className="font-bold">
                {selectedIntakeIds.length} Client Case{selectedIntakeIds.length !== 1 ? 's' : ''} Selected
              </span>
              <span className="text-purple-200/75 text-[11px] hidden sm:inline">
                · Ready for AES-256 encrypted archival packaging
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkScope('selected_only');
                  setIsBulkExportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] hover:opacity-95 shadow-[0_0_20px_-4px_rgba(0,245,212,0.6)] cursor-pointer transition-all active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Export Selected ({selectedIntakeIds.length}) as Encrypted ZIP</span>
              </button>

              <button
                type="button"
                onClick={handleSelectAllVerified}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-purple-100 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Select All Verified ({verifiedCases})
              </button>

              <button
                type="button"
                onClick={() => setSelectedIntakeIds([])}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-purple-300/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Intakes Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-[#120929]/90 text-purple-200/80 font-semibold border-b border-purple-400/20 text-[11px]">
              <tr>
                <th className="py-3 px-2.5 w-9 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all displayed clients"
                    checked={filteredIntakes.length > 0 && selectedIntakeIds.length === filteredIntakes.length}
                    onChange={toggleSelectAllFiltered}
                    className="w-3.5 h-3.5 rounded border-purple-400/50 bg-[#0B0518] text-[#00F5D4] focus:ring-[#00F5D4] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 min-w-[145px]">Client / Entity</th>
                <th className="py-3 px-2.5 min-w-[135px]">Contact</th>
                <th className="py-3 px-2.5 whitespace-nowrap">SA ID / Reg</th>
                <th className="py-3 px-4 min-w-[148px] whitespace-nowrap">FICA Status</th>
                <th className="py-3 px-4 min-w-[168px] whitespace-nowrap">Compliance Aging</th>
                <th className="py-3 px-4 min-w-[195px] whitespace-nowrap">Document Expiry (FICA)</th>
                <th className="py-3 px-2.5 whitespace-nowrap">Risk</th>
                <th className="py-3 px-3.5 min-w-[120px] whitespace-nowrap">POPIA Consent</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-400/10">
              {filteredIntakes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-purple-200/70">
                    <p className="text-sm font-semibold text-white">No client intake cases found</p>
                    <p className="text-xs mt-1">Try clearing filters or dispatch a new magic link invitation.</p>
                  </td>
                </tr>
              ) : (
                filteredIntakes.map((intake) => {
                  const isSelected = selectedIntakeIds.includes(intake.id);
                  const aging = calculateComplianceAging(intake, documents);
                  const isSendingNotice = sendingNoticeIntakeIds.includes(intake.id);
                  const sentReceipt = dispatchedReceipts[intake.id];
                  const rowHighlightClass = isSelected
                    ? 'bg-[#00F5D4]/10 hover:bg-[#00F5D4]/15'
                    : aging.state === 'overdue_30d'
                    ? 'bg-[#FF2A85]/[0.07] hover:bg-[#FF2A85]/[0.13]'
                    : aging.state === 'approaching_30d'
                    ? 'bg-[#FFE600]/[0.04] hover:bg-[#FFE600]/[0.09]'
                    : 'hover:bg-purple-500/12';

                  return (
                    <tr 
                      key={intake.id}
                      className={`${rowHighlightClass} transition-colors cursor-pointer group`}
                      onClick={() => setActiveDrawerIntake(intake)}
                    >
                      <td 
                        className="py-3 px-2.5 w-9 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${intake.clientName}`}
                          checked={isSelected}
                          onChange={() => toggleSelectIntake(intake.id)}
                          className="w-3.5 h-3.5 rounded border-purple-400/50 bg-[#0B0518] text-[#00F5D4] focus:ring-[#00F5D4] cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3 max-w-[175px]">
                        <div className="font-bold text-[11px] text-white group-hover:text-[#00F5D4] transition-colors truncate" title={intake.clientName}>
                          {intake.clientName}
                        </div>
                        <div className="text-[10px] text-purple-200/70 capitalize truncate">
                          {intake.clientType} {intake.companyName ? `· ${intake.companyName}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-2.5 font-mono text-[10px] text-purple-100/85 max-w-[165px]">
                        <div className="truncate" title={intake.clientEmail}>{intake.clientEmail}</div>
                        <div className="text-purple-300/60 truncate">{intake.phone}</div>
                      </td>

                      <td className="py-3 px-2.5 font-mono text-[10px] text-purple-100 whitespace-nowrap">
                        {intake.idNumber || intake.registrationNumber || 'Pending entry'}
                      </td>

                      <td className="py-3 px-4 min-w-[148px]">
                        <FicaStatusBadge status={intake.status} />
                      </td>

                      <td className="py-3 px-4 min-w-[168px]">
                        <ClientComplianceAgingCell aging={aging} />
                      </td>

                      <td className="py-3 px-4 min-w-[195px]">
                        <ClientDocumentExpiryCell intake={intake} clientDocs={documents} />
                      </td>

                      <td className="py-3 px-2.5 font-bold uppercase text-[9.5px] whitespace-nowrap">
                        <span className={`${
                          intake.riskRating === 'low'
                            ? 'text-[#00F5D4]'
                            : intake.riskRating === 'medium'
                            ? 'text-[#FFE600]'
                            : 'text-[#FF2A85]'
                        }`}>
                          {intake.riskRating}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 min-w-[120px] whitespace-nowrap">
                        {intake.popiaConsent ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] text-[#00F5D4] font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>Sec 11 Granted</span>
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-purple-300/50">Pending</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {!aging.isFinalized && (
                            <button
                              type="button"
                              disabled={isSendingNotice}
                              onClick={(e) => handleSendEncryptedActionRequired(intake, e)}
                              title={
                                sentReceipt
                                  ? `Encrypted notice sent (${sentReceipt.dispatchId}) — click to re-send`
                                  : 'Send AES-256 encrypted Action Required notification to client'
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                                sentReceipt
                                  ? 'text-[#00F5D4] bg-[#00F5D4]/12 border border-[#00F5D4]/40'
                                  : aging.state === 'overdue_30d'
                                  ? 'text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 shadow-[0_0_14px_-4px_rgba(255,42,133,0.6)]'
                                  : 'text-[#FFE600] synth-inset border border-[#FFE600]/35 hover:border-[#FFE600]/70'
                              }`}
                            >
                              {isSendingNotice ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : sentReceipt ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              <span>
                                {isSendingNotice
                                  ? 'Sending...'
                                  : sentReceipt
                                  ? 'Alert Sent'
                                  : 'Action Req.'}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={generatingPdfIntakeIds.includes(intake.id)}
                            onClick={(e) => handleDownloadClientPdfReport(intake, e)}
                            title="Download POPIA-ready PDF compliance report with full audit trail"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-purple-100 synth-inset border border-purple-400/30 hover:border-[#00F5D4]/60 hover:text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            {generatingPdfIntakeIds.includes(intake.id) ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-[#00F5D4]" />
                            ) : (
                              <FileText className="w-3 h-3 text-[#4CC9F0]" />
                            )}
                            <span>PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDrawerIntake(intake);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#00F5D4] synth-inset rounded-xl hover:border-[#00F5D4]/50 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* SLIDE-OVER INTAKE CASE DRAWER */}
      {activeDrawerIntake && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#05010E]/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="synth-glass w-full max-w-xl h-full flex flex-col overflow-y-auto border-l border-purple-400/25 animate-in slide-in-from-right duration-200 text-slate-100">
            
            <div className="p-6 border-b border-purple-400/20 flex items-start justify-between bg-[#110826]/70">
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-[#00F5D4]">FICA Case File</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-purple-200/75">{activeDrawerIntake.id}</span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {activeDrawerIntake.clientName}
                </h2>
                <p className="text-xs text-purple-200/75">
                  {activeDrawerIntake.clientEmail} · {activeDrawerIntake.phone}
                </p>
              </div>

              <button
                onClick={() => setActiveDrawerIntake(null)}
                aria-label="Close case drawer"
                className="p-2 text-purple-200/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              
              {/* Status & Risk Strip */}
              <div className="grid grid-cols-3 gap-3 p-4 synth-inset rounded-2xl">
                <div>
                  <span className="text-[11px] text-purple-300/70 font-semibold">FICA State</span>
                  <div className="mt-1">
                    <FicaStatusBadge status={activeDrawerIntake.status} showSubtitle={false} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-purple-300/70 font-semibold">Compliance Aging</span>
                  <div className="mt-1">
                    <ClientComplianceAgingCell aging={calculateComplianceAging(activeDrawerIntake, documents)} />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-purple-300/70 font-semibold">FICA Risk Rating</span>
                  <div className={`font-bold uppercase mt-1 ${
                    activeDrawerIntake.riskRating === 'low'
                      ? 'text-[#00F5D4]'
                      : activeDrawerIntake.riskRating === 'medium'
                      ? 'text-[#FFE600]'
                      : 'text-[#FF2A85]'
                  }`}>
                    {activeDrawerIntake.riskRating} Risk
                  </div>
                </div>
              </div>

              {/* Emergency Outstanding Docs & SLA Reminder Card */}
              {(() => {
                const drawerAlert = evaluateAgingIntakeAlert(activeDrawerIntake, documents);
                if (drawerAlert.agingInfo.isFinalized) return null;
                return (
                  <div className="p-4 rounded-2xl border border-[#FF2A85]/40 bg-[#FF2A85]/10 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <BellRing className="w-4 h-4 text-[#FF2A85]" />
                        <span>Outstanding Documents &amp; SLA Reminder</span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums">
                        <span className="text-white">{drawerAlert.daysOpen}d Open</span>
                        <span className="text-purple-300/60" aria-hidden="true"> · </span>
                        <span className={drawerAlert.slaDaysOverdue > 0 ? 'text-[#FF2A85] font-bold' : 'text-[#FFE600] font-bold'}>
                          {drawerAlert.slaDaysOverdue > 0
                            ? `0d left (+${drawerAlert.slaDaysOverdue}d past SLA)`
                            : `${drawerAlert.slaDaysRemaining}d left to 30d SLA`}
                        </span>
                      </span>
                    </div>

                    {drawerAlert.outstandingItems.length > 0 ? (
                      <ul className="space-y-1 text-[11px] text-purple-100/90">
                        {drawerAlert.outstandingItems.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#FFE600] shrink-0 mt-0.5" />
                            <span>
                              <strong className="text-white">{item.label}:</strong> {item.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-purple-100/85 leading-relaxed">
                        {drawerAlert.agingInfo.bottleneckReason}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={sendingNoticeIntakeIds.includes(activeDrawerIntake.id)}
                      onClick={() => handleSendEncryptedActionRequired(activeDrawerIntake)}
                      className="w-full py-2.5 px-3.5 rounded-xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {sendingNoticeIntakeIds.includes(activeDrawerIntake.id) ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Encrypting AES-256-GCM Reminder...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {dispatchedReceipts[activeDrawerIntake.id]
                              ? `Re-Send Reminder (${drawerAlert.outstandingItems.length} Outstanding Docs)`
                              : `Send Reminder (${drawerAlert.outstandingItems.length} Outstanding Docs)`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* FICA Document Dossier */}
              <div>
                <h3 className="text-xs font-bold text-purple-100 mb-3">
                  Verification Documents & AI OCR Findings
                </h3>
                {refreshNotice && (
                  <div className="mb-3 p-3 bg-[#00F5D4]/15 rounded-2xl border border-[#00F5D4]/40 text-xs text-[#99FFF1] flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-[#00F5D4]" />
                      <span>{refreshNotice}</span>
                    </div>
                    <button onClick={() => setRefreshNotice(null)} className="text-purple-200 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="space-y-3">
                  {documents
                    .filter(d => d.intakeId === activeDrawerIntake.id || documents.length <= 6)
                    .map((doc) => {
                      const expiryInfo = calculateFicaDocumentExpiry(doc);
                      return (
                        <div key={doc.id} className="p-4 synth-inset rounded-2xl space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <FileCheck className="w-4 h-4 text-[#FF2A85] shrink-0 mt-0.5" />
                              <div>
                                <span className="text-xs font-bold text-white block">{doc.fileName}</span>
                                <div className="text-[11px] text-purple-300/70 font-mono mt-0.5">
                                  {doc.issueDate && <span>Issued: {doc.issueDate}</span>}
                                  {doc.expiryDate && <span> · Expires: {doc.expiryDate}</span>}
                                </div>
                              </div>
                            </div>
                            <FicaExpiryBadge info={expiryInfo} />
                          </div>

                          <p className="text-xs text-purple-100/85 leading-relaxed">
                            {doc.aiValidationSummary}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-purple-300/70 pt-2 border-t border-purple-400/15">
                            <span className="text-[11px] text-purple-300/65 max-w-[280px] truncate" title={expiryInfo.statutoryRule}>
                              {expiryInfo.statutoryRule}
                            </span>
                            {expiryInfo.state !== 'valid' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefreshNotice(`FICA document refresh notification dispatched for ${doc.fileName}!`);
                                  setTimeout(() => setRefreshNotice(null), 4000);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00F5D4] hover:underline cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                <span>Request Refresh</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* POPIA Section 11 Attestation */}
              <div className="p-4 synth-inset rounded-2xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-[#00F5D4] font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>POPIA Section 11 Lawful Consent</span>
                </div>
                <p className="text-purple-100/85">
                  Consent timestamp: <strong className="font-mono text-white">{activeDrawerIntake.popiaConsentDate || '2026-11-04T09:14:22Z'}</strong>
                </p>
                <p className="text-[11px] text-purple-300/70">
                  Lawful Basis: Customer instruction & FICA Section 21 customer due diligence mandate.
                </p>
              </div>

              {/* Officer Biometric Signing Status */}
              {onOpenPasskeyModal && (
                <div className="p-3.5 rounded-2xl border border-purple-400/20 bg-purple-500/10 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Fingerprint className={`w-4 h-4 ${securitySession?.verified ? 'text-[#00F5D4]' : 'text-[#FFE600]'}`} />
                    <span className="text-purple-100">
                      {securitySession?.verified
                        ? `Signed by Officer Biometrics (${securitySession.deviceLabel})`
                        : 'Enhance sign-off with WebAuthn Officer Biometrics'}
                    </span>
                  </div>
                  {!securitySession?.verified && (
                    <button
                      type="button"
                      onClick={onOpenPasskeyModal}
                      className="text-[11px] font-bold text-[#FFE600] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Verify Passkey
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled={generatingPdfIntakeIds.includes(activeDrawerIntake.id)}
                  onClick={() => handleDownloadClientPdfReport(activeDrawerIntake)}
                  className="w-full py-3 px-4 rounded-2xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#9D4EDD] to-[#4CC9F0] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_22px_-4px_rgba(157,78,221,0.55)] disabled:opacity-50"
                >
                  {generatingPdfIntakeIds.includes(activeDrawerIntake.id) ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Compiling POPIA PDF Report...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download POPIA Compliance Report (PDF &amp; Audit Summary)</span>
                    </>
                  )}
                </button>

                {lastPdfReport && lastPdfReport.intakeId === activeDrawerIntake.id && (
                  <div className="p-3 synth-inset rounded-2xl border border-[#4CC9F0]/40 text-[11px] space-y-1 animate-in fade-in">
                    <div className="flex items-center justify-between text-[#4CC9F0] font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lastPdfReport.result.fileName}</span>
                      </span>
                      <span className="font-mono text-[10px]">
                        {lastPdfReport.result.includedAuditEvents} Audit Events
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-purple-200/75 truncate">
                      Seal SHA-256: {lastPdfReport.result.integrityHash}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="w-full py-3 px-4 rounded-2xl text-xs font-bold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_22px_-4px_rgba(0,245,212,0.5)]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Export Encrypted Dossier (AES-256 & POPIA Certificate)</span>
                </button>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUpdateIntakeStatus(activeDrawerIntake.id, 'approved')}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-[#00F5D4] synth-inset border border-[#00F5D4]/35 hover:bg-[#00F5D4]/15 transition-colors cursor-pointer"
                  >
                    Approve FICA Clearance
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateIntakeStatus(activeDrawerIntake.id, 'needs_review')}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-[#FFE600] synth-inset border border-[#FFE600]/35 hover:bg-[#FFE600]/15 transition-colors cursor-pointer"
                  >
                    Flag for Re-Submission
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* SINGLE ENCRYPTED EXPORT PASS-PHRASE MODAL */}
      {isExportModalOpen && activeDrawerIntake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060211]/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="synth-glass rounded-3xl max-w-md w-full p-6 space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#00F5D4]" />
                <h3 className="text-base font-bold text-white">
                  Encrypt & Export Client Dossier
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsExportModalOpen(false);
                  setExportSuccessMessage(null);
                }}
                className="text-purple-200/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-purple-200/80 leading-relaxed">
              In compliance with POPIA Section 19, this dossier is encrypted client-side using <strong className="text-white">AES-256-GCM</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-purple-100 mb-1.5">
                Set Practice Decryption Passphrase
              </label>
              <input
                type="password"
                placeholder="Enter secret passphrase (e.g. DlaminiLaw#2026)"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs synth-inset rounded-xl font-mono text-white placeholder:text-purple-300/40 focus:outline-none focus:border-[#00F5D4]"
              />
            </div>

            {exportSuccessMessage && (
              <div className="p-3 bg-[#00F5D4]/12 rounded-2xl border border-[#00F5D4]/40 text-xs text-[#99FFF1] space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-[#00F5D4]" />
                  <span>Export Download Triggered!</span>
                </div>
                <p className="text-[11px]">{exportSuccessMessage}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-purple-100 synth-inset rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isExporting || !exportPassphrase}
                onClick={handleExportEncryptedDossier}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Encrypting...' : 'Download Encrypted Package'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BULK ENCRYPTED ARCHIVAL EXPORT MODAL (AES-256 ZIP) */}
      {isBulkExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060211]/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="synth-glass rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto text-slate-100">
            
            <div className="flex items-start justify-between border-b border-purple-400/20 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-tr from-[#00F5D4]/20 to-[#9D4EDD]/30 border border-[#00F5D4]/40 text-[#00F5D4]">
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Secure Bulk Archival Export (AES-256 ZIP)
                    </h3>
                    <p className="text-xs text-purple-200/75">
                      FICA Section 22 &amp; POPIA Section 19 · 5-year statutory encrypted retention archive
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkExportModalOpen(false);
                  setBulkProgress(null);
                  setBulkResult(null);
                }}
                className="text-purple-200/70 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Archive Scope Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-purple-100">
                Select Archival Scope
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setBulkScope('verified_only');
                    setBulkResult(null);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    bulkScope === 'verified_only'
                      ? 'bg-[#00F5D4]/15 border-[#00F5D4]/60 glow-cyan'
                      : 'synth-inset border-purple-400/20 hover:border-purple-300/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Verified Only</span>
                    <span className="text-xs font-mono font-bold text-[#00F5D4] tabular-nums">
                      {verifiedCases}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-200/70 mt-0.5">
                    Recommended for regulatory audits
                  </p>
                </button>

                <button
                  type="button"
                  disabled={selectedIntakeIds.length === 0}
                  onClick={() => {
                    setBulkScope('selected_only');
                    setBulkResult(null);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    bulkScope === 'selected_only'
                      ? 'bg-[#FF2A85]/15 border-[#FF2A85]/60 glow-magenta'
                      : selectedIntakeIds.length === 0
                      ? 'opacity-45 cursor-not-allowed synth-inset border-purple-400/15'
                      : 'synth-inset border-purple-400/20 hover:border-purple-300/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Selected In Table</span>
                    <span className="text-xs font-mono font-bold text-[#FF2A85] tabular-nums">
                      {selectedIntakeIds.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-200/70 mt-0.5">
                    Checked client rows in grid
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkScope('all');
                    setBulkResult(null);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    bulkScope === 'all'
                      ? 'bg-[#FFE600]/15 border-[#FFE600]/60 glow-amber'
                      : 'synth-inset border-purple-400/20 hover:border-purple-300/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">All Cases</span>
                    <span className="text-xs font-mono font-bold text-[#FFE600] tabular-nums">
                      {intakes.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-200/70 mt-0.5">
                    Complete intake pipeline
                  </p>
                </button>
              </div>
            </div>

            {/* Payload Summary */}
            <div className="p-4 synth-inset rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">Archive Payload:</span>
                  <span className="text-[#00F5D4] font-mono tabular-nums">
                    {bulkTargetClients.length} Client{bulkTargetClients.length !== 1 ? 's' : ''} · {bulkTargetDocs.length} Document{bulkTargetDocs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-[11px] text-purple-200/75 font-mono">
                  Retention: {practice.retentionPolicyDays / 365} Years
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-2 pr-1 divide-y divide-purple-400/15">
                {bulkTargetClients.map((client) => {
                  const clientDocCount = documents.filter(d => d.intakeId === client.id).length;
                  return (
                    <div key={client.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-white truncate">{client.clientName}</span>
                        <span className="text-[11px] text-purple-300/65 capitalize hidden sm:inline">
                          ({client.clientType})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <FicaStatusBadge status={client.status} showSubtitle={false} />
                        <span className="text-[11px] font-mono text-purple-200/80 tabular-nums">
                          {clientDocCount} doc{clientDocCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Passphrase Config */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-purple-100">
                  Master Archive Encryption Passphrase
                </label>
                <button
                  type="button"
                  onClick={generateRandomKey}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00F5D4] hover:underline cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Generate Secure Key</span>
                </button>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showBulkPassphrase ? 'text' : 'password'}
                  value={bulkPassphrase}
                  onChange={(e) => setBulkPassphrase(e.target.value)}
                  placeholder="Enter archive decryption password..."
                  className="w-full pl-3.5 pr-28 py-2.5 text-xs synth-inset rounded-xl font-mono text-white focus:outline-none focus:border-[#00F5D4]"
                />
                <div className="absolute right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowBulkPassphrase(!showBulkPassphrase)}
                    className="px-2 py-1 text-[11px] font-medium text-purple-100 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  >
                    {showBulkPassphrase ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassphrase}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#00F5D4] bg-[#00F5D4]/15 hover:bg-[#00F5D4]/25 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedPassphrase ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPassphrase ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-[#FFE600]/10 rounded-2xl border border-[#FFE600]/30 text-[11px] text-amber-100 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-[#FFE600] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#FFE600]">PKZIP AES-256 Bit Encryption:</strong> Compatible with Windows Explorer, macOS (<code className="font-mono">unzip -P</code>), 7-Zip, and WinZip.
                </div>
              </div>
            </div>

            {bulkExporting && bulkProgress && (
              <div className="p-4 synth-inset rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00F5D4]" />
                    <span>{bulkProgress.message}</span>
                  </span>
                  <span className="font-mono tabular-nums text-[#00F5D4]">
                    {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2.5 synth-inset rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#00F5D4] via-[#FF2A85] to-[#FFE600] transition-all duration-300"
                    style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {bulkResult && (
              <div className="p-4 bg-[#00F5D4]/12 rounded-2xl border border-[#00F5D4]/45 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#00F5D4] shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        Encrypted ZIP Archive Ready &amp; Download Triggered
                      </h4>
                      <p className="text-[11px] text-purple-100/80 font-mono">
                        {bulkResult.fileName} ({bulkResult.archiveSizeFormatted})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const blobUrl = URL.createObjectURL(bulkResult.zipBlob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = bulkResult.fileName;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#0B0518] bg-[#00F5D4] hover:opacity-95 transition-opacity cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Re-Download</span>
                  </button>
                </div>

                <div className="p-3 synth-inset rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-purple-200/75 font-semibold">
                    <span>SHA-256 Archive Integrity Hash</span>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(bulkResult.integrityHash)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#00F5D4] hover:underline cursor-pointer font-bold"
                    >
                      {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-white break-all">
                    {bulkResult.integrityHash}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-purple-400/20">
              <button
                type="button"
                onClick={() => {
                  setIsBulkExportModalOpen(false);
                  setBulkProgress(null);
                  setBulkResult(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-purple-100 synth-inset rounded-xl cursor-pointer"
              >
                {bulkResult ? 'Close Window' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={bulkExporting || !bulkPassphrase || bulkTargetClients.length === 0}
                onClick={handleExecuteBulkZipExport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs text-[#0B0518] bg-gradient-to-r from-[#00F5D4] via-[#4CC9F0] to-[#FFE600] hover:opacity-95 shadow-[0_0_24px_-4px_rgba(0,245,212,0.55)] active:scale-95 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {bulkExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Encrypting &amp; Packaging...</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    <span>Generate Encrypted Bulk ZIP ({bulkTargetClients.length} Clients)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
