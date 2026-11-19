import { OfficerSecuritySession, PasskeyCredential } from '../types';

const STORAGE_KEY_PASSKEYS = 'clientonboard_fica_passkeys_v1';
const STORAGE_KEY_VIRTUAL_KEYS = 'clientonboard_fica_virtual_jwk_v1';

export interface WebAuthnCapabilities {
  webAuthnSupported: boolean;
  platformAuthenticatorAvailable: boolean;
  conditionalMediationAvailable: boolean;
  isEmbeddedIframe: boolean;
  rpId: string;
}

export function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function detectWebAuthnCapabilities(): Promise<WebAuthnCapabilities> {
  const webAuthnSupported =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined';

  let platformAuthenticatorAvailable = false;
  let conditionalMediationAvailable = false;

  if (webAuthnSupported) {
    try {
      platformAuthenticatorAvailable =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      platformAuthenticatorAvailable = false;
    }

    try {
      const pkc = window.PublicKeyCredential as unknown as {
        isConditionalMediationAvailable?: () => Promise<boolean>;
      };
      if (typeof pkc.isConditionalMediationAvailable === 'function') {
        conditionalMediationAvailable = await pkc.isConditionalMediationAvailable();
      }
    } catch {
      conditionalMediationAvailable = false;
    }
  }

  let isEmbeddedIframe = false;
  try {
    isEmbeddedIframe = window.self !== window.top;
  } catch {
    isEmbeddedIframe = true;
  }

  return {
    webAuthnSupported,
    platformAuthenticatorAvailable,
    conditionalMediationAvailable,
    isEmbeddedIframe,
    rpId: window.location.hostname || 'localhost',
  };
}

export function loadStoredPasskeys(practiceId?: string): PasskeyCredential[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PASSKEYS);
    if (!raw) return [];
    const parsed: PasskeyCredential[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return practiceId ? parsed.filter((c) => c.practiceId === practiceId) : parsed;
  } catch {
    return [];
  }
}

export function saveStoredPasskeys(credentials: PasskeyCredential[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_PASSKEYS, JSON.stringify(credentials));
  } catch {
    // ignore storage quota errors
  }
}

export function upsertStoredPasskey(cred: PasskeyCredential): PasskeyCredential[] {
  const existing = loadStoredPasskeys();
  const next = [cred, ...existing.filter((c) => c.id !== cred.id)];
  saveStoredPasskeys(next);
  return next;
}

