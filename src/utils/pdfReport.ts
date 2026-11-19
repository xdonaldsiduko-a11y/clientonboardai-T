import { jsPDF } from 'jspdf';
import {
  AuditLog,
  ClientIntake,
  OfficerSecuritySession,
  PracticeProfile,
  VerificationDocument,
} from '../types';
import { calculateSha256 } from './encryption';
import {
  calculateComplianceAging,
  calculateFicaDocumentExpiry,
  getClientFicaComplianceStatus,
} from './sa-fica';

export interface ClientPdfComplianceReportResult {
  fileName: string;
  reportId: string;
  integrityHash: string;
  generatedAt: string;
  includedAuditEvents: number;
}

function formatDateTimeZa(iso: string | undefined): string {
  if (!iso) return 'Not recorded';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function formatFicaStatusLabel(status: ClientIntake['status']): string {
  switch (status) {
    case 'approved':
      return 'FICA CLEARED (Officer Approved)';
    case 'ai_verified':
      return 'AI VERIFIED (Ready for Final Sign-Off)';
    case 'needs_review':
      return 'NEEDS REVIEW (FICA Officer Attention)';
    case 'submitted':
      return 'SUBMITTED (Pending Full Verification)';
    case 'rejected':
      return 'DECLINED / ARCHIVED';
    case 'draft':
    default:
      return 'DRAFT / IN PROGRESS';
  }
}

function sanitizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u00b7/g, '|')
    .replace(/\u2713|\u2705/g, '[OK]')
    .replace(/[^\x20-\x7E\n\r]/g, ' ')
    .trim();
}

/**
 * Generates a downloadable, POPIA Section 19 & FICA Act 38 compliant PDF Verification
 * Summary for an individual client intake, incorporating full audit log evidence.
 */
