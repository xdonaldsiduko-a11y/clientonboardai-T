import React from 'react';
import {
  ShieldCheck,
  Database,
  Fingerprint,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AuthProviderType } from '../contexts/FirebaseContext';

interface AuthGateScreenProps {
  mode: 'loading' | 'seeding' | 'signin';
  isSigningIn?: boolean;
  signingInProvider?: AuthProviderType | null;
  error?: string | null;
  onSignInWithGoogle: () => void;
  onSignInWithApple: () => void;
}

const GoogleMark: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#0B0518"
      d="M21.8 12.23c0-.72-.06-1.41-.18-2.08H12v3.94h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.5Z"
    />
    <path
      fill="#0B0518"
      d="M12 22c2.75 0 5.06-.91 6.75-2.47l-3.3-2.56c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.89v2.64A10 10 0 0 0 12 22Z"
    />
    <path
      fill="#0B0518"
      d="M6.3 13.75a6 6 0 0 1 0-3.5V7.61H2.89a10 10 0 0 0 0 8.78l3.41-2.64Z"
    />
    <path
      fill="#0B0518"
      d="M12 6.05c1.5 0 2.84.51 3.9 1.52l2.92-2.92C17.05 3.01 14.74 2 12 2A10 10 0 0 0 2.89 7.61l3.41 2.64c.8-2.41 3.05-4.2 5.7-4.2Z"
    />
  </svg>
);

const AppleMark: React.FC = () => (
  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43Zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45Z" />
  </svg>
);

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  mode,
  isSigningIn = false,
  signingInProvider = null,
  error,
  onSignInWithGoogle,
  onSignInWithApple,
}) => {
  const isGoogleLoading = signingInProvider === 'google' || (isSigningIn && signingInProvider === null);
  const isAppleLoading = signingInProvider === 'apple';

  return (
    <div className="min-h-screen aurora-canvas text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative Aurora Orbs */}
      <div className="absolute -left-24 top-12 w-80 h-80 rounded-full bg-[#FF2A85]/18 blur-3xl pointer-events-none" />
      <div className="absolute -right-24 bottom-12 w-80 h-80 rounded-full bg-[#00F5D4]/15 blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg synth-glass glow-violet rounded-3xl p-7 sm:p-9 relative z-10 space-y-7">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF2A85] via-[#9D4EDD] to-[#00F5D4] p-[2px] shadow-[0_0_32px_-4px_rgba(255,42,133,0.65)]">
            <div className="w-full h-full bg-[#130829] rounded-[14px] flex items-center justify-center relative">
              <span className="text-3xl select-none" role="img" aria-label="magnet">🧲</span>
              <Sparkles className="w-4 h-4 text-[#FFE600] absolute top-1.5 right-1.5" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ClientOnboard
            <span className="bg-gradient-to-r from-[#FF2A85] via-[#FFE600] to-[#00F5D4] bg-clip-text text-transparent ml-1">
              AI
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-purple-200/80 max-w-md mx-auto leading-relaxed">
            South African FICA &amp; POPIA Compliance Portal · Encrypted client intakes, document verification &amp; immutable audit ledgers.
          </p>
        </div>

        {(mode === 'loading' || mode === 'seeding') ? (
          <div className="p-6 synth-inset rounded-2xl text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-[#00F5D4] animate-spin mx-auto" />
            <div className="text-sm font-bold text-white">
              {mode === 'loading'
                ? 'Verifying Encrypted Firebase Session...'
                : 'Provisioning Practice Vault & Compliance Ledger...'}
            </div>
            <p className="text-xs text-purple-200/70">
              Connecting to Cloud Firestore (ai-studio-clientonboardai) with strict POPIA tenant isolation.
            </p>
          </div>
        ) : (
          <>
            {/* Security & Persistence Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 synth-inset rounded-2xl flex items-start gap-2.5">
                <Database className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Cloud Firestore Vault</div>
                  <p className="text-[11px] text-purple-200/70 mt-0.5">
                    Real-time multi-practice sync &amp; immutable POPIA Section 19 ledger.
                  </p>
                </div>
              </div>

              <div className="p-3.5 synth-inset rounded-2xl flex items-start gap-2.5">
                <Fingerprint className="w-4 h-4 text-[#FF2A85] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Tenant-Isolated Auth</div>
                  <p className="text-[11px] text-purple-200/70 mt-0.5">
                    Google &amp; Apple Sign-In plus optional FIDO2 WebAuthn elevation.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-[#FF2A85]/15 border border-[#FF2A85]/50 text-xs text-rose-100 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#FF2A85] shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Authentication Providers */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={onSignInWithGoogle}
                disabled={isSigningIn}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] text-[#0B0518] font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-[0_0_28px_-4px_rgba(255,42,133,0.7)] hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authenticating via Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleMark />
                    <span>Sign In with Google</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-purple-400/20" />
                <span className="text-[11px] font-medium text-purple-200/60">or continue with Apple ID</span>
                <div className="h-px flex-1 bg-purple-400/20" />
              </div>

              <button
                type="button"
                onClick={onSignInWithApple}
                disabled={isSigningIn}
                className="w-full h-12 rounded-2xl synth-inset border border-purple-300/30 hover:border-[#00F5D4]/65 hover:bg-white/[0.06] text-white font-bold text-sm flex items-center justify-center gap-2.5 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {isAppleLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-[#00F5D4] animate-spin" />
                    <span>Authenticating via Apple...</span>
                  </>
                ) : (
                  <>
                    <AppleMark />
                    <span>Continue with Apple</span>
                    <ArrowRight className="w-4 h-4 text-[#00F5D4]" />
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-purple-200/70 pt-2 border-t border-purple-400/15">
              <ShieldCheck className="w-4 h-4 text-[#00F5D4] shrink-0" />
              <span>FICA Act 38 of 2001 &amp; POPIA Act 4 of 2013 Safeguards Enforced</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
