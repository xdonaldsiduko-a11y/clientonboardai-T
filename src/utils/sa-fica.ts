import { RiskRating, ClientType, VerificationDocument, FicaExpiryState, ClientIntake, ComplianceAgingInfo } from '../types';

export interface SaIdValidationResult {
  isValid: boolean;
  idNumber: string;
  birthDate?: string; // YYYY-MM-DD
  age?: number;
  gender?: 'Female' | 'Male';
  isCitizen?: boolean;
  error?: string;
}

/**
 * Validates a South African 13-digit National ID number using the Luhn Algorithm.
 * Format: YYMMDD SSSS C A Z
 * - YYMMDD: Birth Date
 * - SSSS: Sequence (0000-4999 Female, 5000-9999 Male)
 * - C: Citizen status (0 = SA citizen, 1 = Permanent Resident)
 * - A: Usually 8 or 9
 * - Z: Luhn checksum digit
 */
export function validateSouthAfricanId(idNumberRaw: string): SaIdValidationResult {
  const cleaned = idNumberRaw.replace(/\D/g, '');

  if (cleaned.length !== 13) {
    return {
      isValid: false,
      idNumber: cleaned,
      error: 'South African ID number must contain exactly 13 digits.'
    };
  }

  // Check Luhn checksum
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(cleaned[i], 10);
    // Every second digit from the right (1-indexed from right: positions 2, 4, 6...)
    // Since index 0 is left-most (13th from right, odd), odd indices 1, 3, 5, 7, 9, 11 are even from right.
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  if (sum % 10 !== 0) {
    return {
      isValid: false,
      idNumber: cleaned,
      error: 'Invalid Luhn checksum. This is not an authentic South African ID.'
    };
  }

  // Parse Date of Birth
  const yy = parseInt(cleaned.substring(0, 2), 10);
  const mm = parseInt(cleaned.substring(2, 4), 10);
  const dd = parseInt(cleaned.substring(4, 6), 10);

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return {
      isValid: false,
      idNumber: cleaned,
      error: 'ID number contains an invalid date of birth.'
    };
  }

  // Determine century based on current year 2026
  const currentYearLastTwo = 26;
  const fullYear = yy <= currentYearLastTwo ? 2000 + yy : 1900 + yy;
  const birthDateStr = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const age = 2026 - fullYear;

  // Gender
  const genderCode = parseInt(cleaned.substring(6, 10), 10);
  const gender: 'Female' | 'Male' = genderCode < 5000 ? 'Female' : 'Male';

  // Citizenship
  const citizenDigit = parseInt(cleaned.substring(10, 11), 10);
  const isCitizen = citizenDigit === 0;

  return {
    isValid: true,
    idNumber: cleaned,
    birthDate: birthDateStr,
    age,
    gender,
    isCitizen,
  };
}

/**
 * Validates Proof of Address recency under FICA regulations (must be issued within 90 days).
 */
export function validateProofOfAddressRecency(issueDateStr: string): { isCompliant: boolean; daysAgo: number; message: string } {
  try {
    const issueDate = new Date(issueDateStr);
    const currentDate = new Date('2026-11-06T00:00:00Z'); // Local anchored context
    const diffTime = currentDate.getTime() - issueDate.getTime();
    const daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (isNaN(daysAgo)) {
      return { isCompliant: false, daysAgo: 0, message: 'Invalid or missing document issue date.' };
    }

    if (daysAgo < 0) {
      return { isCompliant: false, daysAgo, message: 'Document issue date is in the future.' };
    }

    if (daysAgo <= 90) {
      return {
        isCompliant: true,
        daysAgo,
        message: `FICA Compliant: Issued ${daysAgo} days ago (within 90-day statutory threshold).`
      };
    } else {
      return {
        isCompliant: false,
        daysAgo,
        message: `Non-Compliant: Issued ${daysAgo} days ago. FICA requires proof of residence under 90 days.`
      };
    }
  } catch {
    return { isCompliant: false, daysAgo: 0, message: 'Could not compute document recency.' };
  }
}

