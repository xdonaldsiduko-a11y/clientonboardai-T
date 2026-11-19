# Security Specification: ClientOnboard AI

## 1. Data Invariants
1. Authenticated officers must use Google Sign-In (`email_verified == true`). Private officer PII is isolated under `/users/{userId}/private/profile`.
2. A Practice Profile (`/practices/{practiceId}`) must have a valid `ownerUid == request.auth.uid`, bounded strings, `professionType` enum, and server timestamps (`request.time`).
3. A Client Intake (`/practices/{practiceId}/intakes/{intakeId}`) cannot exist without a verified parent Practice document owned by the caller (`ownerUid == request.auth.uid`).
4. Verification Documents (`/practices/{practiceId}/intakes/{intakeId}/documents/{docId}`) require both a valid parent Practice and parent Intake (`exists()`), enforce bounded sizes (fileSize <= 50MB, strings <= maxLength), and inherit `ownerUid`.
5. Audit Logs (`/practices/{practiceId}/auditLogs/{logId}`) are strictly append-only (`allow update, delete: if false;`) and require parent Practice ownership for POPIA Section 19 integrity.
6. Terminal states (`approved`, `rejected`) on Client Intakes lock subsequent non-admin mutations. All list queries filter directly via `resource.data.ownerUid == request.auth.uid` with zero `get()`/`exists()` inside `allow list`.

## 2. The Dirty Dozen Adversarial Payloads & Defenses
1. **Unauthenticated Read of Client Dossier**: Rejected by global safety net and `isSignedIn() && isEmailVerified()`.
2. **Cross-Tenant List Scraping**: Rejected because `allow list` strictly requires `resource.data.ownerUid == request.auth.uid`.
3. **Ghost / Shadow Field Injection**: Rejected by `data.keys().hasAll(...) && data.keys().hasOnly(...)` in every `isValid*` helper and `affectedKeys().hasOnly(...)` on every update branch.
4. **Spoofed Admin Email (`email_verified == false`)**: Rejected by mandatory `request.auth.token.email_verified == true` check in `isEmailVerified()` and `isAdmin()`.
5. **Client Forged Timestamps**: Rejected by enforcing `incoming().createdAt == request.time` on creates and `incoming().updatedAt == request.time` on updates.
6. **Audit Log Tampering / Deletion**: Rejected by explicit `allow update, delete: if false;` on `/practices/{practiceId}/auditLogs/{logId}`.
7. **ID / Path Poisoning (1.5KB junk ID)**: Rejected by `isValidId()` enforcing `^[a-zA-Z0-9_\\-]+$` and `<= 128` bytes.
8. **Denial of Wallet via Oversized Strings/Arrays**: Rejected by strict `.size()` limits on every string, map key count (`<= 16`), and array (`<= 10`).
9. **Terminal State Bypass (`approved` -> `draft`)**: Rejected by `(!(existing().status in ['approved', 'rejected']) || isAdmin())`.
10. **Immortal Field Hijack (`ownerUid` / `practiceId` swap on update)**: Rejected by equality checks (`incoming().ownerUid == existing().ownerUid`, `incoming().practiceId == existing().practiceId`, `incoming().createdAt == existing().createdAt`).
11. **Orphan Document Injection**: Rejected by `exists(.../practices/$(practiceId)/intakes/$(intakeId))` check before document creation.
12. **Client Privilege Escalation on Intake Approval**: Clients matching `clientEmail` are blocked from setting `status in ['approved', 'rejected']` and restricted via `affectedKeys().hasOnly(...)`.
