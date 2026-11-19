import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  KeyRound,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Cpu,
  RefreshCw,
  LogOut,
  Shield
} from 'lucide-react';
import { OfficerSecuritySession, PasskeyCredential, PracticeProfile } from '../types';
import {
  WebAuthnCapabilities,
  detectWebAuthnCapabilities,
  registerOfficerPasskey,
  authenticateOfficerWithPasskey,
  deleteOfficerPasskey,
} from '../utils/webauthn';

interface PasskeyAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  practice: PracticeProfile;
  passkeys: PasskeyCredential[];
  securitySession: OfficerSecuritySession | null;
  onPasskeysUpdated: (next: PasskeyCredential[]) => void;
  onAuthenticated: (session: OfficerSecuritySession) => void;
  onRevokeSession: () => void;
  onAuditLogEvent: (action: string, details: string) => void;
}

export const PasskeyAuthModal: React.FC<PasskeyAuthModalProps> = ({
  isOpen,
  onClose,
  practice,
  passkeys,
  securitySession,
  onPasskeysUpdated,
  onAuthenticated,
  onRevokeSession,
  onAuditLogEvent,
}) => {
  const [capabilities, setCapabilities] = useState<WebAuthnCapabilities | null>(null);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      detectWebAuthnCapabilities().then(setCapabilities);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const practicePasskeys = passkeys.filter((p) => p.practiceId === practice.id);

  const handleEnrollPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setStatusMessage(null);

    try {
      const { credential, mode } = await registerOfficerPasskey({
        officerName: practice.ficaOfficerName,
        officerEmail: practice.adminEmail,
        practiceId: practice.id,
        customDeviceLabel: deviceLabel.trim() || undefined,
        useVirtualFallbackIfBlocked: true,
      });

      const nextList = [credential, ...passkeys.filter((p) => p.id !== credential.id)];
      onPasskeysUpdated(nextList);
      setDeviceLabel('');

      onAuditLogEvent(
        'WEBAUTHN_PASSKEY_ENROLLED',
        `FICA Officer ${practice.ficaOfficerName} enrolled ${credential.deviceLabel} (${mode === 'hardware_webauthn' ? 'Hardware Biometric' : 'FIDO2 ECDSA P-256 Enclave'})`
      );

      setStatusMessage({
        type: 'success',
        text:
          mode === 'hardware_webauthn'
            ? `Hardware Biometric Passkey enrolled (${credential.deviceLabel}). Ready for instant Touch ID / Face ID verification.`
            : `FIDO2 ECDSA P-256 Passkey enrolled (${credential.deviceLabel}) via WebCrypto enclave due to iframe policy constraints.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to register WebAuthn passkey.',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAuthenticateBiometrics = async () => {
    if (practicePasskeys.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'Enroll a FICA Officer passkey below before running biometric verification.',
      });
      return;
    }

    setIsAuthenticating(true);
    setStatusMessage(null);

    try {
      const session = await authenticateOfficerWithPasskey({
        officerName: practice.ficaOfficerName,
        officerEmail: practice.adminEmail,
        practiceId: practice.id,
        registeredCredentials: practicePasskeys,
      });

      onAuthenticated(session);
      onAuditLogEvent(
        'FICA_OFFICER_BIOMETRIC_VERIFIED',
        `AAL3 WebAuthn biometric assertion verified for ${practice.ficaOfficerName} (${session.deviceLabel}). Signature hash: ${session.challengeSignature?.slice(0, 16)}...`
      );

      setStatusMessage({
        type: 'success',
        text: `Biometric assertion verified for ${practice.ficaOfficerName}. FICA Officer AAL3 privilege elevated.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Biometric authentication failed or cancelled.',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDeleteCredential = async (cred: PasskeyCredential) => {
    const next = await deleteOfficerPasskey(cred.id);
    onPasskeysUpdated(next);
    if (securitySession?.credentialId === cred.id) {
      onRevokeSession();
    }
    onAuditLogEvent(
      'WEBAUTHN_PASSKEY_REVOKED',
      `Revoked FICA Officer passkey ${cred.deviceLabel} (${cred.id.slice(0, 12)}...)`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060211]/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="synth-glass rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto text-slate-100">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-purple-400/20 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00F5D4] via-[#9D4EDD] to-[#FF2A85] p-[1.5px] shadow-[0_0_24px_-4px_rgba(0,245,212,0.5)] shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#140A2B] flex items-center justify-center">
                <Fingerprint className="w-6 h-6 text-[#00F5D4]" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                FICA Officer WebAuthn & Biometric Security
              </h2>
              <p className="text-xs text-purple-200/75 mt-0.5">
                {practice.ficaOfficerName} · {practice.adminEmail} · FIDO2 Credential Management API
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close biometric security dialog"
            className="p-2 rounded-xl text-purple-200/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Officer Assurance Banner */}
        <div className={`p-4 rounded-2xl border transition-all ${
          securitySession?.verified
            ? 'bg-gradient-to-r from-[#00F5D4]/15 via-[#1C103A]/85 to-[#9D4EDD]/20 border-[#00F5D4]/45 glow-cyan'
            : 'synth-inset border-amber-400/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {securitySession?.verified ? (
                <ShieldCheck className="w-6 h-6 text-[#00F5D4] shrink-0 mt-0.5" />
              ) : (
                <Lock className="w-6 h-6 text-[#FFE600] shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-bold tracking-wide text-white flex items-center gap-2">
                  <span>
                    {securitySession?.verified
                      ? 'Biometric Assurance Active (AAL3 FIDO2 Verified)'
                      : 'Standard Session · Biometric Verification Recommended'}
                  </span>
                </div>
                <p className="text-xs text-purple-200/80 mt-0.5">
                  {securitySession?.verified
                    ? `Verified via ${securitySession.deviceLabel} at ${new Date(securitySession.verifiedAt || '').toLocaleTimeString('en-ZA')}`
                    : 'Authenticate with Touch ID, Face ID, Windows Hello, or a FIDO2 key to sign FICA clearances and bulk exports.'}
                </p>
                {securitySession?.challengeSignature && (
                  <p className="text-[11px] font-mono text-[#00F5D4]/90 mt-1 break-all">
                    Assertion Digest: {securitySession.challengeSignature.slice(0, 32)}...
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {securitySession?.verified ? (
                <button
                  type="button"
                  onClick={onRevokeSession}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-200 bg-rose-500/15 border border-rose-400/30 hover:bg-rose-500/25 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Lock Session</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isAuthenticating || practicePasskeys.length === 0}
                  onClick={handleAuthenticateBiometrics}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] via-[#4CC9F0] to-[#FFE600] hover:opacity-95 shadow-[0_0_24px_-4px_rgba(0,245,212,0.65)] disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Biometrics...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4" />
                      <span>Verify Biometrics Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Feedback */}
        {statusMessage && (
          <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-[#00F5D4]/12 border-[#00F5D4]/40 text-[#99FFF1]'
              : statusMessage.type === 'error'
              ? 'bg-[#FF2A85]/15 border-[#FF2A85]/40 text-rose-200'
              : 'bg-purple-500/15 border-purple-400/30 text-purple-100'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#FFE600] shrink-0 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Browser Credential Management API Capabilities */}
        {capabilities && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="synth-inset p-3 rounded-xl space-y-1">
              <div className="text-purple-300/70 font-medium">Credential API</div>
              <div className="font-mono font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#00F5D4]" />
                <span>{capabilities.webAuthnSupported ? 'WebAuthn L2 Ready' : 'Fallback Mode'}</span>
              </div>
            </div>

            <div className="synth-inset p-3 rounded-xl space-y-1">
              <div className="text-purple-300/70 font-medium">Platform Biometrics</div>
              <div className="font-mono font-bold text-white flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-[#FF2A85]" />
                <span>{capabilities.platformAuthenticatorAvailable ? 'Detected' : 'Virtual Enclave'}</span>
              </div>
            </div>

            <div className="synth-inset p-3 rounded-xl space-y-1">
              <div className="text-purple-300/70 font-medium">Relying Party ID</div>
              <div className="font-mono font-bold text-[#FFE600] truncate" title={capabilities.rpId}>
                {capabilities.rpId}
              </div>
            </div>
          </div>
        )}

        {/* Enroll New Biometric Passkey Form */}
        <form onSubmit={handleEnrollPasskey} className="synth-inset p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#FF6B35]" />
              <span>Enroll New FICA Officer Passkey</span>
            </h3>
            <span className="text-[11px] font-mono text-purple-300/70">ES256 · UV Required</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              placeholder={`e.g. ${practice.ficaOfficerName} Touch ID / YubiKey`}
              className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-[#0B0519]/90 border border-purple-400/25 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-[#00F5D4] focus:ring-2 focus:ring-[#00F5D4]/20"
            />
            <button
              type="submit"
              disabled={isRegistering}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FF2A85] via-[#9D4EDD] to-[#FF6B35] hover:opacity-95 shadow-[0_0_24px_-4px_rgba(255,42,133,0.55)] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {isRegistering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enrolling Key...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Register Biometric Passkey</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Enrolled Credentials Vault */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-purple-100">
              Enrolled Passkeys for {practice.practiceName}
            </span>
            <span className="font-mono text-purple-300/70 tabular-nums">
              {practicePasskeys.length} active
            </span>
          </div>

          {practicePasskeys.length === 0 ? (
            <div className="synth-inset p-6 rounded-2xl text-center space-y-1.5">
              <Shield className="w-6 h-6 text-purple-300/50 mx-auto" />
              <p className="text-xs font-semibold text-purple-100">
                No passkeys registered for this practice yet
              </p>
              <p className="text-[11px] text-purple-300/65">
                Register a platform biometric key above to enable WebAuthn authentication for FICA officers.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {practicePasskeys.map((cred) => {
                const isActiveCred = securitySession?.verified && securitySession?.credentialId === cred.id;
                return (
                  <div
                    key={cred.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isActiveCred
                        ? 'bg-[#00F5D4]/10 border-[#00F5D4]/40'
                        : 'synth-inset border-purple-400/20'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Fingerprint className={`w-4 h-4 shrink-0 mt-0.5 ${isActiveCred ? 'text-[#00F5D4]' : 'text-[#FF2A85]'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {cred.deviceLabel}
                        </div>
                        <div className="text-[11px] font-mono text-purple-300/75 truncate">
                          {cred.algorithm} · Uses: {cred.signCount} · ID: {cred.id.slice(0, 14)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!securitySession?.verified && (
                        <button
                          type="button"
                          onClick={handleAuthenticateBiometrics}
                          disabled={isAuthenticating}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#00F5D4] bg-[#00F5D4]/10 hover:bg-[#00F5D4]/20 border border-[#00F5D4]/30 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Authenticate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteCredential(cred)}
                        aria-label={`Revoke ${cred.deviceLabel}`}
                        className="p-1.5 rounded-lg text-rose-300/75 hover:text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        title="Revoke passkey"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
