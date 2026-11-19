import { PracticeProfile, ClientIntake, VerificationDocument, AuditLog } from '../types';

export const INITIAL_PRACTICES: PracticeProfile[] = [
  {
    id: 'practice-dlamini-law',
    practiceName: 'Dlamini & Associates Inc.',
    professionType: 'law_firm',
    ownerUid: 'owner-dlamini-001',
    adminEmail: 'intake@dlaminilaw.co.za',
    ficaOfficerName: 'Adv. Sibusiso Dlamini (Senior Partner)',
    retentionPolicyDays: 1825, // 5 years statutory requirement
    city: 'Cape Town',
    province: 'Western Cape',
    tagline: 'Premier Conveyancing, Corporate Commercial & Litigation Practice'
  },
  {
    id: 'practice-vdm-accounting',
    practiceName: 'Van der Merwe Chartered Accountants (SA)',
    professionType: 'accounting_firm',
    ownerUid: 'owner-vdm-002',
    adminEmail: 'fica@vdm-ca.co.za',
    ficaOfficerName: 'Anika van der Merwe (CA(SA) & RA)',
    retentionPolicyDays: 1825,
    city: 'Sandton, Johannesburg',
    province: 'Gauteng',
    tagline: 'Boutique Statutory Audit, CIPC Registrations & Tax Planning Advisory'
  },
  {
    id: 'practice-khumalo-consulting',
    practiceName: 'Khumalo Advisory Partners',
    professionType: 'consulting_firm',
    ownerUid: 'owner-khumalo-003',
    adminEmail: 'compliance@khumalo.co.za',
    ficaOfficerName: 'Dr. Thabo Khumalo (Managing Director)',
    retentionPolicyDays: 1095, // 3 years
    city: 'Umhlanga, Durban',
    province: 'KwaZulu-Natal',
    tagline: 'Strategic Management, ESG & Public Sector Transformation Consultants'
  }
];

export const INITIAL_INTAKES: ClientIntake[] = [
  {
    id: 'intake-za-001',
    practiceId: 'practice-dlamini-law',
    clientEmail: 'sizwe.mkhize@gmail.com',
    clientName: 'Sizwe Mkhize',
    clientType: 'individual',
    phone: '+27 82 459 1029',
    idNumber: '9203155182089',
    status: 'ai_verified',
    popiaConsent: true,
    popiaConsentDate: '2026-11-04T09:14:22Z',
    currentStep: 5,
    magicLinkToken: 'token_mkhize_9941a',
    riskRating: 'low',
    riskReasons: ['Standard CDD verified', 'RSA Smart ID matches Dept of Home Affairs format', 'Proof of residence within 42 days'],
    createdAt: '2026-11-04T09:10:00Z',
    updatedAt: '2026-11-04T09:22:15Z'
  },
  {
    id: 'intake-za-002',
    practiceId: 'practice-vdm-accounting',
    clientEmail: 'finance@apexsolar.co.za',
    clientName: 'Apex Solar Energy Solutions (Pty) Ltd',
    clientType: 'company',
    phone: '+27 11 982 4400',
    idNumber: '8407115049081',
    companyName: 'Apex Solar Energy Solutions (Pty) Ltd',
    registrationNumber: '2021/489102/07',
    taxNumber: '9481029182',
    status: 'needs_review',
    popiaConsent: true,
    popiaConsentDate: '2026-10-08T14:30:10Z',
    currentStep: 4,
    magicLinkToken: 'token_apex_4481b',
    riskRating: 'medium',
    riskReasons: ['CIPC CoR 14.3 verified', 'Tax clearance pin active', 'Utility bill nearing 90-day FICA limit', 'Intake unfinalized beyond 30-day SLA'],
    createdAt: '2026-10-08T14:20:00Z',
    updatedAt: '2026-10-14T14:45:00Z'
  },
  {
    id: 'intake-za-003',
    practiceId: 'practice-khumalo-consulting',
    clientEmail: 'elena.rodriguez@interglobal.ch',
    clientName: 'Elena Rodriguez',
    clientType: 'individual',
    phone: '+41 79 123 4567',
    idNumber: 'P89210492',
    status: 'submitted',
    popiaConsent: true,
    popiaConsentDate: '2026-09-28T08:00:00Z',
    currentStep: 3,
    magicLinkToken: 'token_rodriguez_2108c',
    riskRating: 'high',
    riskReasons: ['Foreign Passport expired', 'Utility statement > 90 days', 'Unfinalized beyond 30-day compliance aging threshold'],
    createdAt: '2026-09-28T07:50:00Z',
    updatedAt: '2026-10-03T08:05:00Z'
  },
  {
    id: 'intake-za-004',
    practiceId: 'practice-dlamini-law',
    clientEmail: 'trustees@mokoenafamily.co.za',
    clientName: 'Mokoena Family Trust',
    clientType: 'trust',
    phone: '+27 83 712 8890',
    idNumber: 'IT004918/2019(C)',
    status: 'draft',
    popiaConsent: true,
    popiaConsentDate: '2026-10-21T10:18:00Z',
    currentStep: 2,
    magicLinkToken: 'token_mokoena_7731d',
    riskRating: 'medium',
    riskReasons: ['Trust structure requires EDD verification', 'Stalled at Step 2/5 document upload for 24 days'],
    createdAt: '2026-10-21T10:15:00Z',
    updatedAt: '2026-10-22T09:40:00Z'
  },
  {
    id: 'intake-za-005',
    practiceId: 'practice-dlamini-law',
    clientEmail: 'legal@capewinelands.co.za',
    clientName: 'Cape Winelands Holdings (Pty) Ltd',
    clientType: 'company',
    phone: '+27 21 887 3020',
    idNumber: '2018/312094/07',
    companyName: 'Cape Winelands Holdings (Pty) Ltd',
    registrationNumber: '2018/312094/07',
    taxNumber: '9120498112',
    status: 'approved',
    popiaConsent: true,
    popiaConsentDate: '2026-09-12T08:05:00Z',
    currentStep: 5,
    magicLinkToken: 'token_winelands_5502e',
    riskRating: 'low',
    riskReasons: ['Full CDD completed & cleared by FICA Officer'],
    createdAt: '2026-09-12T08:00:00Z',
    updatedAt: '2026-09-14T16:20:00Z'
  }
];