export async function generateClientCompliancePdfReport(params: {
  practice: PracticeProfile;
  intake: ClientIntake;
  documents: VerificationDocument[];
  auditLogs: AuditLog[];
  securitySession?: OfficerSecuritySession | null;
}): Promise<ClientPdfComplianceReportResult> {
  const { practice, intake, documents, auditLogs, securitySession } = params;
  const generatedAt = new Date().toISOString();
  const reportId = `POPIA-RPT-${intake.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6)}-${Date.now().toString().slice(-5)}`;

  const clientDocs = documents.filter((d) => d.intakeId === intake.id);
  const clientAuditLogs = auditLogs
    .filter((l) => l.intakeId === intake.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const safeguardLogs = auditLogs
    .filter((l) => l.intakeId === 'SECURITY_WEBAUTHN' || l.intakeId === 'BATCH_BULK_ARCHIVE')
    .slice(0, 4);

  const aging = calculateComplianceAging(intake, clientDocs);
  const docCompliance = getClientFicaComplianceStatus(intake, clientDocs);

  // Compute canonical SHA-256 report seal prior to embedding hash in the PDF
  const canonicalPayload = JSON.stringify({
    reportId,
    generatedAt,
    practiceId: practice.id,
    practiceName: practice.practiceName,
    ficaOfficer: practice.ficaOfficerName,
    intake,
    documents: clientDocs.map((d) => ({
      id: d.id,
      docType: d.docType,
      fileName: d.fileName,
      status: d.status,
      aiConfidence: d.aiConfidence,
      issueDate: d.issueDate,
      expiryDate: d.expiryDate,
    })),
    auditTrailHashes: clientAuditLogs.map((l) => l.hash),
    biometricAssurance: securitySession?.verified
      ? {
          level: securitySession.assuranceLevel,
          device: securitySession.deviceLabel,
          sig: securitySession.challengeSignature,
        }
      : null,
  });

  const integrityHash = await calculateSha256(canonicalPayload);

  // Initialize A4 Portrait PDF (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 20) {
      doc.addPage();
      y = 18;
    }
  };

  const drawSectionHeader = (title: string, subtitle?: string) => {
    ensureSpace(16);
    doc.setFillColor(24, 14, 52);
    doc.roundedRect(margin, y, contentWidth, 8.5, 1.5, 1.5, 'F');
    doc.setDrawColor(0, 196, 167);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 8.5, margin + contentWidth, y + 8.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizePdfText(title), margin + 3.5, y + 5.7);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(170, 240, 230);
      doc.text(sanitizePdfText(subtitle), margin + contentWidth - 3.5, y + 5.7, { align: 'right' });
    }
    y += 12;
  };

  // =========================================================================
  // DOCUMENT HEADER BANNER
  // =========================================================================
  doc.setFillColor(18, 8, 38);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(0, 212, 180);
  doc.rect(0, 38, pageWidth, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 235, 200);
  doc.text('REPUBLIC OF SOUTH AFRICA  |  FICA ACT 38 OF 2001 & POPIA ACT 4 OF 2013', margin, 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(255, 255, 255);
  doc.text('POPIA & FICA Verification Compliance Report', margin, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 210, 245);
  doc.text(
    sanitizePdfText(`${practice.practiceName}  |  ${practice.city}, ${practice.province}`),
    margin,
    26
  );

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(195, 185, 230);
  doc.text(`Report Ref: ${reportId}`, margin, 32.5);
  doc.text(`Generated: ${formatDateTimeZa(generatedAt)}`, pageWidth - margin, 32.5, { align: 'right' });

  y = 46;

  // =========================================================================
  // 1. CLIENT IDENTITY & COMPLIANCE SUMMARY
  // =========================================================================
  drawSectionHeader('1. Client Identification & Compliance Summary', `Case ID: ${intake.id}`);

  const boxHeight = 40;
  ensureSpace(boxHeight + 4);
  doc.setFillColor(248, 247, 252);
  doc.setDrawColor(215, 210, 232);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

  const col1X = margin + 4;
  const col2X = margin + contentWidth / 2 + 3;
  let rowY = y + 6.5;

  const drawKv = (x: number, yy: number, label: string, value: string, valueColor?: [number, number, number]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 92, 130);
    doc.text(label.toUpperCase(), x, yy);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    if (valueColor) {
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
    } else {
      doc.setTextColor(25, 20, 45);
    }
    doc.text(sanitizePdfText(value).slice(0, 48), x, yy + 4);
  };

  drawKv(col1X, rowY, 'Client / Legal Entity', intake.clientName);
  drawKv(col2X, rowY, 'Entity Classification', intake.clientType.toUpperCase());

  rowY += 11.5;
  drawKv(col1X, rowY, 'SA ID / Registration No.', intake.idNumber || intake.registrationNumber || 'Pending');
  drawKv(col2X, rowY, 'Primary Contact', `${intake.clientEmail} (${intake.phone})`);

  rowY += 11.5;
  const statusColor: [number, number, number] =
    intake.status === 'approved' || intake.status === 'ai_verified'
      ? [5, 130, 100]
      : intake.status === 'needs_review' || intake.status === 'rejected'
      ? [195, 30, 90]
      : [180, 110, 0];
  drawKv(col1X, rowY, 'FICA Verification State', formatFicaStatusLabel(intake.status), statusColor);

  const agingLabel = aging.isFinalized
    ? `Finalized (${aging.daysOpen}d total)`
    : aging.isOverdue30Days
    ? `SLA BREACHED: ${aging.daysOpen}d Open (+${aging.daysOverThreshold}d over 30d limit)`
    : `${aging.daysOpen}d Open (30d SLA: ${aging.daysUntilThreshold}d remaining)`;
  drawKv(
    col2X,
    rowY,
    'Risk Rating & Compliance Aging',
    `${intake.riskRating.toUpperCase()} RISK  |  ${agingLabel}`,
    intake.riskRating === 'high' || aging.isOverdue30Days ? [195, 30, 90] : [25, 20, 45]
  );

  y += boxHeight + 5;

  if (intake.riskReasons && intake.riskReasons.length > 0) {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(70, 62, 100);
    doc.text('Automated Risk & Due Diligence Findings:', margin, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(45, 40, 70);
    for (const reason of intake.riskReasons) {
      const wrapped = doc.splitTextToSize(`- ${sanitizePdfText(reason)}`, contentWidth - 4);
      ensureSpace(wrapped.length * 4 + 1);
      doc.text(wrapped, margin + 2, y);
      y += wrapped.length * 4;
    }
    y += 3;
  }

  // =========================================================================
  // 2. POPIA SECTION 11 & SECTION 19 GOVERNANCE ATTESTATION
  // =========================================================================
  drawSectionHeader('2. POPIA Lawful Processing & Retention Attestation', 'Statute: Act 4 of 2013');

  const popiaBoxHeight = 29;
  ensureSpace(popiaBoxHeight + 4);
  doc.setFillColor(242, 250, 248);
  doc.setDrawColor(165, 225, 212);
  doc.roundedRect(margin, y, contentWidth, popiaBoxHeight, 2, 2, 'FD');

  drawKv(
    col1X,
    y + 6.5,
    'POPIA Section 11 Consent',
    intake.popiaConsent
      ? `GRANTED (${formatDateTimeZa(intake.popiaConsentDate)})`
      : 'PENDING CONSENT',
    intake.popiaConsent ? [5, 130, 100] : [195, 30, 90]
  );
  drawKv(
    col2X,
    y + 6.5,
    'Designated FICA / Information Officer',
    `${practice.ficaOfficerName} (${practice.adminEmail})`
  );

  drawKv(
    col1X,
    y + 18,
    'Statutory Record Retention Policy',
    `${practice.retentionPolicyDays / 365} Years (FICA Section 22 & POPIA Sec 14)`
  );
  drawKv(
    col2X,
    y + 18,
    'Officer Session Assurance Level',
    securitySession?.verified
      ? `AAL3 Biometric WebAuthn (${securitySession.deviceLabel})`
      : 'Standard Officer Console Session',
    securitySession?.verified ? [5, 130, 100] : [70, 62, 100]
  );

  y += popiaBoxHeight + 6;

  // =========================================================================
  // 3. FICA DOCUMENT DOSSIER & 90-DAY RECENCY SUMMARY
  // =========================================================================
  drawSectionHeader(
    '3. FICA Supporting Documents & 90-Day Recency Check',
    `${clientDocs.length} Document(s) | ${sanitizePdfText(docCompliance.summary)}`
  );

  if (clientDocs.length === 0) {
    ensureSpace(14);
    doc.setFillColor(250, 248, 253);
    doc.setDrawColor(220, 215, 235);
    doc.roundedRect(margin, y, contentWidth, 11, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 82, 120);
    doc.text(
      'No FICA supporting documents have been attached to this intake record yet.',
      margin + 4,
      y + 7
    );
    y += 15;
  } else {
    for (const d of clientDocs) {
      const expiryInfo = calculateFicaDocumentExpiry(d);
      const summaryLines = doc.splitTextToSize(
        sanitizePdfText(d.aiValidationSummary),
        contentWidth - 8
      );
      const cardH = 17 + summaryLines.length * 3.8;
      ensureSpace(cardH + 3);

      doc.setFillColor(250, 249, 253);
      doc.setDrawColor(215, 210, 232);
      doc.roundedRect(margin, y, contentWidth, cardH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(25, 20, 45);
      doc.text(sanitizePdfText(d.fileName), margin + 3.5, y + 5.5);

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      if (expiryInfo.state === 'expired') {
        doc.setTextColor(195, 30, 90);
      } else if (expiryInfo.state === 'expiring_soon') {
        doc.setTextColor(180, 110, 0);
      } else {
        doc.setTextColor(5, 130, 100);
      }
      doc.text(
        sanitizePdfText(`${expiryInfo.label} | AI ${(d.aiConfidence * 100).toFixed(0)}%`),
        margin + contentWidth - 3.5,
        y + 5.5,
        { align: 'right' }
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 92, 130);
      doc.text(
        sanitizePdfText(
          `Type: ${d.docType.toUpperCase()} | Status: ${d.status.toUpperCase()} | Issued: ${d.issueDate || 'N/A'} | Rule: ${expiryInfo.statutoryRule}`
        ),
        margin + 3.5,
        y + 10.5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(45, 40, 70);
      doc.text(summaryLines, margin + 3.5, y + 15.5);

      y += cardH + 3;
    }
    y += 2;
  }

  // =========================================================================
  // 4. POPIA SECTION 19 IMMUTABLE AUDIT LOG TRAIL
  // =========================================================================
  drawSectionHeader(
    '4. POPIA Section 19 Audit Trail Evidence',
    `${clientAuditLogs.length} Client Event(s)`
  );

  if (clientAuditLogs.length === 0) {
    ensureSpace(14);
    doc.setFillColor(250, 248, 253);
    doc.setDrawColor(220, 215, 235);
    doc.roundedRect(margin, y, contentWidth, 11, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(90, 82, 120);
    doc.text(
      'No client-specific audit events recorded yet for this intake ID.',
      margin + 4,
      y + 7
    );
    y += 15;
  } else {
    for (let idx = 0; idx < clientAuditLogs.length; idx++) {
      const log = clientAuditLogs[idx];
      const basisLines = doc.splitTextToSize(
        `Lawful Basis: ${sanitizePdfText(log.popiaLawfulBasis)}`,
        contentWidth - 8
      );
      const entryH = 16.5 + basisLines.length * 3.6;
      ensureSpace(entryH + 2.5);

      doc.setFillColor(idx % 2 === 0 ? 252 : 246, idx % 2 === 0 ? 251 : 244, 255);
      doc.setDrawColor(220, 214, 235);
      doc.roundedRect(margin, y, contentWidth, entryH, 1.2, 1.2, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(75, 30, 145);
      doc.text(`${idx + 1}. ${sanitizePdfText(log.action)}`, margin + 3.5, y + 5.2);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(95, 88, 125);
      doc.text(formatDateTimeZa(log.timestamp), margin + contentWidth - 3.5, y + 5.2, {
        align: 'right',
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 35, 65);
      doc.text(
        sanitizePdfText(`Operator: ${log.performedBy}  |  Origin: ${log.ipAddress}`),
        margin + 3.5,
        y + 9.8
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(65, 58, 95);
      doc.text(basisLines, margin + 3.5, y + 14);

      const hashY = y + 14 + basisLines.length * 3.6;
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.7);
      doc.setTextColor(110, 102, 140);
      doc.text(`SHA-256 Chain Hash: ${sanitizePdfText(log.hash)}`, margin + 3.5, hashY);

      y += entryH + 2.5;
    }
  }

  if (safeguardLogs.length > 0) {
    y += 2;
    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(70, 62, 100);
    doc.text('Supporting Practice Security & Safeguard Events (POPIA Sec 19):', margin, y);
    y += 4.5;

    for (const sLog of safeguardLogs) {
      ensureSpace(6);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 75, 110);
      doc.text(
        sanitizePdfText(
          `[${formatDateTimeZa(sLog.timestamp)}] ${sLog.action} by ${sLog.performedBy} (${sLog.hash.slice(0, 18)}...)`
        ),
        margin + 2,
        y
      );
      y += 4.2;
    }
  }

  // =========================================================================
  // 5. CRYPTOGRAPHIC INTEGRITY SEAL & DECLARATION
  // =========================================================================
  y += 4;
  drawSectionHeader('5. Cryptographic Integrity Seal & Legal Declaration');

  const sealBoxH = 26;
  ensureSpace(sealBoxH + 6);
  doc.setFillColor(18, 8, 38);
  doc.roundedRect(margin, y, contentWidth, sealBoxH, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 235, 200);
  doc.text('REPORT SHA-256 INTEGRITY DIGEST (CANONICAL RECORD SEAL):', margin + 4, y + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  doc.text(integrityHash, margin + 4, y + 11.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(210, 200, 240);
  const attestationLines = doc.splitTextToSize(
    sanitizePdfText(
      `This report certifies that personal information and Customer Due Diligence records for ${intake.clientName} were captured, validated, and logged in accordance with Section 19 of POPIA (Act 4 of 2013) and FICA (Act 38 of 2001) under the oversight of ${practice.ficaOfficerName}.`
    ),
    contentWidth - 8
  );
  doc.text(attestationLines, margin + 4, y + 16.5);

  // Stamp repeating footer across every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(215, 210, 232);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(115, 108, 145);
    doc.text(
      sanitizePdfText(
        `ClientOnboard AI  |  POPIA & FICA Compliance Report (${reportId})  |  Confidential`
      ),
      margin,
      pageHeight - 8.5
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 8.5, {
      align: 'right',
    });
  }

  const safeClientName = intake.clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = generatedAt.split('T')[0];
  const fileName = `POPIA_FICA_Report_${safeClientName}_${dateStamp}.pdf`;

  doc.save(fileName);

  return {
    fileName,
    reportId,
    integrityHash,
    generatedAt,
    includedAuditEvents: clientAuditLogs.length,
  };
}