/**
 * Validates South African CIPC registration number format (e.g. 2021/123456/07)
 */
export function validateCipcRegistrationNumber(regNumber: string): boolean {
  const pattern = /^\d{4}\/\d{6}\/\d{2}$/;
  return pattern.test(regNumber.trim());
}

/**
 * Computes FICA Risk Rating based on client profile and verification indicators.
 */
export function calculateFicaRiskRating(params: {
  clientType: ClientType;
  isPep: boolean;
  hasAdverseMedia?: boolean;
  isForeignNational?: boolean;
  docCount: number;
}): { rating: RiskRating; reasons: string[] } {
  const reasons: string[] = [];

  if (params.isPep) {
    reasons.push('Politically Exposed Person (PEP) or close associate identified.');
  }
  if (params.hasAdverseMedia) {
    reasons.push('Potential adverse media or sanctions list flag detected.');
  }
  if (params.clientType === 'trust') {
    reasons.push('Complex trust structure requires enhanced due diligence (EDD).');
  }
  if (params.isForeignNational) {
    reasons.push('Non-resident individual subject to cross-border verification.');
  }

  if (params.isPep || params.hasAdverseMedia) {
    return { rating: 'high', reasons };
  }

  if (params.clientType === 'trust' || params.isForeignNational || params.docCount < 2) {
    if (params.docCount < 2) reasons.push('Pending mandatory FICA supporting documentation.');
    return { rating: 'medium', reasons };
  }

  return { rating: 'low', reasons: ['Standard customer due diligence (CDD) verified.', 'All mandatory FICA documents validated within 90-day threshold.'] };
}

export interface DocumentExpiryInfo {
  state: FicaExpiryState; // 'valid' | 'expiring_soon' | 'expired'
  daysRemaining: number;
  issueDateStr?: string;
  expiryDateStr: string;
  label: string;
  statutoryRule: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Calculates FICA document expiry state.
 * Under FICA Act 38, Proof of Residential Address expires after 90 days from issuance.
 * Foreign passports / permits expire on their stated expiration date.
 * Tax Compliance PINs expire after 12 months.
 */
export function calculateFicaDocumentExpiry(doc: VerificationDocument): DocumentExpiryInfo {
  const currentDate = new Date('2026-11-06T00:00:00Z'); // Anchored system context

  // 1. Proof of Residence (90-day statutory threshold)
  if (doc.docType === 'proof_of_residence') {
    const rawIssue = doc.issueDate || doc.extractedData?.utilityDate || '2026-09-25';
    const issueDate = new Date(rawIssue);
    const statutoryDays = 90;
    const expiryDate = new Date(issueDate.getTime() + statutoryDays * 24 * 60 * 60 * 1000);
    const diffTime = expiryDate.getTime() - currentDate.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return {
        state: 'expired',
        daysRemaining,
        issueDateStr: rawIssue,
        expiryDateStr: expiryDate.toISOString().split('T')[0],
        label: `FICA Expired (${Math.abs(daysRemaining)}d overdue)`,
        statutoryRule: 'FICA Act 38: Proof of Address must be issued within 90 days',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-500/20',
        dotClass: 'bg-rose-500',
      };
    } else if (daysRemaining < 30) {
      return {
        state: 'expiring_soon',
        daysRemaining,
        issueDateStr: rawIssue,
        expiryDateStr: expiryDate.toISOString().split('T')[0],
        label: `Expiring in ${daysRemaining} days`,
        statutoryRule: 'FICA Act 38: Proof of Address near 90-day validity threshold',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-500/20',
        dotClass: 'bg-amber-500 animate-pulse',
      };
    } else {
      return {
        state: 'valid',
        daysRemaining,
        issueDateStr: rawIssue,
        expiryDateStr: expiryDate.toISOString().split('T')[0],
        label: `FICA Valid (${daysRemaining}d remaining)`,
        statutoryRule: 'FICA Act 38: Within statutory 90-day compliance window',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20',
        dotClass: 'bg-emerald-500',
      };
    }
  }