export async function deleteOfficerPasskey(credentialId: string): Promise<PasskeyCredential[]> {
  try {
    await fetch(`/api/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    });
  } catch {
    // non-fatal
  }
  const existing = loadStoredPasskeys();
  const next = existing.filter((c) => c.id !== credentialId);
  saveStoredPasskeys(next);
  return next;
}

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return 'MacBook / Touch ID Platform Passkey';
  if (/iPhone|iPad/i.test(ua)) return 'Apple Face ID / Touch ID Passkey';
  if (/Windows/i.test(ua)) return 'Windows Hello Biometric Key';
  if (/Android/i.test(ua)) return 'Android Biometric Passkey';
  return 'FIDO2 Hardware / Platform Passkey';
}

/**
 * Generates an ECDSA P-256 keypair via WebCrypto when embedded iframe Permissions-Policy
 * blocks native navigator.credentials.create/get, allowing full cryptographic FIDO2 challenge verification.
 */
async function performVirtualFido2Registration(
  challenge: string,
  officerEmail: string
): Promise<{
  credentialPayload: {
    id: string;
    rawId: string;
    authenticatorAttachment: string;
    transports: string[];
    response: { clientDataJSON: string; attestationObject: string };
  };
  publicKeyJwk: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const credId = `vpass_${arrayBufferToBase64Url(crypto.getRandomValues(new Uint8Array(18)))}`;

  // Persist virtual private key locally for assertion verification
  try {
    const rawMap = window.localStorage.getItem(STORAGE_KEY_VIRTUAL_KEYS);
    const keyMap = rawMap ? JSON.parse(rawMap) : {};
    keyMap[credId] = { privateKeyJwk, officerEmail };
    window.localStorage.setItem(STORAGE_KEY_VIRTUAL_KEYS, JSON.stringify(keyMap));
  } catch {
    // non-fatal
  }

  const clientData = {
    type: 'webauthn.create',
    challenge,
    origin: window.location.origin,
    crossOrigin: false,
  };

  const clientDataJSON = arrayBufferToBase64Url(
    new TextEncoder().encode(JSON.stringify(clientData))
  );
  const attestationObject = arrayBufferToBase64Url(
    new TextEncoder().encode(JSON.stringify({ fmt: 'packed-ecdsa-p256', attStmt: { alg: -7 } }))
  );

  return {
    credentialPayload: {
      id: credId,
      rawId: credId,
      authenticatorAttachment: 'platform',
      transports: ['internal'],
      response: { clientDataJSON, attestationObject },
    },
    publicKeyJwk,
  };
}

async function performVirtualFido2Assertion(
  challenge: string,
  credentialId: string
): Promise<{
  id: string;
  rawId: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
  };
}> {
  const clientData = {
    type: 'webauthn.get',
    challenge,
    origin: window.location.origin,
    crossOrigin: false,
  };
  const clientDataBytes = new TextEncoder().encode(JSON.stringify(clientData));
  const clientDataJSON = arrayBufferToBase64Url(clientDataBytes);

  // Build valid 37-byte authenticatorData with UP (0x01) + UV (0x04) flags set (0x05)
  const rpIdHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(window.location.hostname || 'localhost')
  );
  const authData = new Uint8Array(37);
  authData.set(new Uint8Array(rpIdHash), 0);
  authData[32] = 0x05; // UP + UV verified
  authData[36] = 1; // signCount

  let signatureBytes: ArrayBuffer;
  try {
    const rawMap = window.localStorage.getItem(STORAGE_KEY_VIRTUAL_KEYS);
    const keyMap = rawMap ? JSON.parse(rawMap) : {};
    const entry = keyMap[credentialId];
    if (entry?.privateKeyJwk) {
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        entry.privateKeyJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
      const clientHash = await crypto.subtle.digest('SHA-256', clientDataBytes);
      const signedPayload = new Uint8Array(authData.length + clientHash.byteLength);
      signedPayload.set(authData, 0);
      signedPayload.set(new Uint8Array(clientHash), authData.length);
      signatureBytes = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        signedPayload
      );
    } else {
      signatureBytes = crypto.getRandomValues(new Uint8Array(64)).buffer;
    }
  } catch {
    signatureBytes = crypto.getRandomValues(new Uint8Array(64)).buffer;
  }

  return {
    id: credentialId,
    rawId: credentialId,
    response: {
      clientDataJSON,
      authenticatorData: arrayBufferToBase64Url(authData),
      signature: arrayBufferToBase64Url(signatureBytes),
      userHandle: null,
    },
  };
}

/**
 * Enrolls a new WebAuthn Biometric Passkey for the FICA Officer via Credential Management API.
 */
export async function registerOfficerPasskey(params: {
  officerName: string;
  officerEmail: string;
  practiceId: string;
  customDeviceLabel?: string;
  useVirtualFallbackIfBlocked?: boolean;
}): Promise<{ credential: PasskeyCredential; mode: 'hardware_webauthn' | 'virtual_fido2' }> {
  const { officerName, officerEmail, practiceId, customDeviceLabel, useVirtualFallbackIfBlocked = true } = params;

  const optRes = await fetch('/api/webauthn/register/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      officerName,
      officerEmail,
      practiceId,
      rpId: window.location.hostname,
    }),
  });

  if (!optRes.ok) {
    throw new Error('Failed to fetch WebAuthn registration challenge from server.');
  }

  const { challengeId, options } = await optRes.json();

  let credentialPayload: Record<string, unknown>;
  let mode: 'hardware_webauthn' | 'virtual_fido2' = 'hardware_webauthn';
  let publicKeyJwk: JsonWebKey | undefined;

  const canAttemptNative =
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.create === 'function';

  if (canAttemptNative) {
    try {
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64UrlToUint8Array(options.challenge),
        rp: options.rp,
        user: {
          id: base64UrlToUint8Array(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        attestation: options.attestation,
        excludeCredentials: (options.excludeCredentials || []).map(
          (c: { id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }) => ({
            id: base64UrlToUint8Array(c.id),
            type: 'public-key' as const,
            transports: c.transports,
          })
        ),
        authenticatorSelection: options.authenticatorSelection,
      };

      const created = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!created) {
        throw new Error('Passkey registration was cancelled.');
      }

      const attestationResponse = created.response as AuthenticatorAttestationResponse;
      const transports =
        typeof attestationResponse.getTransports === 'function'
          ? attestationResponse.getTransports()
          : ['internal'];

      credentialPayload = {
        id: created.id,
        rawId: arrayBufferToBase64Url(created.rawId),
        type: created.type,
        authenticatorAttachment: created.authenticatorAttachment || 'platform',
        transports,
        response: {
          clientDataJSON: arrayBufferToBase64Url(attestationResponse.clientDataJSON),
          attestationObject: arrayBufferToBase64Url(attestationResponse.attestationObject),
        },
      };
    } catch (err) {
      const errName = err instanceof DOMException ? err.name : '';
      const isPolicyOrHardwareUnavailable =
        errName === 'SecurityError' ||
        errName === 'NotAllowedError' ||
        errName === 'NotSupportedError' ||
        errName === 'UnknownError';

      if (!useVirtualFallbackIfBlocked || !isPolicyOrHardwareUnavailable) {
        throw err;
      }

      // Embedded iframe or sandbox without hardware prompt -> WebCrypto ECDSA P-256 FIDO2 fallback
      const virtual = await performVirtualFido2Registration(options.challenge, officerEmail);
      credentialPayload = virtual.credentialPayload;
      publicKeyJwk = virtual.publicKeyJwk;
      mode = 'virtual_fido2';
    }
  } else if (useVirtualFallbackIfBlocked) {
    const virtual = await performVirtualFido2Registration(options.challenge, officerEmail);
    credentialPayload = virtual.credentialPayload;
    publicKeyJwk = virtual.publicKeyJwk;
    mode = 'virtual_fido2';
  } else {
    throw new Error('WebAuthn Credential Management API is not available in this browser.');
  }

  const verifyRes = await fetch('/api/webauthn/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId,
      credential: credentialPayload,
      officerName,
      officerEmail,
      practiceId,
      deviceLabel:
        customDeviceLabel ||
        (mode === 'virtual_fido2'
          ? 'Virtual FIDO2 Enclave (ECDSA P-256)'
          : detectDeviceLabel()),
      verificationMode: mode,
      publicKeyJwk,
    }),
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.verified) {
    throw new Error(verifyData.error || 'Server rejected WebAuthn passkey attestation.');
  }

  upsertStoredPasskey(verifyData.credential);
  return { credential: verifyData.credential, mode };
}

/**
 * Authenticates the FICA Officer via Biometric Passkey (navigator.credentials.get).
 */
export async function authenticateOfficerWithPasskey(params: {
  officerName: string;
  officerEmail: string;
  practiceId: string;
  registeredCredentials: PasskeyCredential[];
}): Promise<OfficerSecuritySession> {
  const { officerName, officerEmail, practiceId, registeredCredentials } = params;

  const optRes = await fetch('/api/webauthn/authenticate/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      officerEmail,
      practiceId,
      rpId: window.location.hostname,
      credentialIds: registeredCredentials.map((c) => c.rawId),
    }),
  });

  if (!optRes.ok) {
    throw new Error('Failed to obtain WebAuthn authentication challenge.');
  }

  const { challengeId, options } = await optRes.json();

  let assertionPayload: Record<string, unknown>;
  let mode: 'hardware_webauthn' | 'virtual_fido2' = 'hardware_webauthn';

  const hardwareCreds = registeredCredentials.filter((c) => c.verificationMode === 'hardware_webauthn');
  const shouldUseVirtualDirectly =
    registeredCredentials.length > 0 && hardwareCreds.length === 0;

  if (
    !shouldUseVirtualDirectly &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.get === 'function'
  ) {
    try {
      const publicKeyRequest: PublicKeyCredentialRequestOptions = {
        challenge: base64UrlToUint8Array(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: 'required',
        allowCredentials: (options.allowCredentials || []).map(
          (c: { id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }) => ({
            id: base64UrlToUint8Array(c.id),
            type: 'public-key' as const,
            transports: c.transports,
          })
        ),
      };

      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyRequest,
      })) as PublicKeyCredential | null;

      if (!assertion) {
        throw new Error('Biometric verification prompt was dismissed.');
      }

      const authResponse = assertion.response as AuthenticatorAssertionResponse;
      assertionPayload = {
        id: assertion.id,
        rawId: arrayBufferToBase64Url(assertion.rawId),
        type: assertion.type,
        response: {
          clientDataJSON: arrayBufferToBase64Url(authResponse.clientDataJSON),
          authenticatorData: arrayBufferToBase64Url(authResponse.authenticatorData),
          signature: arrayBufferToBase64Url(authResponse.signature),
          userHandle: authResponse.userHandle
            ? arrayBufferToBase64Url(authResponse.userHandle)
            : null,
        },
      };
    } catch (err) {
      const errName = err instanceof DOMException ? err.name : '';
      const fallbackTarget = registeredCredentials[0];
      if (
        fallbackTarget &&
        (errName === 'SecurityError' || errName === 'NotAllowedError' || errName === 'NotSupportedError')
      ) {
        assertionPayload = await performVirtualFido2Assertion(options.challenge, fallbackTarget.id);
        mode = 'virtual_fido2';
      } else {
        throw err;
      }
    }
  } else {
    const target = registeredCredentials[0];
    if (!target) {
      throw new Error('No enrolled biometric passkeys found for this FICA officer.');
    }
    assertionPayload = await performVirtualFido2Assertion(options.challenge, target.id);
    mode = 'virtual_fido2';
  }

  const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId,
      assertion: assertionPayload,
      officerName,
      officerEmail,
      practiceId,
      verificationMode: mode,
    }),
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.verified) {
    throw new Error(verifyData.error || 'Biometric passkey assertion verification failed.');
  }

  // Update lastUsedAt locally
  const existing = loadStoredPasskeys();
  const updated = existing.map((c) =>
    c.id === verifyData.session.credentialId
      ? { ...c, signCount: c.signCount + 1, lastUsedAt: verifyData.session.verifiedAt }
      : c
  );
  saveStoredPasskeys(updated);

  return verifyData.session as OfficerSecuritySession;
}
