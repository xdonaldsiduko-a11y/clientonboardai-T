import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  PracticeProfile,
  ClientIntake,
  VerificationDocument,
  AuditLog,
  IntakeStatus,
  OfficerReminderWorkflow,
  OfficerReminderWorkflowStatus
} from './types';

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
] as const;
import {
  INITIAL_PRACTICES,
  INITIAL_INTAKES,
  INITIAL_DOCUMENTS,
  INITIAL_AUDIT_LOGS
} from './data/mockPractices';

const typedFirebaseConfig = firebaseConfig as typeof firebaseConfig & {
  firestoreDatabaseId?: string;
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(typedFirebaseConfig) : getApp();

// Use firestoreDatabaseId from firebase-applet-config.json when present
export const db = typedFirebaseConfig.firestoreDatabaseId
  ? getFirestore(app, typedFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

// Skill Mandate: Connection Test on Boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Error Handling specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Defensive Payload Constraints matching firebase-blueprint.json maxLengths & patterns
export function sanitizeDocId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}-${Date.now()}`;
}

export function clampString(val: string | undefined | null, maxLength: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : fallback;
  return str.slice(0, maxLength);
}

export function cleanOptionalString(val: string | undefined | null, maxLength: number): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export function timestampToIso(value: unknown, fallback?: string): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback || new Date().toISOString();
}

// Payload Builders aligned strictly with firebase-blueprint.json & firestore.rules
function buildPracticePayload(practice: PracticeProfile, ownerUid: string, includeCreatedAt: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeDocId(practice.id, 'practice'),
    practiceName: clampString(practice.practiceName, 100, 'South African Practice'),
    professionType: practice.professionType,
    ownerUid: sanitizeDocId(ownerUid, 'user'),
    adminEmail: clampString(practice.adminEmail, 120, 'officer@practice.co.za'),
    ficaOfficerName: clampString(practice.ficaOfficerName, 100, 'FICA Compliance Officer'),
    retentionPolicyDays: Math.min(3650, Math.max(365, Number(practice.retentionPolicyDays) || 1825)),
    city: clampString(practice.city, 80, 'Johannesburg'),
    province: clampString(practice.province, 80, 'Gauteng'),
    tagline: clampString(practice.tagline, 200, 'FICA & POPIA Compliance Practice'),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return stripUndefined(payload);
}

function buildIntakePayload(
  intake: ClientIntake,
  practiceId: string,
  ownerUid: string,
  includeCreatedAt: boolean
) {
  const safeReasons = Array.isArray(intake.riskReasons)
    ? intake.riskReasons
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .slice(0, 10)
        .map((r) => clampString(r, 200))
    : undefined;

  const payload: Record<string, unknown> = {
    id: sanitizeDocId(intake.id, 'intake'),
    practiceId: sanitizeDocId(practiceId, 'practice'),
    ownerUid: sanitizeDocId(ownerUid, 'user'),
    clientEmail: clampString(intake.clientEmail, 120, 'client@domain.co.za'),
    clientName: clampString(intake.clientName, 100, 'South African Client'),
    clientType: intake.clientType,
    phone: clampString(intake.phone, 30, '+27 00 000 0000'),
    idNumber: clampString(intake.idNumber, 30, ''),
    companyName: cleanOptionalString(intake.companyName, 120),
    registrationNumber: cleanOptionalString(intake.registrationNumber, 40),
    taxNumber: cleanOptionalString(intake.taxNumber, 40),
    status: intake.status,
    popiaConsent: Boolean(intake.popiaConsent),
    popiaConsentDate: cleanOptionalString(intake.popiaConsentDate, 64),
    currentStep: Math.min(5, Math.max(1, Number(intake.currentStep) || 1)),
    magicLinkToken: clampString(intake.magicLinkToken, 128, `token_${Date.now()}`),
    riskRating: intake.riskRating,
    riskReasons: safeReasons,
    openedAt: clampString(intake.createdAt, 64, new Date().toISOString()),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return stripUndefined(payload);
}

function buildDocumentPayload(
  documentItem: VerificationDocument,
  practiceId: string,
  intakeId: string,
  ownerUid: string,
  includeCreatedAt: boolean
) {
  const safeExtracted =
    documentItem.extractedData && typeof documentItem.extractedData === 'object'
      ? Object.fromEntries(
          Object.entries(documentItem.extractedData)
            .filter(([, v]) => v !== undefined)
            .slice(0, 16)
        )
      : undefined;

  const payload: Record<string, unknown> = {
    id: sanitizeDocId(documentItem.id, 'doc'),
    practiceId: sanitizeDocId(practiceId, 'practice'),
    intakeId: sanitizeDocId(intakeId, 'intake'),
    ownerUid: sanitizeDocId(ownerUid, 'user'),
    docType: documentItem.docType,
    fileName: clampString(documentItem.fileName, 128, 'FICA_Document.pdf'),
    fileSize: Math.min(52428800, Math.max(0, Number(documentItem.fileSize) || 0)),
    fileMime: clampString(documentItem.fileMime, 64, 'application/pdf'),
    status: documentItem.status,
    aiConfidence: Math.min(1, Math.max(0, Number(documentItem.aiConfidence) || 0)),
    aiValidationSummary: clampString(documentItem.aiValidationSummary, 1000, 'Pending AI validation'),
    issueDate: cleanOptionalString(documentItem.issueDate, 32),
    expiryDate: cleanOptionalString(documentItem.expiryDate, 32),
    extractedData: safeExtracted,
    uploadedAt: clampString(documentItem.uploadedAt, 64, new Date().toISOString()),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return stripUndefined(payload);
}

function buildAuditLogPayload(log: AuditLog, practiceId: string, ownerUid: string) {
  return stripUndefined({
    id: sanitizeDocId(log.id, 'log'),
    practiceId: sanitizeDocId(practiceId, 'practice'),
    ownerUid: sanitizeDocId(ownerUid, 'user'),
    intakeId: clampString(log.intakeId, 128, 'SYSTEM_EVENT'),
    action: clampString(log.action, 64, 'COMPLIANCE_EVENT'),
    performedBy: clampString(log.performedBy, 120, 'System'),
    ipAddress: clampString(log.ipAddress, 64, '0.0.0.0'),
    userAgent: clampString(log.userAgent, 240, 'ClientOnboard/1.0'),
    popiaLawfulBasis: clampString(log.popiaLawfulBasis, 300, 'POPIA Section 19 Safeguards'),
    hash: clampString(log.hash, 128, ''),
    timestamp: clampString(log.timestamp, 64, new Date().toISOString()),
    createdAt: serverTimestamp(),
  });
}

function buildReminderWorkflowPayload(
  workflow: OfficerReminderWorkflow,
  practiceId: string,
  ownerUid: string,
  includeCreatedAt: boolean
) {
  const payload: Record<string, unknown> = {
    id: sanitizeDocId(workflow.id, 'wf'),
    practiceId: sanitizeDocId(practiceId, 'practice'),
    intakeId: sanitizeDocId(workflow.intakeId, 'intake'),
    ownerUid: sanitizeDocId(ownerUid, 'user'),
    clientName: clampString(workflow.clientName, 100, 'South African Client'),
    clientEmail: clampString(workflow.clientEmail, 120, 'client@domain.co.za'),
    officerEmail: clampString(workflow.officerEmail, 120, 'officer@practice.co.za'),
    status: workflow.status,
    leadDaysBeforeExpiry: Math.min(7, Math.max(1, Number(workflow.leadDaysBeforeExpiry) || 2)),
    expiryDateIso: clampString(workflow.expiryDateIso, 64, new Date().toISOString().slice(0, 10)),
    targetNotifyDateIso: clampString(
      workflow.targetNotifyDateIso,
      64,
      new Date().toISOString().slice(0, 10)
    ),
    outstandingSummary: clampString(
      workflow.outstandingSummary,
      600,
      'Outstanding FICA compliance verification documents'
    ),
    dailyReminderActive: Boolean(workflow.dailyReminderActive),
    lastDailyNagDate: cleanOptionalString(workflow.lastDailyNagDate, 32),
    channelsSynced: clampString(workflow.channelsSynced, 200, 'Portal Log'),
    googleEventId: cleanOptionalString(workflow.googleEventId, 160),
    googleTaskId: cleanOptionalString(workflow.googleTaskId, 160),
    msEventId: cleanOptionalString(workflow.msEventId, 200),
    msTaskListId: cleanOptionalString(workflow.msTaskListId, 200),
    msTaskId: cleanOptionalString(workflow.msTaskId, 200),
    automatedAt: clampString(workflow.automatedAt, 64, new Date().toISOString()),
    reminderSentAt: cleanOptionalString(workflow.reminderSentAt, 64),
    clientRespondedAt: cleanOptionalString(workflow.clientRespondedAt, 64),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return stripUndefined(payload);
}

// Upsert user private PII profile and provision default South African FICA workspace on first sign-in
export async function syncUserProfileAndSeedWorkspace(user: User): Promise<void> {
  const uid = sanitizeDocId(user.uid, 'user');
  const profilePath = `users/${uid}/private/profile`;

  try {
    const profileRef = doc(db, 'users', uid, 'private', 'profile');
    const existingProfile = await getDoc(profileRef);
    const email = clampString(user.email, 120, 'officer@practice.co.za');
    const displayName = clampString(user.displayName || email.split('@')[0], 100, 'Practice Officer');
    const photoURL = cleanOptionalString(user.photoURL, 500);

    if (!existingProfile.exists()) {
      await setDoc(
        profileRef,
        stripUndefined({
          uid,
          email,
          displayName,
          photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      await updateDoc(
        profileRef,
        stripUndefined({
          email,
          displayName,
          photoURL,
          updatedAt: serverTimestamp(),
        })
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  // Check if user already owns practices in Firestore
  let existingCount = 0;
  try {
    const practicesQuery = query(collection(db, 'practices'), where('ownerUid', '==', uid));
    const snap = await getDocs(practicesQuery);
    existingCount = snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'practices');
  }

  if (existingCount > 0) {
    return;
  }

  // Provision initial multi-practice South African FICA workspace owned by this authenticated user
  const uidSuffix = uid.slice(0, 12);
  const practiceIdMap: Record<string, string> = {};
  const intakePracticeMap: Record<string, string> = {};

  // Stage 1: Commit practices first so Master Gate exists() / get() checks succeed for child subcollections
  try {
    const practicesBatch = writeBatch(db);
    INITIAL_PRACTICES.forEach((p, idx) => {
      const scopedId = sanitizeDocId(`${p.id}-${uidSuffix}`);
      practiceIdMap[p.id] = scopedId;
      const scopedPractice: PracticeProfile = {
        ...p,
        id: scopedId,
        ownerUid: uid,
        adminEmail: idx === 0 && user.email ? user.email : p.adminEmail,
        ficaOfficerName:
          idx === 0 && user.displayName ? `${user.displayName} (FICA Officer)` : p.ficaOfficerName,
      };
      practicesBatch.set(doc(db, 'practices', scopedId), buildPracticePayload(scopedPractice, uid, true));
    });
    await practicesBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'practices');
  }

  // Stage 2: Commit intakes second so parent intake exists() succeeds for documents
  const intakeIdMap: Record<string, string> = {};
  try {
    const intakesBatch = writeBatch(db);
    INITIAL_INTAKES.forEach((intake) => {
      const targetPracticeId = practiceIdMap[intake.practiceId] || Object.values(practiceIdMap)[0];
      const scopedIntakeId = sanitizeDocId(`${intake.id}-${uidSuffix}`);
      intakeIdMap[intake.id] = scopedIntakeId;
      intakePracticeMap[scopedIntakeId] = targetPracticeId;

      const scopedIntake: ClientIntake = {
        ...intake,
        id: scopedIntakeId,
        practiceId: targetPracticeId,
      };
      intakesBatch.set(
        doc(db, 'practices', targetPracticeId, 'intakes', scopedIntakeId),
        buildIntakePayload(scopedIntake, targetPracticeId, uid, true)
      );
    });
    await intakesBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'practices/*/intakes');
  }

  // Stage 3: Commit FICA documents and immutable audit logs
  try {
    const childrenBatch = writeBatch(db);
    INITIAL_DOCUMENTS.forEach((docItem) => {
      const targetIntakeId = intakeIdMap[docItem.intakeId];
      if (!targetIntakeId) return;
      const targetPracticeId = intakePracticeMap[targetIntakeId];
      const scopedDocId = sanitizeDocId(`${docItem.id}-${uidSuffix}`);

      const scopedDoc: VerificationDocument = {
        ...docItem,
        id: scopedDocId,
        intakeId: targetIntakeId,
      };
      childrenBatch.set(
        doc(db, 'practices', targetPracticeId, 'intakes', targetIntakeId, 'documents', scopedDocId),
        buildDocumentPayload(scopedDoc, targetPracticeId, targetIntakeId, uid, true)
      );
    });

    INITIAL_AUDIT_LOGS.forEach((logItem) => {
      const mappedIntakeId = intakeIdMap[logItem.intakeId];
      const targetPracticeId = mappedIntakeId
        ? intakePracticeMap[mappedIntakeId]
        : Object.values(practiceIdMap)[0];
      const scopedLogId = sanitizeDocId(`${logItem.id}-${uidSuffix}`);

      const scopedLog: AuditLog = {
        ...logItem,
        id: scopedLogId,
        intakeId: mappedIntakeId || logItem.intakeId,
      };
      childrenBatch.set(
        doc(db, 'practices', targetPracticeId, 'auditLogs', scopedLogId),
        buildAuditLogPayload(scopedLog, targetPracticeId, uid)
      );
    });

    await childrenBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'practices/*/children');
  }
}

// Real-time Subscriptions (every query filters by ownerUid to satisfy Pillar 8)
export function subscribePractices(
  ownerUid: string,
  onData: (practices: PracticeProfile[]) => void
): Unsubscribe {
  const path = 'practices';
  const q = query(collection(db, path), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PracticeProfile[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          practiceName: String(d.practiceName || ''),
          professionType: d.professionType || 'law_firm',
          ownerUid: String(d.ownerUid || ownerUid),
          adminEmail: String(d.adminEmail || ''),
          ficaOfficerName: String(d.ficaOfficerName || ''),
          retentionPolicyDays: Number(d.retentionPolicyDays || 1825),
          city: String(d.city || ''),
          province: String(d.province || ''),
          tagline: String(d.tagline || ''),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePracticeIntakes(
  practiceId: string,
  ownerUid: string,
  onData: (practiceId: string, intakes: ClientIntake[]) => void
): Unsubscribe {
  const path = `practices/${practiceId}/intakes`;
  const q = query(collection(db, 'practices', practiceId, 'intakes'), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ClientIntake[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          practiceId: String(d.practiceId || practiceId),
          clientEmail: String(d.clientEmail || ''),
          clientName: String(d.clientName || ''),
          clientType: d.clientType || 'individual',
          phone: String(d.phone || ''),
          idNumber: String(d.idNumber || ''),
          companyName: typeof d.companyName === 'string' ? d.companyName : undefined,
          registrationNumber: typeof d.registrationNumber === 'string' ? d.registrationNumber : undefined,
          taxNumber: typeof d.taxNumber === 'string' ? d.taxNumber : undefined,
          status: d.status || 'draft',
          popiaConsent: Boolean(d.popiaConsent),
          popiaConsentDate: typeof d.popiaConsentDate === 'string' ? d.popiaConsentDate : undefined,
          currentStep: Number(d.currentStep || 1),
          magicLinkToken: String(d.magicLinkToken || ''),
          riskRating: d.riskRating || 'low',
          riskReasons: Array.isArray(d.riskReasons) ? d.riskReasons.map(String) : undefined,
          createdAt: timestampToIso(d.openedAt || d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
        };
      });
      onData(practiceId, items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeIntakeDocuments(
  practiceId: string,
  intakeId: string,
  ownerUid: string,
  onData: (intakeId: string, docs: VerificationDocument[]) => void
): Unsubscribe {
  const path = `practices/${practiceId}/intakes/${intakeId}/documents`;
  const q = query(
    collection(db, 'practices', practiceId, 'intakes', intakeId, 'documents'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: VerificationDocument[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          intakeId: String(d.intakeId || intakeId),
          docType: d.docType || 'sa_id',
          fileName: String(d.fileName || ''),
          fileSize: Number(d.fileSize || 0),
          fileMime: String(d.fileMime || 'application/pdf'),
          status: d.status || 'pending',
          aiConfidence: Number(d.aiConfidence || 0),
          aiValidationSummary: String(d.aiValidationSummary || ''),
          issueDate: typeof d.issueDate === 'string' ? d.issueDate : undefined,
          expiryDate: typeof d.expiryDate === 'string' ? d.expiryDate : undefined,
          extractedData:
            d.extractedData && typeof d.extractedData === 'object' ? d.extractedData : undefined,
          uploadedAt: timestampToIso(d.uploadedAt),
        };
      });
      onData(intakeId, items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePracticeAuditLogs(
  practiceId: string,
  ownerUid: string,
  onData: (practiceId: string, logs: AuditLog[]) => void
): Unsubscribe {
  const path = `practices/${practiceId}/auditLogs`;
  const q = query(collection(db, 'practices', practiceId, 'auditLogs'), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AuditLog[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          intakeId: String(d.intakeId || ''),
          action: String(d.action || ''),
          performedBy: String(d.performedBy || ''),
          ipAddress: String(d.ipAddress || ''),
          userAgent: String(d.userAgent || ''),
          popiaLawfulBasis: String(d.popiaLawfulBasis || ''),
          hash: String(d.hash || ''),
          timestamp: timestampToIso(d.timestamp || d.createdAt),
        };
      });
      onData(practiceId, items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// Firestore Persistence Mutations (All wrapped with handleFirestoreError)
export async function persistCompletedIntake(
  ownerUid: string,
  practiceId: string,
  intake: ClientIntake,
  docs: VerificationDocument[],
  auditLog: AuditLog
): Promise<void> {
  const safePracticeId = sanitizeDocId(practiceId, 'practice');
  const safeIntakeId = sanitizeDocId(intake.id, 'intake');
  const intakePath = `practices/${safePracticeId}/intakes/${safeIntakeId}`;
  const intakeRef = doc(db, 'practices', safePracticeId, 'intakes', safeIntakeId);

  try {
    const existingSnap = await getDoc(intakeRef);
    if (existingSnap.exists()) {
      const updatePayload = buildIntakePayload(intake, safePracticeId, ownerUid, false);
      delete updatePayload.id;
      delete updatePayload.practiceId;
      delete updatePayload.ownerUid;
      delete updatePayload.openedAt;
      await updateDoc(intakeRef, updatePayload);
    } else {
      await setDoc(intakeRef, buildIntakePayload(intake, safePracticeId, ownerUid, true));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, intakePath);
  }

  for (const docItem of docs) {
    const safeDocId = sanitizeDocId(docItem.id, 'doc');
    const docPath = `practices/${safePracticeId}/intakes/${safeIntakeId}/documents/${safeDocId}`;
    const docRef = doc(db, 'practices', safePracticeId, 'intakes', safeIntakeId, 'documents', safeDocId);
    try {
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        const updateDocPayload = buildDocumentPayload(docItem, safePracticeId, safeIntakeId, ownerUid, false);
        delete updateDocPayload.id;
        delete updateDocPayload.practiceId;
        delete updateDocPayload.intakeId;
        delete updateDocPayload.ownerUid;
        await updateDoc(docRef, updateDocPayload);
      } else {
        await setDoc(docRef, buildDocumentPayload(docItem, safePracticeId, safeIntakeId, ownerUid, true));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }

  await persistAuditLog(ownerUid, safePracticeId, { ...auditLog, intakeId: safeIntakeId });
}

export async function persistDraftIntakeInvite(
  ownerUid: string,
  practiceId: string,
  intake: ClientIntake,
  auditLog: AuditLog
): Promise<void> {
  const safePracticeId = sanitizeDocId(practiceId, 'practice');
  const safeIntakeId = sanitizeDocId(intake.id, 'intake');
  const intakePath = `practices/${safePracticeId}/intakes/${safeIntakeId}`;

  try {
    await setDoc(
      doc(db, 'practices', safePracticeId, 'intakes', safeIntakeId),
      buildIntakePayload(intake, safePracticeId, ownerUid, true)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, intakePath);
  }

  await persistAuditLog(ownerUid, safePracticeId, { ...auditLog, intakeId: safeIntakeId });
}

export async function persistIntakeStatusUpdate(
  ownerUid: string,
  practiceId: string,
  intakeId: string,
  newStatus: IntakeStatus,
  auditLog: AuditLog
): Promise<void> {
  const safePracticeId = sanitizeDocId(practiceId, 'practice');
  const safeIntakeId = sanitizeDocId(intakeId, 'intake');
  const intakePath = `practices/${safePracticeId}/intakes/${safeIntakeId}`;

  try {
    await updateDoc(doc(db, 'practices', safePracticeId, 'intakes', safeIntakeId), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, intakePath);
  }

  await persistAuditLog(ownerUid, safePracticeId, auditLog);
}

export async function persistAuditLog(
  ownerUid: string,
  practiceId: string,
  auditLog: AuditLog
): Promise<void> {
  const safePracticeId = sanitizeDocId(practiceId, 'practice');
  const safeLogId = sanitizeDocId(auditLog.id, 'log');
  const logPath = `practices/${safePracticeId}/auditLogs/${safeLogId}`;

  try {
    await setDoc(
      doc(db, 'practices', safePracticeId, 'auditLogs', safeLogId),
      buildAuditLogPayload({ ...auditLog, id: safeLogId }, safePracticeId, ownerUid)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, logPath);
  }
}

export function subscribePracticeReminderWorkflows(
  practiceId: string,
  ownerUid: string,
  onData: (practiceId: string, workflows: OfficerReminderWorkflow[]) => void
): Unsubscribe {
  const path = `practices/${practiceId}/reminderWorkflows`;
  const q = query(
    collection(db, 'practices', practiceId, 'reminderWorkflows'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: OfficerReminderWorkflow[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          practiceId: String(d.practiceId || practiceId),
          intakeId: String(d.intakeId || ''),
          ownerUid: String(d.ownerUid || ownerUid),
          clientName: String(d.clientName || ''),
          clientEmail: String(d.clientEmail || ''),
          officerEmail: String(d.officerEmail || ''),
          status: (d.status || 'scheduled') as OfficerReminderWorkflowStatus,
          leadDaysBeforeExpiry: Number(d.leadDaysBeforeExpiry || 2),
          expiryDateIso: String(d.expiryDateIso || ''),
          targetNotifyDateIso: String(d.targetNotifyDateIso || ''),
          outstandingSummary: String(d.outstandingSummary || ''),
          dailyReminderActive: Boolean(d.dailyReminderActive),
          lastDailyNagDate: typeof d.lastDailyNagDate === 'string' ? d.lastDailyNagDate : undefined,
          channelsSynced: String(d.channelsSynced || 'Portal Log'),
          googleEventId: typeof d.googleEventId === 'string' ? d.googleEventId : undefined,
          googleTaskId: typeof d.googleTaskId === 'string' ? d.googleTaskId : undefined,
          msEventId: typeof d.msEventId === 'string' ? d.msEventId : undefined,
          msTaskListId: typeof d.msTaskListId === 'string' ? d.msTaskListId : undefined,
          msTaskId: typeof d.msTaskId === 'string' ? d.msTaskId : undefined,
          automatedAt: String(d.automatedAt || timestampToIso(d.createdAt)),
          reminderSentAt: typeof d.reminderSentAt === 'string' ? d.reminderSentAt : undefined,
          clientRespondedAt:
            typeof d.clientRespondedAt === 'string' ? d.clientRespondedAt : undefined,
        };
      });
      onData(practiceId, items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function persistReminderWorkflow(
  ownerUid: string,
  practiceId: string,
  workflow: OfficerReminderWorkflow
): Promise<void> {
  const safePracticeId = sanitizeDocId(practiceId, 'practice');
  const safeWorkflowId = sanitizeDocId(workflow.id, 'wf');
  const wfPath = `practices/${safePracticeId}/reminderWorkflows/${safeWorkflowId}`;
  const wfRef = doc(db, 'practices', safePracticeId, 'reminderWorkflows', safeWorkflowId);

  try {
    const existing = await getDoc(wfRef);
    if (existing.exists()) {
      const updatePayload = stripUndefined({
        status: workflow.status,
        dailyReminderActive: Boolean(workflow.dailyReminderActive),
        lastDailyNagDate: cleanOptionalString(workflow.lastDailyNagDate, 32),
        channelsSynced: clampString(workflow.channelsSynced, 200, 'Portal Log'),
        googleEventId: cleanOptionalString(workflow.googleEventId, 160),
        googleTaskId: cleanOptionalString(workflow.googleTaskId, 160),
        msEventId: cleanOptionalString(workflow.msEventId, 200),
        msTaskListId: cleanOptionalString(workflow.msTaskListId, 200),
        msTaskId: cleanOptionalString(workflow.msTaskId, 200),
        reminderSentAt: cleanOptionalString(workflow.reminderSentAt, 64),
        clientRespondedAt: cleanOptionalString(workflow.clientRespondedAt, 64),
        outstandingSummary: clampString(
          workflow.outstandingSummary,
          600,
          'Outstanding FICA compliance verification documents'
        ),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(wfRef, updatePayload);
    } else {
      await setDoc(wfRef, buildReminderWorkflowPayload({ ...workflow, id: safeWorkflowId }, safePracticeId, ownerUid, true));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wfPath);
  }
}

export async function stampReminderSentWorkflows(
  ownerUid: string,
  practiceId: string,
  intakeId: string,
  reminderSentAtIso: string
): Promise<OfficerReminderWorkflow[]> {
  const safePracticeId = sanitizeDocId(practiceId, 'practice');
  const safeIntakeId = sanitizeDocId(intakeId, 'intake');
  const colPath = `practices/${safePracticeId}/reminderWorkflows`;
  const updated: OfficerReminderWorkflow[] = [];

  try {
    const q = query(
      collection(db, 'practices', safePracticeId, 'reminderWorkflows'),
      where('ownerUid', '==', ownerUid)
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      if (d.intakeId !== safeIntakeId) continue;

      const nextStatus: OfficerReminderWorkflowStatus = d.clientRespondedAt
        ? 'client_responded'
        : 'reminder_sent';

      await updateDoc(docSnap.ref, {
        status: nextStatus,
        dailyReminderActive: false,
        reminderSentAt: clampString(reminderSentAtIso, 64),
        updatedAt: serverTimestamp(),
      });

      updated.push({
        id: docSnap.id,
        practiceId: safePracticeId,
        intakeId: safeIntakeId,
        ownerUid,
        clientName: String(d.clientName || ''),
        clientEmail: String(d.clientEmail || ''),
        officerEmail: String(d.officerEmail || ''),
        status: nextStatus,
        leadDaysBeforeExpiry: Number(d.leadDaysBeforeExpiry || 2),
        expiryDateIso: String(d.expiryDateIso || ''),
        targetNotifyDateIso: String(d.targetNotifyDateIso || ''),
        outstandingSummary: String(d.outstandingSummary || ''),
        dailyReminderActive: false,
        lastDailyNagDate: typeof d.lastDailyNagDate === 'string' ? d.lastDailyNagDate : undefined,
        channelsSynced: String(d.channelsSynced || ''),
        googleEventId: typeof d.googleEventId === 'string' ? d.googleEventId : undefined,
        googleTaskId: typeof d.googleTaskId === 'string' ? d.googleTaskId : undefined,
        msEventId: typeof d.msEventId === 'string' ? d.msEventId : undefined,
        msTaskListId: typeof d.msTaskListId === 'string' ? d.msTaskListId : undefined,
        msTaskId: typeof d.msTaskId === 'string' ? d.msTaskId : undefined,
        automatedAt: String(d.automatedAt || ''),
        reminderSentAt: clampString(reminderSentAtIso, 64),
        clientRespondedAt: typeof d.clientRespondedAt === 'string' ? d.clientRespondedAt : undefined,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }
  return updated;
}

export async function stampClientRespondedWorkflows(
  ownerUid: string,
  practiceId: string,
  intakeId: string,
  clientRespondedAtIso: string
): Promise<OfficerReminderWorkflow[]> {
  const safePracticeId = sanitizeDocId(practiceId, 'practice');
  const safeIntakeId = sanitizeDocId(intakeId, 'intake');
  const colPath = `practices/${safePracticeId}/reminderWorkflows`;
  const updated: OfficerReminderWorkflow[] = [];

  try {
    const q = query(
      collection(db, 'practices', safePracticeId, 'reminderWorkflows'),
      where('ownerUid', '==', ownerUid)
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const d = docSnap.data();
      if (d.intakeId !== safeIntakeId) continue;

      await updateDoc(docSnap.ref, {
        status: 'client_responded',
        dailyReminderActive: false,
        clientRespondedAt: clampString(clientRespondedAtIso, 64),
        updatedAt: serverTimestamp(),
      });

      updated.push({
        id: docSnap.id,
        practiceId: safePracticeId,
        intakeId: safeIntakeId,
        ownerUid,
        clientName: String(d.clientName || ''),
        clientEmail: String(d.clientEmail || ''),
        officerEmail: String(d.officerEmail || ''),
        status: 'client_responded',
        leadDaysBeforeExpiry: Number(d.leadDaysBeforeExpiry || 2),
        expiryDateIso: String(d.expiryDateIso || ''),
        targetNotifyDateIso: String(d.targetNotifyDateIso || ''),
        outstandingSummary: String(d.outstandingSummary || ''),
        dailyReminderActive: false,
        lastDailyNagDate: typeof d.lastDailyNagDate === 'string' ? d.lastDailyNagDate : undefined,
        channelsSynced: String(d.channelsSynced || ''),
        googleEventId: typeof d.googleEventId === 'string' ? d.googleEventId : undefined,
        googleTaskId: typeof d.googleTaskId === 'string' ? d.googleTaskId : undefined,
        msEventId: typeof d.msEventId === 'string' ? d.msEventId : undefined,
        msTaskListId: typeof d.msTaskListId === 'string' ? d.msTaskListId : undefined,
        msTaskId: typeof d.msTaskId === 'string' ? d.msTaskId : undefined,
        automatedAt: String(d.automatedAt || ''),
        reminderSentAt: typeof d.reminderSentAt === 'string' ? d.reminderSentAt : undefined,
        clientRespondedAt: clampString(clientRespondedAtIso, 64),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }
  return updated;
}

// Passwordless Magic Link Helpers (Client portal link builder)
export async function sendMagicLinkEmail(
  email: string,
  practiceId: string,
  intakeId?: string
): Promise<string> {
  const currentUrl = window.location.origin;
  const targetPath = intakeId ? `/intake/${practiceId}/${intakeId}` : `/intake/${practiceId}`;
  const actionCodeSettings = {
    url: `${currentUrl}${targetPath}?email=${encodeURIComponent(email)}`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    window.localStorage.setItem('activePracticeId', practiceId);
    return actionCodeSettings.url;
  } catch (err) {
    console.warn('Native Firebase email dispatch notice (using local portal gateway URL):', err);
    window.localStorage.setItem('emailForSignIn', email);
    window.localStorage.setItem('activePracticeId', practiceId);
    return actionCodeSettings.url;
  }
}

export async function verifyMagicLink(email: string, link: string): Promise<User | null> {
  if (isSignInWithEmailLink(auth, link)) {
    const result = await signInWithEmailLink(auth, email, link);
    window.localStorage.removeItem('emailForSignIn');
    return result.user;
  }
  return null;
}

export async function loginWithGoogle(): Promise<{ user: User; accessToken: string | null }> {
  const provider = new GoogleAuthProvider();
  for (const scope of GOOGLE_WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return {
    user: result.user,
    accessToken: credential?.accessToken || null,
  };
}

export async function authorizeGoogleWorkspacePopup(): Promise<string | null> {
  const provider = new GoogleAuthProvider();
  for (const scope of GOOGLE_WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'consent select_account' });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential?.accessToken || null;
}

export async function loginWithApple(): Promise<User> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Test connection on boot
testConnection();