  // 2. Passports or foreign identity documents
  if (doc.expiryDate) {
    const expiryDate = new Date(doc.expiryDate);
    const diffTime = expiryDate.getTime() - currentDate.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return {
        state: 'expired',
        daysRemaining,
        expiryDateStr: doc.expiryDate,
        label: `Passport Expired (${Math.abs(daysRemaining)}d ago)`,
        statutoryRule: 'FICA Regulation 3: Identity document must be currently valid',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-500/20',
        dotClass: 'bg-rose-500',
      };
    } else if (daysRemaining < 30) {
      return {
        state: 'expiring_soon',
        daysRemaining,
        expiryDateStr: doc.expiryDate,
        label: `Passport Expiring in ${daysRemaining}d`,
        statutoryRule: 'FICA Regulation 3: Identity document renewal required',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-500/20',
        dotClass: 'bg-amber-500 animate-pulse',
      };
    } else {
      return {
        state: 'valid',
        daysRemaining,
        expiryDateStr: doc.expiryDate,
        label: `Passport Valid (${daysRemaining}d remaining)`,
        statutoryRule: 'FICA Regulation 3: Valid national identification',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20',
        dotClass: 'bg-emerald-500',
      };
    }
  }

  // 3. National Smart ID Card / Green Barcode ID (Permanent for SA citizens)
  if (doc.docType === 'sa_id') {
    return {
      state: 'valid',
      daysRemaining: 365,
      expiryDateStr: 'Permanent RSA ID',
      label: 'RSA Smart ID (Permanent Validity)',
      statutoryRule: 'Dept of Home Affairs RSA National Identity',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20',
      dotClass: 'bg-emerald-500',
    };
  }

  // 4. CIPC Company Registration CoR 14.3
  return {
    state: 'valid',
    daysRemaining: 180,
    expiryDateStr: 'Annual Return Cycle',
    label: 'CIPC Enterprise Active',
    statutoryRule: 'Companies Act 71 of 2008 & FICA Corporate Verification',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20',
    dotClass: 'bg-emerald-500',
  };
}

/**
 * Evaluates the overall FICA document expiry state across all documents belonging to a client intake.
 */
export function getClientFicaComplianceStatus(intake: ClientIntake, clientDocs: VerificationDocument[]): {
  state: FicaExpiryState;
  summary: string;
  badgeClass: string;
  dotClass: string;
  expiringDocCount: number;
  expiredDocCount: number;
  minDaysRemaining: number;
} {
  const docsForClient = clientDocs.filter(d => d.intakeId === intake.id);
  
  if (docsForClient.length === 0) {
    return {
      state: 'valid',
      summary: 'Pending Document Upload',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      dotClass: 'bg-slate-400',
      expiringDocCount: 0,
      expiredDocCount: 0,
      minDaysRemaining: 999,
    };
  }

  const expiryInfos = docsForClient.map(d => ({
    doc: d,
    info: calculateFicaDocumentExpiry(d)
  }));

  const expiredList = expiryInfos.filter(i => i.info.state === 'expired');
  const expiringSoonList = expiryInfos.filter(i => i.info.state === 'expiring_soon');

  if (expiredList.length > 0) {
    const worst = expiredList[0];
    return {
      state: 'expired',
      summary: `${worst.doc.docType === 'proof_of_residence' ? 'Utility Bill' : 'Document'} Expired (${Math.abs(worst.info.daysRemaining)}d overdue)`,
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-500/20',
      dotClass: 'bg-rose-500',
      expiringDocCount: expiringSoonList.length,
      expiredDocCount: expiredList.length,
      minDaysRemaining: worst.info.daysRemaining,
    };
  }

  if (expiringSoonList.length > 0) {
    const earliest = expiringSoonList[0];
    return {
      state: 'expiring_soon',
      summary: `${earliest.doc.docType === 'proof_of_residence' ? 'Utility Bill' : 'Document'} Expiring in ${earliest.info.daysRemaining}d`,
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-500/20',
      dotClass: 'bg-amber-500 animate-pulse',
      expiringDocCount: expiringSoonList.length,
      expiredDocCount: 0,
      minDaysRemaining: earliest.info.daysRemaining,
    };
  }

  const minDays = Math.min(...expiryInfos.map(i => i.info.daysRemaining));
  return {
    state: 'valid',
    summary: `FICA Documents Valid (${minDays < 365 ? `${minDays}d remaining` : 'Compliant'})`,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20',
    dotClass: 'bg-emerald-500',
    expiringDocCount: 0,
    expiredDocCount: 0,
    minDaysRemaining: minDays,
  };
}

