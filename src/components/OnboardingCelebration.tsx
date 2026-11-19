import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Download,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  Lock,
  Fingerprint
} from 'lucide-react';
import { ClientIntake, PracticeProfile } from '../types';

interface OnboardingCelebrationProps {
  practice: PracticeProfile;
  clientName: string;
  clientEmail: string;
  idNumber: string;
  completedIntake: ClientIntake | null;
  sealHash?: string;
  onDownloadReceipt: () => void;
  onBackToDashboard?: () => void;
}

const AURORA_COLORS = ['#00F5D4', '#FF2A85', '#4CC9F0', '#9D4EDD', '#FFE600'];

export function playVerificationChord(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 987.77]; // C5 - E5 - G5 - B5 major 7th shimmer
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.045, now + idx * 0.055 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.7);
    });
  } catch {
    // Audio playback optional; silently ignore if browser restricts Web Audio
  }
}

export const OnboardingCelebration: React.FC<OnboardingCelebrationProps> = ({
  practice,
  clientName,
  clientEmail,
  completedIntake,
  sealHash,
  onDownloadReceipt,
  onBackToDashboard,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [burstCount, setBurstCount] = useState(0);
  const [copiedRef, setCopiedRef] = useState(false);
  const timersRef = useRef<number[]>([]);

  const triggerSpontaneousConfetti = (isReplay = false) => {
    if (prefersReducedMotion) return;
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    try {
      // Cannon 1: Twin angled side cannons
      confetti({
        particleCount: isReplay ? 45 : 60,
        angle: 60,
        spread: 62,
        origin: { x: 0.14, y: 0.68 },
        colors: AURORA_COLORS,
        ticks: 220,
        scalar: 1.05,
      });
      confetti({
        particleCount: isReplay ? 45 : 60,
        angle: 120,
        spread: 62,
        origin: { x: 0.86, y: 0.68 },
        colors: AURORA_COLORS,
        ticks: 220,
        scalar: 1.05,
      });

      // Cannon 2: Center zenith starburst at +220ms
      const t1 = window.setTimeout(() => {
        confetti({
          particleCount: 85,
          spread: 110,
          startVelocity: 44,
          origin: { x: 0.5, y: 0.42 },
          colors: AURORA_COLORS,
          ticks: 250,
          decay: 0.91,
        });
      }, 220);

      // Cannon 3: Overhead diamond twinkle cascade at +520ms
      const t2 = window.setTimeout(() => {
        confetti({
          particleCount: 38,
          spread: 130,
          startVelocity: 24,
          gravity: 0.7,
          origin: { x: 0.5, y: 0.2 },
          colors: ['#00F5D4', '#FFE600', '#4CC9F0'],
          scalar: 0.85,
          ticks: 260,
        });
      }, 520);

      timersRef.current.push(t1, t2);
    } catch {
      // Ignore confetti errors in headless canvas environments
    }
  };

  useEffect(() => {
    triggerSpontaneousConfetti(false);
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSealClick = () => {
    setBurstCount((c) => c + 1);
    playVerificationChord();
    triggerSpontaneousConfetti(true);
  };

  const handleCopyRef = async () => {
    const token = completedIntake?.id || 'ZA-FICA-2026-9912';
    try {
      await navigator.clipboard.writeText(token);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const milestones = [
    { label: 'SA ID Luhn Checksum', detail: 'Verified' },
    { label: '90-Day Recency Audit', detail: 'Passed' },
    { label: 'POPIA Sec 11 Consent', detail: 'Sealed' },
    { label: 'AES-256 Vault Anchor', detail: 'Locked' },
  ];

  const shortHash = sealHash
    ? `${sealHash.slice(0, 10)}...${sealHash.slice(-6)}`
    : 'e3b0c44298...7852b8';

  return (
    <div className="relative p-6 sm:p-9 text-center space-y-6 overflow-hidden">
      {/* Ambient kinetic aurora spotlights behind celebration */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1.05 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gradient-to-tr from-[#00F5D4]/22 via-[#9D4EDD]/24 to-[#FF2A85]/22 blur-3xl"
      />

      {/* Interactive Orbital Holographic Seal */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative inline-flex items-center justify-center">
          {/* Expanding pulse shockwave */}
          {!prefersReducedMotion && (
            <>
              <motion.span
                key={`pulse-a-${burstCount}`}
                initial={{ scale: 0.75, opacity: 0.85 }}
                animate={{ scale: 1.85, opacity: 0 }}
                transition={{ duration: 1.05, ease: 'easeOut' }}
                className="pointer-events-none absolute w-24 h-24 rounded-full border-2 border-[#00F5D4]"
              />
              <motion.span
                key={`pulse-b-${burstCount}`}
                initial={{ scale: 0.75, opacity: 0.7 }}
                animate={{ scale: 2.15, opacity: 0 }}
                transition={{ duration: 1.25, delay: 0.12, ease: 'easeOut' }}
                className="pointer-events-none absolute w-24 h-24 rounded-full border border-[#FF2A85]"
              />
            </>
          )}

          {/* Rotating conic neon prism halo */}
          <motion.button
            type="button"
            onClick={handleSealClick}
            whileHover={{ scale: 1.06, rotate: 2 }}
            whileTap={{ scale: 0.94 }}
            initial={{ scale: 0.35, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
            title="Tap for spontaneous celebration burst"
            aria-label="FICA Verification Sealed — click to replay celebration burst"
            className="relative group w-24 h-24 rounded-[26px] p-[2.5px] bg-gradient-to-tr from-[#00F5D4] via-[#FF2A85] to-[#FFE600] shadow-[0_0_44px_-4px_rgba(0,245,212,0.7)] cursor-pointer focus:outline-none"
          >
            <div className="w-full h-full bg-[#0F0722] rounded-[23px] flex items-center justify-center relative overflow-hidden">
              {/* Shimmer sweep */}
              {!prefersReducedMotion && (
                <motion.div
                  aria-hidden="true"
                  initial={{ x: '-120%' }}
                  animate={{ x: '220%' }}
                  transition={{ duration: 1.4, delay: 0.35, repeat: Infinity, repeatDelay: 3.5 }}
                  className="pointer-events-none absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]"
                />
              )}

              {/* Animated SVG Shield + Kinetic Checkmark */}
              <div className="relative flex items-center justify-center">
                <ShieldCheck className="w-11 h-11 text-[#00F5D4] drop-shadow-[0_0_12px_rgba(0,245,212,0.55)]" />
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 absolute -bottom-1 -right-2 text-[#FFE600]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
                  />
                </svg>
              </div>
            </div>
          </motion.button>
        </div>

        <motion.button
          type="button"
          onClick={handleSealClick}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-200/75 hover:text-[#00F5D4] transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#FFE600]" />
          <span>Tap seal to fire celebration burst</span>
        </motion.button>
      </div>

      {/* Hero Announcement Copy */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.14 }}
        className="relative z-10 space-y-2"
      >
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00F5D4]">
          <CheckCircle2 className="w-4 h-4" />
          <span>FICA Clearance &amp; POPIA Verification Complete</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#00F5D4] to-[#FFE600] bg-clip-text text-transparent">
          Cleared &amp; Officially Onboarded!
        </h1>
        <p className="text-xs sm:text-sm text-purple-200/85 max-w-md mx-auto leading-relaxed">
          Thank you, <strong className="text-white">{clientName || 'Valued Client'}</strong>. Your encrypted compliance dossier is sealed and live with{' '}
          <strong className="text-white">{practice.practiceName}</strong>.
        </p>
      </motion.div>

      {/* Staggered Verification Milestones Strip */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl mx-auto">
        {milestones.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.88, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 340,
              damping: 22,
              delay: 0.25 + idx * 0.09,
            }}
            className="p-2.5 synth-inset rounded-2xl border border-[#00F5D4]/25 text-left"
          >
            <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-[#00F5D4]">
              <span>{item.detail}</span>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            </div>
            <div className="text-[11px] font-semibold text-white mt-0.5 truncate">
              {item.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live Cryptographic Intake Receipt Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="relative z-10 p-4 synth-inset rounded-2xl border border-purple-400/25 text-xs space-y-2.5 max-w-md mx-auto text-left font-mono"
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-purple-400/15">
          <span className="inline-flex items-center gap-1.5 font-sans font-bold text-white">
            <Fingerprint className="w-3.5 h-3.5 text-[#FF2A85]" />
            <span>Verification Credential</span>
          </span>
          <span className="text-[10.5px] text-[#00F5D4] font-bold">
            {new Date(completedIntake?.updatedAt || Date.now()).toLocaleTimeString('en-ZA', {
              hour: '2-digit',
              minute: '2-digit',
            })} SAST
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-purple-300/75 font-sans">Reference Token</span>
          <button
            type="button"
            onClick={handleCopyRef}
            className="inline-flex items-center gap-1.5 font-bold text-white hover:text-[#00F5D4] transition-colors cursor-pointer"
          >
            <span>{completedIntake?.id || 'ZA-FICA-2026-9912'}</span>
            {copiedRef ? (
              <Check className="w-3.5 h-3.5 text-[#00F5D4]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-purple-300/65" />
            )}
          </button>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-purple-300/75 font-sans">FICA Risk Rating</span>
          <span className="font-bold text-[#00F5D4] uppercase">
            {completedIntake?.riskRating || 'low'} (Standard CDD)
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-purple-300/75 font-sans">Client Contact</span>
          <span className="text-purple-100 truncate max-w-[200px]">
            {clientEmail || completedIntake?.clientEmail || 'verified@client.co.za'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-purple-300/75 font-sans inline-flex items-center gap-1">
            <Lock className="w-3 h-3 text-[#4CC9F0]" />
            <span>POPIA Sec 19 Digest</span>
          </span>
          <span className="text-[#4CC9F0] truncate max-w-[180px]">{shortHash}</span>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.6 }}
        className="relative z-10 flex flex-col sm:flex-row gap-3 pt-1 max-w-md mx-auto"
      >
        <button
          type="button"
          onClick={onDownloadReceipt}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-purple-100 synth-inset border border-purple-400/25 hover:border-[#00F5D4]/50 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#00F5D4]" />
          <span>Download Receipt</span>
        </button>

        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-extrabold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] via-[#4CC9F0] to-[#FFE600] hover:opacity-95 shadow-[0_0_24px_-4px_rgba(0,245,212,0.55)] transition-all cursor-pointer whitespace-nowrap"
          >
            <span>View in Practice Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    </div>
  );
};
