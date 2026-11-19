import React, { useState } from 'react';
import { 
  ShieldCheck, 
  BarChart3, 
  Smartphone, 
  Building2, 
  KeyRound, 
  LogOut, 
  LogIn,
  CheckCircle2,
  ChevronDown,
  Fingerprint
} from 'lucide-react';
import { OfficerSecuritySession, PracticeProfile } from '../types';
import { User } from 'firebase/auth';

interface NavbarProps {
  currentView: 'dashboard' | 'intake' | 'analytics' | 'audit';
  onSelectView: (view: 'dashboard' | 'intake' | 'analytics' | 'audit') => void;
  practices: PracticeProfile[];
  activePractice: PracticeProfile;
  onSelectPractice: (practice: PracticeProfile) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenMagicModal: () => void;
  securitySession: OfficerSecuritySession | null;
  onOpenPasskeyModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  practices,
  activePractice,
  onSelectPractice,
  user,
  onLogin,
  onLogout,
  onOpenMagicModal,
  securitySession,
  onOpenPasskeyModal,
}) => {
  const [practiceDropdownOpen, setPracticeDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#120826]/85 backdrop-blur-xl border-b border-purple-400/20 shadow-[0_12px_36px_-10px_rgba(4,0,18,0.9)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">
          
          {/* Zone 1: Brand Wordmark */}
          <button
            onClick={() => onSelectView('dashboard')}
            className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF2A85] via-[#9D4EDD] to-[#00F5D4] p-[1.5px] shadow-[0_0_20px_-4px_rgba(255,42,133,0.6)] group-hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full bg-[#130829] rounded-[10px] flex items-center justify-center">
                <span className="text-lg select-none" role="img" aria-label="magnet">🧲</span>
              </div>
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
              ClientOnboard
              <span className="bg-gradient-to-r from-[#FF2A85] via-[#FFE600] to-[#00F5D4] bg-clip-text text-transparent ml-0.5">
                AI
              </span>
            </span>
          </button>

          {/* Zone 2: Single-line Navigation Links */}
          <nav className="hidden md:flex items-center gap-5">
            <button
              onClick={() => onSelectView('dashboard')}
              className={`flex items-center gap-1.5 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'dashboard'
                  ? 'border-[#00F5D4] text-white'
                  : 'border-transparent text-purple-200/75 hover:text-white hover:border-purple-400/40'
              }`}
            >
              <Building2 className={`w-4 h-4 ${currentView === 'dashboard' ? 'text-[#00F5D4]' : 'text-purple-300/70'}`} />
              <span>Practice Studio</span>
            </button>

            <button
              onClick={() => onSelectView('intake')}
              className={`flex items-center gap-1.5 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'intake'
                  ? 'border-[#FF2A85] text-white'
                  : 'border-transparent text-purple-200/75 hover:text-white hover:border-purple-400/40'
              }`}
            >
              <Smartphone className={`w-4 h-4 ${currentView === 'intake' ? 'text-[#FF2A85]' : 'text-purple-300/70'}`} />
              <span>Client Portal</span>
            </button>

            <button
              onClick={() => onSelectView('analytics')}
              className={`flex items-center gap-1.5 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'analytics'
                  ? 'border-[#FF6B35] text-white'
                  : 'border-transparent text-purple-200/75 hover:text-white hover:border-purple-400/40'
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${currentView === 'analytics' ? 'text-[#FF6B35]' : 'text-purple-300/70'}`} />
              <span>Funnel Telemetry</span>
            </button>

            <button
              onClick={() => onSelectView('audit')}
              className={`flex items-center gap-1.5 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'audit'
                  ? 'border-[#FFE600] text-white'
                  : 'border-transparent text-purple-200/75 hover:text-white hover:border-purple-400/40'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${currentView === 'audit' ? 'text-[#FFE600]' : 'text-purple-300/70'}`} />
              <span>Audit Ledger</span>
            </button>
          </nav>

          {/* Zone 3: Practice Switcher, Biometric Passkey Auth & Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Multi-Practice Switcher */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setPracticeDropdownOpen(!practiceDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-100 synth-inset rounded-xl hover:border-purple-300/40 transition-colors cursor-pointer whitespace-nowrap"
                title="Switch active South African practice"
              >
                <span className="max-w-[140px] truncate font-semibold">
                  {activePractice.practiceName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-purple-300/70 shrink-0" />
              </button>

              {practiceDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-72 synth-glass rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onMouseLeave={() => setPracticeDropdownOpen(false)}
                >
                  <div className="px-3.5 py-1.5 border-b border-purple-400/15">
                    <p className="text-[11px] font-semibold text-purple-300/70">
                      Switch South African Practice
                    </p>
                  </div>
                  {practices.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectPractice(p);
                        setPracticeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs flex items-start gap-2.5 hover:bg-white/10 transition-colors cursor-pointer ${
                        activePractice.id === p.id ? 'bg-purple-500/20 font-semibold text-white' : 'text-purple-200'
                      }`}
                    >
                      <Building2 className={`w-4 h-4 shrink-0 mt-0.5 ${activePractice.id === p.id ? 'text-[#00F5D4]' : 'text-purple-400/70'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate font-semibold">{p.practiceName}</p>
                          {activePractice.id === p.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#00F5D4] shrink-0 ml-1" />}
                        </div>
                        <p className="text-[11px] text-purple-300/70 truncate">
                          {p.professionType === 'law_firm' ? 'Attorneys & Notaries' : p.professionType === 'accounting_firm' ? 'Chartered Accountants' : 'Consultants'} · {p.city}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* WebAuthn Officer Biometric Passkey Trigger */}
            <button
              onClick={onOpenPasskeyModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer border ${
                securitySession?.verified
                  ? 'bg-[#00F5D4]/15 border-[#00F5D4]/50 text-[#99FFF1] shadow-[0_0_20px_-4px_rgba(0,245,212,0.5)]'
                  : 'bg-purple-500/15 border-purple-400/30 text-purple-100 hover:bg-purple-500/25 hover:border-purple-300/50'
              }`}
              title="WebAuthn / Biometric Passkey Authentication for FICA Officers"
            >
              <Fingerprint className={`w-3.5 h-3.5 ${securitySession?.verified ? 'text-[#00F5D4]' : 'text-[#FFE600]'}`} />
              <span className="hidden sm:inline">
                {securitySession?.verified ? 'Biometric AAL3' : 'Officer Passkey'}
              </span>
            </button>

            {/* Primary CTA: Magic Link Playground */}
            <button
              onClick={onOpenMagicModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] rounded-xl shadow-[0_0_22px_-4px_rgba(255,42,133,0.65)] hover:opacity-95 active:scale-95 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#0B0518]" />
              <span className="hidden sm:inline">Magic Link</span>
            </button>

            {/* Firebase Google Auth */}
            {user ? (
              <div className="flex items-center gap-2 pl-1.5 border-l border-purple-400/20">
                <div
                  className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-xl synth-inset text-xs"
                  title={`Signed in as ${user.email || user.displayName || 'Officer'}`}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Officer'}
                      className="w-5 h-5 rounded-full object-cover border border-[#00F5D4]/60"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#00F5D4] to-[#9D4EDD] text-[#0B0518] font-bold text-[10px] flex items-center justify-center">
                      {(user.displayName || user.email || 'O').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[115px] truncate font-medium text-purple-100">
                    {user.displayName || user.email}
                  </span>
                </div>

                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  title={`Signed in as ${user.email}. Click to sign out.`}
                >
                  <LogOut className="w-3.5 h-3.5 text-[#FF2A85]" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-200/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                title="Google sign-in for practice administrators"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-purple-400/15 px-2 py-1.5 bg-[#0E061E]/90">
        <button
          onClick={() => onSelectView('dashboard')}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap ${
            currentView === 'dashboard' ? 'text-[#00F5D4] bg-white/10' : 'text-purple-200/75'
          }`}
        >
          Practice
        </button>
        <button
          onClick={() => onSelectView('intake')}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap ${
            currentView === 'intake' ? 'text-[#FF2A85] bg-white/10' : 'text-purple-200/75'
          }`}
        >
          Client Portal
        </button>
        <button
          onClick={() => onSelectView('analytics')}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap ${
            currentView === 'analytics' ? 'text-[#FF6B35] bg-white/10' : 'text-purple-200/75'
          }`}
        >
          Telemetry
        </button>
        <button
          onClick={() => onSelectView('audit')}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap ${
            currentView === 'audit' ? 'text-[#FFE600] bg-white/10' : 'text-purple-200/75'
          }`}
        >
          Audit
        </button>
      </div>
    </header>
  );
};