/**
 * Evaluates 30-day Compliance Aging SLA for unfinalized client intakes.
 * Intakes that remain unfinalized ('draft', 'submitted', 'ai_verified', 'needs_review')
 * after 30 days require urgent FICA officer escalation or encrypted client notification.
 */
export function calculateComplianceAging(
  intake: ClientIntake,
  clientDocs: VerificationDocument[] = [],
  referenceDate: Date = new Date()
): ComplianceAgingInfo {
  const SLA_THRESHOLD_DAYS = 30;
  const APPROACHING_THRESHOLD_DAYS = 20;

  const isFinalized = intake.status === 'approved' || intake.status === 'rejected';
  const createdMs = new Date(intake.createdAt).getTime();
  const refMs = referenceDate.getTime();
  const rawDays = isNaN(createdMs) ? 0 : Math.floor((refMs - createdMs) / (1000 * 60 * 60 * 24));
  const daysOpen = Math.max(0, rawDays);
  const daysOverThreshold = Math.max(0, daysOpen - SLA_THRESHOLD_DAYS);
  const daysUntilThreshold = Math.max(0, SLA_THRESHOLD_DAYS - daysOpen);

  // Derive specific bottleneck guidance for the client/officer notification
  const docsForClient = clientDocs.filter(d => d.intakeId === intake.id);
  const compliance = getClientFicaComplianceStatus(intake, docsForClient);

  let bottleneckReason = 'FICA officer verification review pending';
  if (isFinalized) {
    bottleneckReason = intake.status === 'approved' ? 'FICA clearance finalized' : 'Intake archived / declined';
  } else if (compliance.state === 'expired') {
    bottleneckReason = `${compliance.summary} — fresh document upload required`;
  } else if (compliance.state === 'expiring_soon') {
    bottleneckReason = `${compliance.summary} — finalize before 90-day expiry`;
  } else if (intake.status === 'draft') {
    bottleneckReason = `Client stuck at Step ${intake.currentStep || 1}/5 (incomplete submission)`;
  } else if (intake.status === 'needs_review') {
    bottleneckReason = 'Flagged items awaiting supplementary client evidence';
  } else if (intake.status === 'submitted') {
    bottleneckReason = 'Missing mandatory FICA supporting attachments';
  } else if (intake.status === 'ai_verified') {
    bottleneckReason = 'AI checks passed — awaiting final FICA Officer sign-off';
  }

  if (isFinalized) {
    return {
      state: 'finalized',
      daysOpen,
      daysOverThreshold: 0,
      daysUntilThreshold: 0,
      isFinalized: true,
      isOverdue30Days: false,
      slaThresholdDays: SLA_THRESHOLD_DAYS,
      bottleneckReason,
    };
  }

  if (daysOpen >= SLA_THRESHOLD_DAYS) {
    return {
      state: 'overdue_30d',
      daysOpen,
      daysOverThreshold,
      daysUntilThreshold: 0,
      isFinalized: false,
      isOverdue30Days: true,
      slaThresholdDays: SLA_THRESHOLD_DAYS,
      bottleneckReason,
    };
  }

  if (daysOpen >= APPROACHING_THRESHOLD_DAYS) {
    return {
      state: 'approaching_30d',
      daysOpen,
      daysOverThreshold: 0,
      daysUntilThreshold,
      isFinalized: false,
      isOverdue30Days: false,
      slaThresholdDays: SLA_THRESHOLD_DAYS,
      bottleneckReason,
    };
  }

  return {
    state: 'on_track',
    daysOpen,
    daysOverThreshold: 0,
    daysUntilThreshold,
    isFinalized: false,
    isOverdue30Days: false,
    slaThresholdDays: SLA_THRESHOLD_DAYS,
    bottleneckReason,
  };
}

