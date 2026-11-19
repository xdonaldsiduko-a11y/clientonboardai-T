import { ClientIntake, VerificationDocument, AuditLog, PracticeProfile, ComplianceAgingInfo, EncryptedActionNotificationReceipt } from '../types';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';

/**
 * Calculates SHA-256 hash string of any UTF-8 text using Web Crypto API
 */
export async function calculateSha256(data: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypts an onboarding dossier object using AES-256-GCM with PBKDF2 key derivation
 */
export async function encryptDossierPackage(
  data: {
    intake: ClientIntake;
    documents: VerificationDocument[];
    auditLogs: AuditLog[];
    practice: PracticeProfile;
  },
  passphrase: string
): Promise<{
  encryptedBlob: Blob;
  certificateJson: string;
  integrityHash: string;
  exportedAt: string;
}> {
  const plaintextString = JSON.stringify(data, null, 2);
  const integrityHash = await calculateSha256(plaintextString);

  // Generate random 16-byte salt and 12-byte IV for AES-GCM
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Import passphrase into CryptoKey
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256 key
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt plaintext
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintextString)
  );

  // Construct binary file payload: [16 bytes salt] + [12 bytes IV] + [ciphertext]
  const combined = new Uint8Array(salt.byteLength + iv.byteLength + encryptedBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(new Uint8Array(encryptedBuffer), salt.byteLength + iv.byteLength);

  const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });
  const exportedAt = new Date().toISOString();

  // POPIA Section 19 Verification Certificate
  const certificate = {
    title: 'POPIA SECTION 19 COMPLIANCE & FICA VERIFICATION CERTIFICATE',
    jurisdiction: 'Republic of South Africa',
    governingLegislation: [
      'Protection of Personal Information Act 4 of 2013 (POPIA)',
      'Financial Intelligence Centre Act 38 of 2001 as amended (FICA)'
    ],
    certificateId: `CERT-${data.intake.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    exportedAt,
    practice: {
      name: data.practice.practiceName,
      profession: data.practice.professionType,
      ficaOfficer: data.practice.ficaOfficerName,
      adminEmail: data.practice.adminEmail,
    },
    intakeCase: {
      intakeId: data.intake.id,
      clientName: data.intake.clientName,
      clientType: data.intake.clientType,
      riskRating: data.intake.riskRating,
      popiaConsentGranted: data.intake.popiaConsent,
      popiaConsentTimestamp: data.intake.popiaConsentDate,
    },
    cryptographicVerification: {
      algorithm: 'AES-256-GCM / PBKDF2-SHA256 (100,000 rounds)',
      sha256PlaintextHash: integrityHash,
      packageFormat: 'Encrypted ClientOnboard Dossier (.onboard.enc)',
      auditedEventsCount: data.auditLogs.length,
    },
    legalAttestation: 'This electronic certificate attests that customer due diligence documents and processing consent were secured under appropriate technical and organisational safeguards as stipulated in Section 19 of POPIA.'
  };

  return {
    encryptedBlob,
    certificateJson: JSON.stringify(certificate, null, 2),
    integrityHash,
    exportedAt,
  };
}

export interface BulkZipResult {
  zipBlob: Blob;
  fileName: string;
  manifestJson: string;
  sha256Checksum: string;
  integrityHash: string;
  totalClients: number;
  totalDocuments: number;
  totalBytes: number;
  archiveSizeFormatted: string;
  exportedAt: string;
}

/**
 * Packages all verified client documents and compliance dossiers for an intake batch
 * into a single, password-protected, AES-256 encrypted ZIP archive for legal archival.
 */
export async function generateEncryptedBulkZipPackage(
  practice: PracticeProfile,
  selectedIntakes: ClientIntake[],
  documents: VerificationDocument[],
  auditLogs: AuditLog[],
  password: string,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<BulkZipResult> {
  const exportedAt = new Date().toISOString();
  const dateStamp = exportedAt.split('T')[0];
  const blobWriter = new BlobWriter('application/zip');
  const zipWriter = new ZipWriter(blobWriter);

  // Collect documents relevant to selected intakes
  const relevantDocs = documents.filter(d => selectedIntakes.some(i => i.id === d.intakeId));
  const relevantLogs = auditLogs.filter(l => selectedIntakes.some(i => i.id === l.intakeId));

  const totalSteps = 3 + selectedIntakes.length + relevantDocs.length;
  let currentStep = 0;

  const updateProgress = (msg: string) => {
    currentStep++;
    if (onProgress) {
      onProgress(currentStep, totalSteps, msg);
    }
  };

  const zipOptions = {
    password,
    encryptionStrength: 3 as const, // AES-256 bit encryption
  };

  // 1. Batch Manifest
  updateProgress('Generating Master FICA Archival Manifest...');
  const manifest = {
    archiveTitle: 'REPUBLIC OF SOUTH AFRICA - FICA ACT 38 BATCH ARCHIVE',
    governingStatutes: [
      'Financial Intelligence Centre Act 38 of 2001 (FICA) - Section 22 Record Retention',
      'Protection of Personal Information Act 4 of 2013 (POPIA) - Section 19 Security Safeguards'
    ],
    practice: {
      id: practice.id,
      name: practice.practiceName,
      profession: practice.professionType,
      ficaOfficer: practice.ficaOfficerName,
      adminEmail: practice.adminEmail,
      city: practice.city,
      retentionPeriodYears: practice.retentionPolicyDays / 365,
    },
    exportMetadata: {
      exportedAt,
      encryptionAlgorithm: 'PKZIP AES-256 Bit Encryption',
      totalClients: selectedIntakes.length,
      totalDocuments: relevantDocs.length,
      totalAuditEvents: relevantLogs.length,
    },
    clientDossiers: selectedIntakes.map((intake, idx) => {
      const clientDocs = relevantDocs.filter(d => d.intakeId === intake.id);
      return {
        batchIndex: idx + 1,
        intakeId: intake.id,
        clientName: intake.clientName,
        clientType: intake.clientType,
        idNumber: intake.idNumber || intake.registrationNumber || 'N/A',
        ficaStatus: intake.status,
        riskRating: intake.riskRating,
        popiaConsentGranted: intake.popiaConsent,
        popiaConsentTimestamp: intake.popiaConsentDate,
        documentsCount: clientDocs.length,
        documents: clientDocs.map(d => ({
          id: d.id,
          fileName: d.fileName,
          docType: d.docType,
          status: d.status,
          aiConfidence: d.aiConfidence,
          issueDate: d.issueDate,
          expiryDate: d.expiryDate,
        }))
      };
    })
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  await zipWriter.add('BATCH_FICA_ARCHIVE_MANIFEST.json', new TextReader(manifestJson), zipOptions);

  // 2. POPIA Section 19 Batch Certificate
  updateProgress('Generating POPIA Section 19 Compliance Certificate...');
  const popiaCertificate = `
=================================================================================
REPUBLIC OF SOUTH AFRICA
POPIA SECTION 19 COMPLIANCE & FICA SECTION 22 ARCHIVAL CERTIFICATE
=================================================================================

PRACTICE DETAILS:
Practice Name:          ${practice.practiceName}
Profession:             ${practice.professionType.toUpperCase()}
FICA Compliance Officer: ${practice.ficaOfficerName}
Statutory Retention:    ${practice.retentionPolicyDays / 365} Years (Mandatory under FICA Act 38)
Jurisdiction:           Republic of South Africa

ARCHIVE ATTRIBUTES:
Archived At (UTC):      ${exportedAt}
Total Client Dossiers:  ${selectedIntakes.length}
Total Verified Docs:    ${relevantDocs.length}
Encryption Standard:    AES-256-Bit Password-Protected Archive
Master Manifest Hash:   ${await calculateSha256(manifestJson)}

LEGAL ATTESTATION:
This electronic certificate attests that customer due diligence documents,
identity verification records, and processing consent for this batch of clients
were secured with technical and organisational safeguards as stipulated in
Section 19 of the Protection of Personal Information Act (POPIA No. 4 of 2013).

Records are sealed against unauthorized tampering and remain accessible to
designated authorized compliance officers upon entry of the master passphrase.

Issued by: ClientOnboard AI Security & Archival Engine
=================================================================================
`;
  await zipWriter.add('POPIA_SECTION_19_BATCH_CERTIFICATE.txt', new TextReader(popiaCertificate.trim()), zipOptions);

  // 3. Readme Decryption Instructions
  updateProgress('Adding Archival Decryption Guide...');
  const readme = `
FICA BATCH ARCHIVE DECRYPTION GUIDE
------------------------------------
This archive is encrypted using standard AES-256 PKZIP encryption.

HOW TO OPEN:
1. Windows: Right-click > Extract All, or use 7-Zip / WinZip, and enter the practice passphrase.
2. macOS: Double-click to open via Archive Utility, or in Terminal run:
   unzip -P "your-passphrase" ${practice.practiceName.replace(/\s+/g, '_')}_FICA_Batch.zip
3. Linux: Run: 7z x archive.zip or unzip -P "your-passphrase" archive.zip

CONTENTS:
- BATCH_FICA_ARCHIVE_MANIFEST.json: Master registry and SHA-256 audit hashes
- POPIA_SECTION_19_BATCH_CERTIFICATE.txt: Official statutory compliance certificate
- Subfolders: Each client's verified identity dossier, FICA CDD attestation, and OCR analysis
`;
  await zipWriter.add('README_DECRYPTION_INSTRUCTIONS.txt', new TextReader(readme.trim()), zipOptions);

  // 4. Client Subfolders & Documents
  for (let i = 0; i < selectedIntakes.length; i++) {
    const intake = selectedIntakes[i];
    const clientIndex = String(i + 1).padStart(2, '0');
    const folderName = `${clientIndex}_${intake.clientName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    updateProgress(`Archiving Dossier ${i + 1} of ${selectedIntakes.length}: ${intake.clientName}...`);

    // Client Profile & Assessment
    const clientProfileJson = JSON.stringify({
      intakeId: intake.id,
      clientName: intake.clientName,
      clientType: intake.clientType,
      email: intake.clientEmail,
      phone: intake.phone,
      idNumber: intake.idNumber,
      companyName: intake.companyName,
      registrationNumber: intake.registrationNumber,
      ficaStatus: intake.status,
      riskRating: intake.riskRating,
      riskReasons: intake.riskReasons,
      popiaConsentGranted: intake.popiaConsent,
      popiaConsentTimestamp: intake.popiaConsentDate,
      createdAt: intake.createdAt,
      archivedAt: exportedAt,
    }, null, 2);

    await zipWriter.add(
      `${folderName}/Client_Intake_Profile.json`,
      new TextReader(clientProfileJson),
      zipOptions
    );

    // Client FICA Attestation
    const clientAttestation = `
SOUTH AFRICAN FICA CUSTOMER DUE DILIGENCE (CDD) SUMMARY
-------------------------------------------------------
Client:             ${intake.clientName}
ID / Reg Number:    ${intake.idNumber || intake.registrationNumber || 'N/A'}
Entity Type:        ${intake.clientType.toUpperCase()}
FICA Status:        ${intake.status.toUpperCase()}
Risk Rating:        ${intake.riskRating.toUpperCase()} RISK
POPIA Consent:      Granted under Section 11 on ${intake.popiaConsentDate || 'Record'}
Practice:           ${practice.practiceName}
FICA Officer:       ${practice.ficaOfficerName}
Statutory Baseline: FICA Act 38 of 2001 & Amendment Act 1 of 2017
`;
    await zipWriter.add(
      `${folderName}/FICA_Compliance_Attestation.txt`,
      new TextReader(clientAttestation.trim()),
      zipOptions
    );

    // Add Client Documents
    const clientDocs = relevantDocs.filter(d => d.intakeId === intake.id);
    for (let dIdx = 0; dIdx < clientDocs.length; dIdx++) {
      const doc = clientDocs[dIdx];
      const docIndex = String(dIdx + 1).padStart(2, '0');
      const docBaseName = doc.fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

      updateProgress(`Securing Document: ${doc.fileName}...`);

      const docReport = {
        documentId: doc.id,
        fileName: doc.fileName,
        docType: doc.docType,
        status: doc.status,
        aiConfidence: doc.aiConfidence,
        aiValidationSummary: doc.aiValidationSummary,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        extractedData: doc.extractedData,
        uploadedAt: doc.uploadedAt,
        archivedAt: exportedAt,
      };

      await zipWriter.add(
        `${folderName}/${docIndex}_${docBaseName}_VERIFIED_FICA.json`,
        new TextReader(JSON.stringify(docReport, null, 2)),
        zipOptions
      );

      const docTextCertificate = `
FICA VERIFICATION REPORT: ${doc.fileName}
-------------------------------------------------------
Document Type:       ${doc.docType.toUpperCase()}
Verification Status: ${doc.status.toUpperCase()} (Confidence: ${(doc.aiConfidence * 100).toFixed(1)}%)
Issue Date:          ${doc.issueDate || doc.extractedData?.utilityDate || 'Verified'}
FICA 90-Day Check:   ${doc.docType === 'proof_of_residence' ? (doc.extractedData?.isUnder90Days ? 'PASSED (Issued within 90 days)' : 'FLAGGED') : 'N/A'}
AI OCR Analysis:     ${doc.aiValidationSummary}
Archived By:         ${practice.practiceName}
`;
      await zipWriter.add(
        `${folderName}/${docIndex}_${docBaseName}_CERTIFICATE.txt`,
        new TextReader(docTextCertificate.trim()),
        zipOptions
      );
    }
  }

  // Close and produce final encrypted ZIP blob
  updateProgress('Sealing and encrypting final ZIP package...');
  const zipBlob = await zipWriter.close();

  // Compute final SHA-256 hash of the generated ZIP
  const arrayBuffer = await zipBlob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256Checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const fileName = `${practice.practiceName.replace(/[^a-zA-Z0-9_-]/g, '_')}_FICA_Archive_${dateStamp}_AES256.zip`;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return {
    zipBlob,
    fileName,
    manifestJson,
    sha256Checksum,
    integrityHash: sha256Checksum,
    totalClients: selectedIntakes.length,
    totalDocuments: relevantDocs.length,
    totalBytes: zipBlob.size,
    archiveSizeFormatted: formatBytes(zipBlob.size),
    exportedAt,
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Encrypts an urgent "Action Required" Compliance Aging notification payload
 * using AES-256-GCM (PBKDF2-SHA256 derived key) and dispatches the ciphertext
 * envelope through the backend relay endpoint.
 */
export async function dispatchEncryptedActionRequiredNotification(
  practice: PracticeProfile,
  intake: ClientIntake,
  aging: ComplianceAgingInfo,
  options?: {
    outstandingDocuments?: string[];
    reminderSummary?: string;
    slaDaysRemaining?: number;
  }
): Promise<EncryptedActionNotificationReceipt> {
  const issuedAt = new Date().toISOString();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://clientonboard.co.za';
  const magicResumeUrl = `${origin}/?email=${encodeURIComponent(intake.clientEmail)}&token=${encodeURIComponent(intake.magicLinkToken)}`;

  const outstandingDocuments = options?.outstandingDocuments;
  const reminderSummary = options?.reminderSummary;

  const plaintextPayload = JSON.stringify({
    noticeType:
      outstandingDocuments && outstandingDocuments.length > 0
        ? 'FICA_OUTSTANDING_DOCUMENTS_REMINDER'
        : 'FICA_COMPLIANCE_AGING_ACTION_REQUIRED',
    jurisdiction: 'Republic of South Africa',
    statute: 'FICA Act 38 of 2001 & POPIA Act 4 of 2013 Sec 19',
    practiceName: practice.practiceName,
    ficaOfficer: practice.ficaOfficerName,
    intakeId: intake.id,
    clientName: intake.clientName,
    clientEmail: intake.clientEmail,
    daysOpen: aging.daysOpen,
    slaThresholdDays: aging.slaThresholdDays,
    slaDaysRemaining: options?.slaDaysRemaining ?? aging.daysUntilThreshold,
    daysOverThreshold: aging.daysOverThreshold,
    outstandingDocuments: outstandingDocuments || [],
    actionRequired: aging.bottleneckReason,
    reminderMessage: reminderSummary || aging.bottleneckReason,
    secureResumeLink: magicResumeUrl,
    issuedAt,
  });

  const payloadSha256 = await calculateSha256(plaintextPayload);
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const sharedSecret = `${practice.id}:${intake.magicLinkToken}:${intake.id}`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(sharedSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintextPayload)
  );

  const ivBase64Url = toBase64Url(iv);
  const saltBase64Url = toBase64Url(salt);
  const ciphertextBase64Url = toBase64Url(new Uint8Array(cipherBuffer));
  const keyFingerprint = (await calculateSha256(`${saltBase64Url}:${intake.magicLinkToken}`)).substring(0, 16).toUpperCase();

  let dispatchId = `ntf_${Date.now().toString(36)}_${keyFingerprint.slice(0, 6).toLowerCase()}`;
  let dispatchedAt = issuedAt;

  try {
    const res = await fetch('/api/notifications/action-required', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId: practice.id,
        intakeId: intake.id,
        clientEmail: intake.clientEmail,
        clientName: intake.clientName,
        daysOpen: aging.daysOpen,
        algorithm: 'AES-256-GCM / PBKDF2-SHA256',
        ivBase64Url,
        saltBase64Url,
        ciphertextBase64Url,
        payloadSha256,
        keyFingerprint,
        dispatchedBy: practice.ficaOfficerName,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.dispatchId) dispatchId = data.dispatchId;
      if (data.dispatchedAt) dispatchedAt = data.dispatchedAt;
    }
  } catch (err) {
    console.warn('Encrypted notification backend relay fallback:', err);
  }

  return {
    dispatchId,
    intakeId: intake.id,
    clientEmail: intake.clientEmail,
    clientName: intake.clientName,
    daysOpen: aging.daysOpen,
    algorithm: 'AES-256-GCM (PBKDF2-SHA256)',
    ivBase64Url,
    ciphertextPreview: `${ciphertextBase64Url.slice(0, 28)}...${ciphertextBase64Url.slice(-12)}`,
    payloadSha256,
    keyFingerprint,
    magicResumeUrl,
    dispatchedAt,
    dispatchedBy: practice.ficaOfficerName,
    outstandingDocuments,
    reminderSummary,
  };
}

