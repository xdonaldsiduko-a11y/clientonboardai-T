export type ProfessionType = 'law_firm' | 'accounting_firm' | 'consulting_firm';

export type ClientType = 'individual' | 'company' | 'trust';

export type IntakeStatus = 'draft' | 'submitted' | 'ai_verified' | 'needs_review' | 'approved' | 'rejected';

export type RiskRating = 'low' | 'medium' | 'high';

export type FicaDocType = 'sa_id' | 'proof_of_residence' | 'company_registration' | 'tax_clearance';

export interface PracticeProfile {
  id: string;
  practiceName: string;
  professionType: ProfessionType;
  ownerUid: string;
  adminEmail: string;
  ficaOfficerName: string;
  retentionPolicyDays: number;
  city: string;
  province: string;
  tagline: string;
}

export interface ClientIntake {
  id: string;
  practiceId: string;
  clientEmail: string;
  clientName: string;
  clientType: ClientType;
  phone: string;
  idNumber: string;
  companyName?: string;
  registrationNumber?: string;
  taxNumber?: string;
  status: IntakeStatus;
  popiaConsent: boolean;
  popiaConsentDate?: string;
  currentStep: number;
  magicLinkToken: string;
  riskRating: RiskRating;
  riskReasons?: string[];
  createdAt: string;
  updatedAt: string;
}

export type FicaExpiryState = 'valid' | 'expiring_soon' | 'expired';

export interface VerificationDocument {
  id: string;
  intakeId: string;
  docType: FicaDocType;
  fileName: string;
  fileSize: number;
  fileMime: string;
  status: 'pending' | 'valid' | 'flagged' | 'rejected';
  aiConfidence: number;
  aiValidationSummary: string;
  issueDate?: string;
  expiryDate?: string;
  extractedData?: {
    idNumber?: string;
    birthDate?: string;
    gender?: string;
    citizenStatus?: string;
    luhnValid?: boolean;
    utilityDate?: string;
    isUnder90Days?: boolean;
    utilityIssuer?: string;
    addressText?: string;
    companyRegistrationNumber?: string;
    companyName?: string;
    redactionFlags?: string[];
    daysRemaining?: number;
    statutoryRule?: string;
  };
  uploadedAt: string;
}

export interface AuditLog {
  id: string;
  intakeId: string;
  action: string;
  performedBy: string;
  ipAddress: string;
  userAgent: string;
  popiaLawfulBasis: string;
  hash: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface FunnelStageMetric {
  step: number;
  name: string;
  eventKey: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
  avgTimeSeconds: number;
}

export interface PasskeyCredential {
  id: string;
  rawId: string;
  practiceId: string;
  officerName: string;
  officerEmail: string;
  deviceLabel: string;
  authenticatorAttachment: string;
  transports: string[];
  algorithm: string;
  signCount: number;
  createdAt: string;
  lastUsedAt?: string;
  verificationMode: 'hardware_webauthn' | 'virtual_fido2';
}

export interface OfficerSecuritySession {
  verified: boolean;
  assuranceLevel: 'standard' | 'aal3_biometric';
  officerName: string;
  officerEmail: string;
  credentialId?: string;
  deviceLabel?: string;
  verifiedAt?: string;
  challengeSignature?: string;
  verificationMode?: 'hardware_webauthn' | 'virtual_fido2';
}

export type ComplianceAgingState = 'finalized' | 'on_track' | 'approaching_30d' | 'overdue_30d';

export interface ComplianceAgingInfo {
  state: ComplianceAgingState;
  daysOpen: number;
  daysOverThreshold: number;
  daysUntilThreshold: number;
  isFinalized: boolean;
  isOverdue30Days: boolean;
  slaThresholdDays: number;
  bottleneckReason: string;
}

export interface EncryptedActionNotificationReceipt {
  dispatchId: string;
  intakeId: string;
  clientEmail: string;
  clientName: string;
  daysOpen: number;
  algorithm: string;
  ivBase64Url: string;
  ciphertextPreview: string;
  payloadSha256: string;
  keyFingerprint: string;
  magicResumeUrl: string;
  dispatchedAt: string;
  dispatchedBy: string;
  outstandingDocuments?: string[];
  reminderSummary?: string;
}

export type OutstandingDocumentIssue =
  | 'missing'
  | 'pending'
  | 'flagged'
  | 'rejected'
  | 'expired'
  | 'expiring_soon';

export interface OutstandingDocumentItem {
  docType: FicaDocType;
  label: string;
  fileName?: string;
  issue: OutstandingDocumentIssue;
  detail: string;
  daysRemaining?: number;
  daysOverdue?: number;
}

export interface IntakeDocumentCompletionAlert {
  intake: ClientIntake;
  daysOpen: number;
  slaDaysRemaining: number;
  slaDaysOverdue: number;
  earliestDocDaysRemaining: number | null;
  completedDocsCount: number;
  requiredDocsCount: number;
  isDocumentCompletionMet: boolean;
  exceeds7DaysWithoutDocs: boolean;
  hasAnyOutstandingDocs: boolean;
  urgencyScore: number;
  missingItems: string[];
  outstandingItems: OutstandingDocumentItem[];
  summaryReason: string;
  agingInfo: ComplianceAgingInfo;
}

export type OfficerReminderWorkflowStatus =
  | 'scheduled'
  | 'daily_pending'
  | 'reminder_sent'
  | 'client_responded';

export interface OfficerReminderWorkflow {
  id: string;
  practiceId: string;
  intakeId: string;
  ownerUid?: string;
  clientName: string;
  clientEmail: string;
  officerEmail: string;
  status: OfficerReminderWorkflowStatus;
  leadDaysBeforeExpiry: number;
  expiryDateIso: string;
  targetNotifyDateIso: string;
  outstandingSummary: string;
  dailyReminderActive: boolean;
  lastDailyNagDate?: string;
  channelsSynced: string;
  googleEventId?: string;
  googleTaskId?: string;
  msEventId?: string;
  msTaskListId?: string;
  msTaskId?: string;
  automatedAt: string;
  reminderSentAt?: string;
  clientRespondedAt?: string;
}

export interface MicrosoftConnectionStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  displayName?: string;
  redirectUri?: string;
}

export interface EmailDeliverabilityReport {
  domain: string;
  hasMx: boolean;
  mxHosts: string[];
  spfValid: boolean;
  spfRecord: string | null;
  dmarcValid: boolean;
  dmarcRecord: string | null;
  dmarcPolicy: string | null;
  contentScore: number;
  warnings: string[];
  recommendations: string[];
  checkedAt: string;
}