export const INITIAL_DOCUMENTS: VerificationDocument[] = [
  {
    id: 'doc-001',
    intakeId: 'intake-za-001',
    docType: 'sa_id',
    fileName: 'Sizwe_Mkhize_Smart_ID_Card.pdf',
    fileSize: 1420500,
    fileMime: 'application/pdf',
    status: 'valid',
    aiConfidence: 0.98,
    aiValidationSummary: 'South African Smart ID Card authenticated. 13-digit Luhn checksum passed. Full name and birthdate (1992-03-15) cross-matched with intake profile.',
    issueDate: '2018-05-12',
    extractedData: {
      idNumber: '9203155182089',
      birthDate: '1992-03-15',
      gender: 'Male',
      citizenStatus: 'SA Citizen',
      luhnValid: true
    },
    uploadedAt: '2026-11-04T09:16:00Z'
  },
  {
    id: 'doc-002',
    intakeId: 'intake-za-001',
    docType: 'proof_of_residence',
    fileName: 'City_of_CapeTown_Municipal_Account.pdf',
    fileSize: 840200,
    fileMime: 'application/pdf',
    status: 'valid',
    aiConfidence: 0.95,
    aiValidationSummary: 'Municipal utility rates account issued 42 days ago. Meets FICA 90-day statutory threshold (48 days remaining). Residential address in Rondebosch confirmed.',
    issueDate: '2026-09-25',
    extractedData: {
      utilityDate: '2026-09-25',
      isUnder90Days: true,
      utilityIssuer: 'City of Cape Town Municipality',
      addressText: '44 Belmont Road, Rondebosch, Cape Town, 7700',
      daysRemaining: 48
    },
    uploadedAt: '2026-11-04T09:18:20Z'
  },
  {
    id: 'doc-003',
    intakeId: 'intake-za-002',
    docType: 'company_registration',
    fileName: 'Apex_Solar_CIPC_CoR14_3.pdf',
    fileSize: 2150000,
    fileMime: 'application/pdf',
    status: 'valid',
    aiConfidence: 0.96,
    aiValidationSummary: 'Official CIPC registration certificate CoR 14.3. Enterprise 2021/489102/07 confirmed in active business status.',
    issueDate: '2021-06-10',
    extractedData: {
      companyRegistrationNumber: '2021/489102/07',
      companyName: 'Apex Solar Energy Solutions (Pty) Ltd'
    },
    uploadedAt: '2026-11-05T14:35:00Z'
  },
  {
    id: 'doc-004',
    intakeId: 'intake-za-002',
    docType: 'proof_of_residence',
    fileName: 'City_Power_Johannesburg_Statement.pdf',
    fileSize: 1120000,
    fileMime: 'application/pdf',
    status: 'valid',
    aiConfidence: 0.92,
    aiValidationSummary: 'City Power utility statement issued 80 days ago. WARNING: Approaching statutory FICA 90-day expiration window (only 10 days remaining before refresh required).',
    issueDate: '2026-08-18',
    extractedData: {
      utilityDate: '2026-08-18',
      isUnder90Days: true,
      utilityIssuer: 'City Power Johannesburg (SOC) Ltd',
      addressText: '12 Fredman Drive, Sandton, Johannesburg, 2196',
      daysRemaining: 10
    },
    uploadedAt: '2026-11-05T14:40:00Z'
  },
  {
    id: 'doc-005',
    intakeId: 'intake-za-003',
    docType: 'sa_id',
    fileName: 'Elena_Rodriguez_Passport_Scan.pdf',
    fileSize: 1780000,
    fileMime: 'application/pdf',
    status: 'flagged',
    aiConfidence: 0.88,
    aiValidationSummary: 'CRITICAL COMPLIANCE NOTICE: Foreign passport scan expired on 2026-10-15 (22 days overdue). Ongoing due diligence mandates renewal document before instruction sign-off.',
    issueDate: '2016-10-15',
    expiryDate: '2026-10-15',
    extractedData: {
      idNumber: 'P89210492',
      birthDate: '1988-11-20',
      citizenStatus: 'Foreign National',
      daysRemaining: -22
    },
    uploadedAt: '2026-11-06T08:01:00Z'
  },
  {
    id: 'doc-006',
    intakeId: 'intake-za-003',
    docType: 'proof_of_residence',
    fileName: 'Swisscom_Utility_Statement_July2026.pdf',
    fileSize: 940000,
    fileMime: 'application/pdf',
    status: 'flagged',
    aiConfidence: 0.89,
    aiValidationSummary: 'FICA EXPIRED: Utility statement issued 109 days ago (2026-07-20). Exceeds the statutory 90-day threshold under FICA Act 38. Client refresh required.',
    issueDate: '2026-07-20',
    extractedData: {
      utilityDate: '2026-07-20',
      isUnder90Days: false,
      utilityIssuer: 'Swisscom AG',
      daysRemaining: -19
    },
    uploadedAt: '2026-11-06T08:03:00Z'
  },
  {
    id: 'doc-007',
    intakeId: 'intake-za-005',
    docType: 'company_registration',
    fileName: 'Cape_Winelands_CIPC_CoR14_3.pdf',
    fileSize: 1850000,
    fileMime: 'application/pdf',
    status: 'valid',
    aiConfidence: 0.99,
    aiValidationSummary: 'CIPC Enterprise 2018/312094/07 authenticated in good standing. Directors & beneficial ownership register verified by FICA Officer.',
    issueDate: '2018-04-02',
    extractedData: {
      companyRegistrationNumber: '2018/312094/07',
      companyName: 'Cape Winelands Holdings (Pty) Ltd'
    },
    uploadedAt: '2026-09-12T08:12:00Z'
  },
  {
    id: 'doc-008',
    intakeId: 'intake-za-005',
    docType: 'proof_of_residence',
    fileName: 'Stellenbosch_Municipality_Rates_Oct2026.pdf',
    fileSize: 790000,
    fileMime: 'application/pdf',
    status: 'valid',
    aiConfidence: 0.97,
    aiValidationSummary: 'Municipal rates statement issued 2026-10-18 (within 90-day FICA threshold). Registered business premises in Stellenbosch confirmed.',
    issueDate: '2026-10-18',
    extractedData: {
      utilityDate: '2026-10-18',
      isUnder90Days: true,
      utilityIssuer: 'Stellenbosch Local Municipality',
      addressText: '18 Dorp Street, Stellenbosch, 7600',
      daysRemaining: 62
    },
    uploadedAt: '2026-10-20T09:00:00Z'
  },
  {
    id: 'doc-009',
    intakeId: 'intake-za-004',
    docType: 'sa_id',
    fileName: 'Mokoena_Lead_Trustee_ID_Pending.pdf',
    fileSize: 1150000,
    fileMime: 'application/pdf',
    status: 'pending',
    aiConfidence: 0.78,
    aiValidationSummary: 'Initial trustee ID uploaded at Step 2; awaiting trust Letters of Authority (J417) and proof of residential address to finalize EDD check.',
    issueDate: '2020-02-14',
    extractedData: {
      citizenStatus: 'SA Citizen'
    },
    uploadedAt: '2026-10-22T09:40:00Z'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    intakeId: 'intake-za-001',
    action: 'INTAKE_INVITATION_DISPATCHED',
    performedBy: 'Adv. Sibusiso Dlamini (Practice Manager)',
    ipAddress: '197.229.4.18 (Cape Town, ZA)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    popiaLawfulBasis: 'Section 11(1)(b) - Performance of a contract / client instruction',
    hash: 'a9f24e019c4d8120b084918237e1a90c10293847561234567890abcdef123456',
    timestamp: '2026-11-04T09:10:00Z'
  },
  {
    id: 'log-002',
    intakeId: 'intake-za-001',
    action: 'MAGIC_LINK_AUTHENTICATED',
    performedBy: 'sizwe.mkhize@gmail.com',
    ipAddress: '105.184.21.90 (Vodacom Cellular ZA)',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    popiaLawfulBasis: 'Section 11(1)(a) - Consent of the data subject',
    hash: '83f910481920acde102938475610293847561029384756102938475610293847',
    timestamp: '2026-11-04T09:12:30Z'
  },
  {
    id: 'log-003',
    intakeId: 'intake-za-001',
    action: 'POPIA_SECTION_11_CONSENT_SIGNED',
    performedBy: 'sizwe.mkhize@gmail.com',
    ipAddress: '105.184.21.90 (Vodacom Cellular ZA)',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    popiaLawfulBasis: 'Section 11(1)(a) - Specific informed consent recorded with biometric timestamp',
    hash: 'b1490284910293847561029384756102938475610293847561029384756102938',
    timestamp: '2026-11-04T09:14:22Z'
  },
  {
    id: 'log-004',
    intakeId: 'intake-za-001',
    action: 'AI_DOCUMENT_VALIDATION_COMPLETED',
    performedBy: 'ClientOnboard AI Engine (gemini-3.8-flash)',
    ipAddress: 'Internal Server Worker (GCP europe-west2)',
    userAgent: 'aistudio-build/2.0 (@google/genai)',
    popiaLawfulBasis: 'Section 19 - Security measures on integrity and confidentiality',
    hash: 'f0192847561029384756102938475610293847561029384756102938475610293',
    timestamp: '2026-11-04T09:18:40Z'
  },
  {
    id: 'log-005',
    intakeId: 'intake-za-002',
    action: 'INTAKE_INVITATION_DISPATCHED',
    performedBy: 'Anika van der Merwe (CA(SA) & RA)',
    ipAddress: '196.25.112.40 (Sandton, ZA)',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    popiaLawfulBasis: 'Section 11(1)(b) - Corporate statutory audit onboarding mandate',
    hash: 'c7e812940ab567123890fe451290ab34cd567890ef1234567890abcdef990011',
    timestamp: '2026-10-08T14:20:00Z'
  },
  {
    id: 'log-006',
    intakeId: 'intake-za-002',
    action: 'POPIA_SECTION_11_CONSENT_SIGNED',
    performedBy: 'finance@apexsolar.co.za',
    ipAddress: '41.13.92.118 (MTN Business Fibre ZA)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    popiaLawfulBasis: 'Section 11(1)(a) - Informed consent granted by authorized director',
    hash: 'd9a4501928374655647382910abcdef1234567890fedcba0987654321123456',
    timestamp: '2026-10-08T14:30:10Z'
  },
  {
    id: 'log-007',
    intakeId: 'intake-za-002',
    action: 'CIPC_AND_UTILITY_FICA_CHECK_FLAGGED',
    performedBy: 'ClientOnboard AI Engine (gemini-3.8-flash)',
    ipAddress: 'Internal Server Worker (GCP europe-west2)',
    userAgent: 'aistudio-build/2.0 (@google/genai)',
    popiaLawfulBasis: 'FICA Section 21C - Utility bill flagged approaching 90-day statutory threshold',
    hash: 'e411223344556677889900aabbccddeeff00112233445566778899aabbccddee',
    timestamp: '2026-10-14T14:45:00Z'
  },
  {
    id: 'log-008',
    intakeId: 'intake-za-003',
    action: 'INTAKE_INVITATION_DISPATCHED',
    performedBy: 'Dr. Thabo Khumalo (Managing Director)',
    ipAddress: '197.184.60.12 (Umhlanga, ZA)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    popiaLawfulBasis: 'Section 11(1)(b) - Cross-border advisory instruction',
    hash: '19aabbccddeeff0011223344556677889900112233445566778899aabbccdd12',
    timestamp: '2026-09-28T07:50:00Z'
  },
  {
    id: 'log-009',
    intakeId: 'intake-za-003',
    action: 'POPIA_SECTION_11_CONSENT_SIGNED',
    performedBy: 'elena.rodriguez@interglobal.ch',
    ipAddress: '178.197.224.88 (Zurich Swisscom Gateway)',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)',
    popiaLawfulBasis: 'Section 11(1)(a) & Sec 72 - Cross-border data transfer consent executed',
    hash: '28bbccddeeff0011223344556677889900112233445566778899aabbccddeeff',
    timestamp: '2026-09-28T08:00:00Z'
  },
  {
    id: 'log-010',
    intakeId: 'intake-za-003',
    action: 'FICA_DOCUMENT_EXPIRY_FLAG_RAISED',
    performedBy: 'ClientOnboard AI Engine (gemini-3.8-flash)',
    ipAddress: 'Internal Server Worker (GCP europe-west2)',
    userAgent: 'aistudio-build/2.0 (@google/genai)',
    popiaLawfulBasis: 'FICA Regulation 3 & Sec 21 - Passport & utility address statement exceeded validity window',
    hash: '37ccddeeff0011223344556677889900112233445566778899aabbccddeeff01',
    timestamp: '2026-10-03T08:05:00Z'
  },
  {
    id: 'log-011',
    intakeId: 'intake-za-004',
    action: 'INTAKE_INVITATION_DISPATCHED',
    performedBy: 'Adv. Sibusiso Dlamini (Senior Partner)',
    ipAddress: '197.229.4.18 (Cape Town, ZA)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    popiaLawfulBasis: 'Section 11(1)(b) - Trust deed EDD & conveyancing onboarding',
    hash: '46ddeeff0011223344556677889900112233445566778899aabbccddeeff0123',
    timestamp: '2026-10-21T10:15:00Z'
  },
  {
    id: 'log-012',
    intakeId: 'intake-za-004',
    action: 'POPIA_SECTION_11_CONSENT_SIGNED',
    performedBy: 'trustees@mokoenafamily.co.za',
    ipAddress: '102.66.44.19 (Telkom LTE ZA)',
    userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36',
    popiaLawfulBasis: 'Section 11(1)(a) - Trustee consent recorded prior to Step 2 pause',
    hash: '55eeff0011223344556677889900112233445566778899aabbccddeeff012345',
    timestamp: '2026-10-21T10:18:00Z'
  },
  {
    id: 'log-013',
    intakeId: 'intake-za-005',
    action: 'POPIA_SECTION_11_CONSENT_SIGNED',
    performedBy: 'legal@capewinelands.co.za',
    ipAddress: '165.73.12.90 (Cape Town Corporate Fibre)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    popiaLawfulBasis: 'Section 11(1)(a) - Corporate conveyancing mandate & POPIA declaration signed',
    hash: '64ff0011223344556677889900112233445566778899aabbccddeeff01234567',
    timestamp: '2026-09-12T08:05:00Z'
  },
  {
    id: 'log-014',
    intakeId: 'intake-za-005',
    action: 'INTAKE_STATUS_UPDATED_APPROVED',
    performedBy: 'Adv. Sibusiso Dlamini (Senior Partner)',
    ipAddress: '197.229.4.18 (Cape Town, ZA)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    popiaLawfulBasis: 'FICA Section 21 & POPIA Sec 19 - Final Officer clearance granted and sealed',
    hash: '730011223344556677889900112233445566778899aabbccddeeff0123456789',
    timestamp: '2026-09-14T16:20:00Z'
  }
];