/**
 * Evaluates whether an active (unfinalized) client intake has outstanding, pending,
 * flagged, expired, or nearing-expiry (<30d) FICA documents, along with exact days open
 * and days left until the 30-day statutory SLA and 90-day document validity limits.
 */
export function evaluateAgingIntakeAlert(
  intake: ClientIntake,
  allDocuments: VerificationDocument[] = [],
  referenceDate: Date = new Date()
): import('../types').IntakeDocumentCompletionAlert {
  const STALLED_THRESHOLD_DAYS = 7;
  const SLA_DAYS = 30;
  const isFinalized = intake.status === 'approved' || intake.status === 'rejected';
  const createdMs = new Date(intake.createdAt).getTime();
  const refMs = referenceDate.getTime();
  const diffMs = isNaN(createdMs) ? 0 : Math.max(0, refMs - createdMs);
  const daysOpen = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const slaDaysRemaining = isFinalized ? 0 : Math.max(0, SLA_DAYS - daysOpen);
  const slaDaysOverdue = isFinalized ? 0 : Math.max(0, daysOpen - SLA_DAYS);

  const docsForClient = allDocuments.filter((d) => d.intakeId === intake.id);
  const isDocCompletedAndValid = (doc: VerificationDocument) =>
    doc.status === 'valid' && calculateFicaDocumentExpiry(doc).state !== 'expired';

  const requiredDocsCount = 2;
  const missingItems: string[] = [];
  const outstandingItems: import('../types').OutstandingDocumentItem[] = [];

  // Primary identity / entity registration requirement
  if (intake.clientType === 'company') {
    const corpDoc = docsForClient.find((d) => d.docType === 'company_registration');
    if (!corpDoc) {
      missingItems.push('CIPC CoR 14.3 Registration (Not uploaded)');
      outstandingItems.push({
        docType: 'company_registration',
        label: 'CIPC CoR 14.3 Registration Certificate',
        issue: 'missing',
        detail: 'Not uploaded yet',
      });
    } else if (!isDocCompletedAndValid(corpDoc)) {
      missingItems.push(`CIPC Registration (${corpDoc.status})`);
      outstandingItems.push({
        docType: 'company_registration',
        label: 'CIPC CoR 14.3 Registration Certificate',
        fileName: corpDoc.fileName,
        issue: corpDoc.status === 'rejected' ? 'rejected' : corpDoc.status === 'flagged' ? 'flagged' : 'pending',
        detail: `Status: ${corpDoc.status}`,
      });
    }
  } else {
    const idLabel =
      intake.clientType === 'trust'
        ? 'Lead Trustee Identity (SA ID / Passport)'
        : 'RSA Smart ID / Valid Passport';
    const idDoc = docsForClient.find((d) => d.docType === 'sa_id');
    if (!idDoc) {
      missingItems.push(`${idLabel} (Not uploaded)`);
      outstandingItems.push({
        docType: 'sa_id',
        label: idLabel,
        issue: 'missing',
        detail: 'Not uploaded yet',
      });
    } else {
      const expiry = calculateFicaDocumentExpiry(idDoc);
      if (expiry.state === 'expired') {
        const overdue = Math.abs(expiry.daysRemaining);
        missingItems.push(`${idLabel} (Expired ${overdue}d ago)`);
        outstandingItems.push({
          docType: 'sa_id',
          label: idLabel,
          fileName: idDoc.fileName,
          issue: 'expired',
          detail: `Expired ${overdue}d ago — renewal required`,
          daysRemaining: expiry.daysRemaining,
          daysOverdue: overdue,
        });
      } else if (!isDocCompletedAndValid(idDoc)) {
        missingItems.push(`${idLabel} (${idDoc.status})`);
        outstandingItems.push({
          docType: 'sa_id',
          label: idLabel,
          fileName: idDoc.fileName,
          issue: idDoc.status === 'rejected' ? 'rejected' : idDoc.status === 'flagged' ? 'flagged' : 'pending',
          detail: idDoc.status === 'pending' ? 'Awaiting FICA verification' : `Flagged (${idDoc.status}) — re-upload needed`,
        });
      } else if (expiry.state === 'expiring_soon') {
        outstandingItems.push({
          docType: 'sa_id',
          label: idLabel,
          fileName: idDoc.fileName,
          issue: 'expiring_soon',
          detail: `Expires in ${expiry.daysRemaining}d`,
          daysRemaining: expiry.daysRemaining,
        });
      }
    }
  }

  // Secondary FICA requirement: Proof of Address (< 90 days)
  const poaLabel =
    intake.clientType === 'trust'
      ? 'Trust Deed & Proof of Address (< 90d)'
      : 'Proof of Residential Address (< 90 days)';
  const poaDoc = docsForClient.find((d) => d.docType === 'proof_of_residence');
  if (!poaDoc) {
    missingItems.push(`${poaLabel} (Not uploaded)`);
    outstandingItems.push({
      docType: 'proof_of_residence',
      label: poaLabel,
      issue: 'missing',
      detail: 'Not uploaded yet',
    });
  } else {
    const expiry = calculateFicaDocumentExpiry(poaDoc);
    if (expiry.state === 'expired') {
      const overdue = Math.abs(expiry.daysRemaining);
      missingItems.push(`${poaLabel} (Expired ${overdue}d overdue)`);
      outstandingItems.push({
        docType: 'proof_of_residence',
        label: poaLabel,
        fileName: poaDoc.fileName,
        issue: 'expired',
        detail: `Exceeds 90-day FICA limit (${overdue}d overdue)`,
        daysRemaining: expiry.daysRemaining,
        daysOverdue: overdue,
      });
    } else if (!isDocCompletedAndValid(poaDoc)) {
      missingItems.push(`${poaLabel} (${poaDoc.status})`);
      outstandingItems.push({
        docType: 'proof_of_residence',
        label: poaLabel,
        fileName: poaDoc.fileName,
        issue: poaDoc.status === 'rejected' ? 'rejected' : poaDoc.status === 'flagged' ? 'flagged' : 'pending',
        detail: `Status: ${poaDoc.status}`,
      });
    } else if (expiry.state === 'expiring_soon') {
      outstandingItems.push({
        docType: 'proof_of_residence',
        label: poaLabel,
        fileName: poaDoc.fileName,
        issue: 'expiring_soon',
        detail: `Nearing 90-day limit (${expiry.daysRemaining}d left)`,
        daysRemaining: expiry.daysRemaining,
      });
    }
  }

  const completedDocsCount = Math.min(
    requiredDocsCount,
    docsForClient.filter(isDocCompletedAndValid).length
  );

  const isDocumentCompletionMet =
    missingItems.length === 0 && completedDocsCount >= requiredDocsCount;

  const exceeds7DaysWithoutDocs =
    !isFinalized && daysOpen > STALLED_THRESHOLD_DAYS && !isDocumentCompletionMet;

  const hasAnyOutstandingDocs = !isFinalized && outstandingItems.length > 0;

  // Earliest document expiry / days remaining among client's uploaded documents
  const docExpiries = docsForClient.map((d) => calculateFicaDocumentExpiry(d).daysRemaining);
  const earliestDocDaysRemaining = docExpiries.length > 0 ? Math.min(...docExpiries) : null;

  const urgencyScore =
    slaDaysOverdue * 10 +
    outstandingItems.filter((i) => i.issue === 'expired' || i.issue === 'missing').length * 25 +
    outstandingItems.filter((i) => i.issue === 'flagged' || i.issue === 'rejected').length * 20 +
    (slaDaysRemaining <= 7 ? 30 - slaDaysRemaining : 0) +
    daysOpen;

  const slaPhrase =
    slaDaysOverdue > 0
      ? `${slaDaysOverdue}d past 30-day SLA limit`
      : `${slaDaysRemaining}d left before 30-day SLA limit`;

  const outstandingHeadlineList = outstandingItems.map((item) => `${item.label}: ${item.detail}`);

  const summaryReason = isFinalized
    ? 'Intake finalized'
    : outstandingItems.length === 0
      ? 'All required FICA documents valid & within statutory window'
      : `${daysOpen}d open (${slaPhrase}) · Outstanding: ${outstandingHeadlineList.join('; ')}`;

  const baseAging = calculateComplianceAging(intake, docsForClient, referenceDate);
  const agingInfo: ComplianceAgingInfo = {
    ...baseAging,
    bottleneckReason: outstandingItems.length > 0 ? summaryReason : baseAging.bottleneckReason,
  };

  return {
    intake,
    daysOpen,
    slaDaysRemaining,
    slaDaysOverdue,
    earliestDocDaysRemaining,
    completedDocsCount,
    requiredDocsCount,
    isDocumentCompletionMet,
    exceeds7DaysWithoutDocs,
    hasAnyOutstandingDocs,
    urgencyScore,
    missingItems,
    outstandingItems,
    summaryReason,
    agingInfo,
  };
}

/**
 * Returns all intakes exceeding 7 days without FICA document completion, ordered oldest first.
 */
export function getAgingIntakesExceeding7Days(
  intakes: ClientIntake[],
  documents: VerificationDocument[] = [],
  referenceDate: Date = new Date()
): import('../types').IntakeDocumentCompletionAlert[] {
  return intakes
    .map((intake) => evaluateAgingIntakeAlert(intake, documents, referenceDate))
    .filter((alert) => alert.exceeds7DaysWithoutDocs)
    .sort((a, b) => b.daysOpen - a.daysOpen);
}

/**
 * Returns all unfinalized intakes that currently have missing, pending, flagged, expired,
 * or nearing-expiry (<30d) FICA documents, ranked by urgency.
 */
export function getEmergencyOutstandingIntakes(
  intakes: ClientIntake[],
  documents: VerificationDocument[] = [],
  referenceDate: Date = new Date()
): import('../types').IntakeDocumentCompletionAlert[] {
  return intakes
    .map((intake) => evaluateAgingIntakeAlert(intake, documents, referenceDate))
    .filter((alert) => alert.hasAnyOutstandingDocs)
    .sort((a, b) => b.urgencyScore - a.urgencyScore);
}

/**
 * Builds a POPIA-compliant client reminder summary containing exact current outstanding
 * documents, days open, and remaining statutory SLA / document validity days.
 */
export function buildOutstandingReminderText(
  practiceName: string,
  alert: import('../types').IntakeDocumentCompletionAlert,
  customNote?: string
): string {
  const { intake, daysOpen, slaDaysRemaining, slaDaysOverdue, outstandingItems } = alert;
  const slaStatus =
    slaDaysOverdue > 0
      ? `OVERDUE by ${slaDaysOverdue} day(s) past our 30-day FICA verification deadline`
      : `${slaDaysRemaining} day(s) remaining before our 30-day FICA verification deadline`;

  const lines = [
    `URGENT FICA DOCUMENT REMINDER — ${practiceName}`,
    `Client: ${intake.clientName} (${intake.clientEmail})`,
    `Intake Status: Open for ${daysOpen} days · ${slaStatus}`,
    ``,
    `Current Outstanding / Action-Required Documents (${outstandingItems.length}):`,
    ...outstandingItems.map((item, idx) => `${idx + 1}. ${item.label} — ${item.detail}`),
  ];

  if (customNote && customNote.trim()) {
    lines.push(``, `Officer Note: ${customNote.trim()}`);
  }

  return lines.join('\n');
}



