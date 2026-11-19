import React from 'react';
import { 
  BarChart3, 
  Smartphone, 
  Monitor, 
  Tablet, 
  AlertTriangle,
  ArrowDownRight,
  Radio
} from 'lucide-react';
import { PracticeProfile, FunnelStageMetric } from '../types';

interface FunnelAnalyticsProps {
  practice: PracticeProfile;
}

export const FunnelAnalytics: React.FC<FunnelAnalyticsProps> = ({ practice }) => {
  const funnelStages: FunnelStageMetric[] = [
    { step: 1, name: 'Magic Link Invited', eventKey: 'funnel_magic_link_requested', count: 142, conversionRate: 100, dropOffRate: 0, avgTimeSeconds: 15 },
    { step: 2, name: 'Magic Link Verified', eventKey: 'funnel_magic_link_verified', count: 136, conversionRate: 95.7, dropOffRate: 4.3, avgTimeSeconds: 45 },
    { step: 3, name: 'POPIA Section 11 Consent', eventKey: 'funnel_popia_consent_signed', count: 132, conversionRate: 93.0, dropOffRate: 2.7, avgTimeSeconds: 60 },
    { step: 4, name: 'Client & Entity Profile', eventKey: 'funnel_entity_profile_completed', count: 128, conversionRate: 90.1, dropOffRate: 2.9, avgTimeSeconds: 110 },
    { step: 5, name: 'SA ID / Passport Upload', eventKey: 'funnel_id_document_uploaded', count: 124, conversionRate: 87.3, dropOffRate: 2.8, avgTimeSeconds: 140 },
    { step: 6, name: 'Proof of Address Upload', eventKey: 'funnel_poa_document_uploaded', count: 119, conversionRate: 83.8, dropOffRate: 3.5, avgTimeSeconds: 180 },
    { step: 7, name: 'AI FICA Verification', eventKey: 'funnel_ai_verification_passed', count: 116, conversionRate: 81.7, dropOffRate: 2.1, avgTimeSeconds: 15 },
    { step: 8, name: 'Onboarding Completed', eventKey: 'funnel_onboarding_completed', count: 115, conversionRate: 81.0, dropOffRate: 0.7, avgTimeSeconds: 10 },
  ];

  const overallConversion = funnelStages[funnelStages.length - 1].conversionRate;
  const totalCompleted = funnelStages[funnelStages.length - 1].count;

  const barGradients = [
    'from-[#00F5D4] to-[#3A86FF] shadow-[0_0_16px_-2px_rgba(0,245,212,0.5)]',
    'from-[#00F5D4] via-[#9D4EDD] to-[#FF2A85] shadow-[0_0_16px_-2px_rgba(157,78,221,0.5)]',
    'from-[#3A86FF] via-[#9D4EDD] to-[#FF2A85] shadow-[0_0_16px_-2px_rgba(255,42,133,0.45)]',
    'from-[#9D4EDD] via-[#FF2A85] to-[#FF6B35] shadow-[0_0_16px_-2px_rgba(255,42,133,0.45)]',
    'from-[#FF2A85] via-[#FF6B35] to-[#FFE600] shadow-[0_0_16px_-2px_rgba(255,107,53,0.45)]',
    'from-[#FF6B35] to-[#FFE600] shadow-[0_0_16px_-2px_rgba(255,230,0,0.4)]',
    'from-[#00F5D4] via-[#4CC9F0] to-[#FFE600] shadow-[0_0_16px_-2px_rgba(0,245,212,0.45)]',
    'from-[#00F5D4] via-[#FF2A85] to-[#FFE600] shadow-[0_0_18px_-2px_rgba(0,245,212,0.6)]',
  ];

  return (
    <div className="py-7 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#00F5D4]" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Real-Time Conversion Funnel Telemetry
            </h1>
          </div>
          <p className="text-xs text-purple-200/75 mt-1">
            GA4 & Firebase Analytics pipeline for {practice.practiceName} · Step-by-step FICA client onboarding conversion
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#00F5D4] font-semibold">
          <Radio className="w-4 h-4 animate-pulse" />
          <span>Firebase Stream Active</span>
        </div>
      </div>

      {/* KPI Top Summary Cards (Neumorphic Glassmorphic + Neon Gradients) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="synth-glass glow-cyan p-5 rounded-3xl">
          <span className="text-xs font-medium text-purple-200/80">Overall Intake Conversion</span>
          <div className="mt-2 text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#00F5D4] to-[#3A86FF] bg-clip-text text-transparent">
            {overallConversion.toFixed(1)}%
          </div>
          <p className="text-[11px] text-[#00F5D4]/90 font-medium mt-1">
            +38% vs. paper-based FICA
          </p>
        </div>

        <div className="synth-glass glow-magenta p-5 rounded-3xl">
          <span className="text-xs font-medium text-purple-200/80">Completed Onboardings</span>
          <div className="mt-2 text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#FF2A85] to-[#FF6B35] bg-clip-text text-transparent">
            {totalCompleted}
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1">Full FICA CDD dossiers</p>
        </div>

        <div className="synth-glass glow-amber p-5 rounded-3xl">
          <span className="text-xs font-medium text-purple-200/80">Average Completion Time</span>
          <div className="mt-2 text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#FF6B35] to-[#FFE600] bg-clip-text text-transparent">
            7.9 <span className="text-xs font-sans text-purple-200/75">mins</span>
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1">Mobile-first intake speed</p>
        </div>

        <div className="synth-glass glow-violet p-5 rounded-3xl">
          <span className="text-xs font-medium text-purple-200/80">Primary Drop-off Point</span>
          <div className="mt-2 text-lg font-bold text-white leading-snug">
            Proof of Address (4.3%)
          </div>
          <p className="text-[11px] text-[#FFE600] mt-1">Utility bill &gt; 90 days</p>
        </div>
      </div>

      {/* 8-Stage Funnel Visual Pipeline */}
      <div className="synth-glass rounded-3xl p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-400/15 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              8-Step Client Intake Conversion Pipeline
            </h2>
            <p className="text-xs text-purple-200/70 mt-0.5">
              Tracking every milestone from magic link dispatch to celebratory FICA certification
            </p>
          </div>
          <span className="text-xs font-mono text-[#00F5D4] tabular-nums">
            142 Initiated · 115 Cleared
          </span>
        </div>

        <div className="space-y-4">
          {funnelStages.map((stage, idx) => (
            <div key={stage.step} className="space-y-2">
              <div className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg synth-inset flex items-center justify-center font-mono font-bold text-[11px] text-[#00F5D4] shrink-0">
                    {stage.step}
                  </span>
                  <span className="font-semibold text-white truncate">{stage.name}</span>
                  <span className="text-purple-300/60 font-mono text-[11px] hidden md:inline">
                    · {stage.eventKey}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono tabular-nums shrink-0">
                  <span className="text-purple-200/75">{stage.count} clients</span>
                  <span className="font-bold text-white w-14 text-right">{stage.conversionRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Recessed track + neon gradient fill */}
              <div className="h-3.5 w-full synth-inset rounded-full overflow-hidden p-[2px]">
                <div
                  style={{ width: `${stage.conversionRate}%` }}
                  className={`h-full bg-gradient-to-r ${barGradients[idx % barGradients.length]} rounded-full transition-all duration-500`}
                />
              </div>

              {stage.dropOffRate > 0 && (
                <div className="flex items-center justify-end gap-1 text-[11px] text-purple-300/70 font-mono tabular-nums">
                  <ArrowDownRight className="w-3 h-3 text-[#FFE600]" />
                  <span>-{stage.dropOffRate.toFixed(1)}% step drop-off</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Device Breakdown & Common FICA Rejections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Device Breakdown */}
        <div className="synth-glass rounded-3xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white">
              Device & Platform Distribution
            </h3>
            <p className="text-xs text-purple-200/70 mt-0.5">
              South African clients predominantly onboard via mobile smartphones.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#FF2A85]" />
                  <span className="font-medium text-purple-100">Mobile Smartphone</span>
                </div>
                <span className="font-mono font-bold text-white tabular-nums">72.4%</span>
              </div>
              <div className="h-2.5 w-full synth-inset rounded-full overflow-hidden p-[1px]">
                <div className="h-full bg-gradient-to-r from-[#FF2A85] to-[#9D4EDD] rounded-full w-[72.4%] shadow-[0_0_12px_rgba(255,42,133,0.6)]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-[#00F5D4]" />
                  <span className="font-medium text-purple-100">Desktop Workstation</span>
                </div>
                <span className="font-mono font-bold text-white tabular-nums">22.8%</span>
              </div>
              <div className="h-2.5 w-full synth-inset rounded-full overflow-hidden p-[1px]">
                <div className="h-full bg-gradient-to-r from-[#00F5D4] to-[#3A86FF] rounded-full w-[22.8%] shadow-[0_0_12px_rgba(0,245,212,0.6)]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Tablet className="w-4 h-4 text-[#FFE600]" />
                  <span className="font-medium text-purple-100">Tablet / iPad</span>
                </div>
                <span className="font-mono font-bold text-white tabular-nums">4.8%</span>
              </div>
              <div className="h-2.5 w-full synth-inset rounded-full overflow-hidden p-[1px]">
                <div className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FFE600] rounded-full w-[4.8%] shadow-[0_0_12px_rgba(255,230,0,0.6)]" />
              </div>
            </div>
          </div>
        </div>

        {/* AI Automated Validation Flags */}
        <div className="synth-glass rounded-3xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              AI Automated Validation Flags
            </h3>
            <p className="text-xs text-purple-200/70 mt-0.5">
              Top reasons flagged for compliance review by the Gemini FICA engine.
            </p>
          </div>

          <div className="divide-y divide-purple-400/15 text-xs">
            <div className="py-3 first:pt-0 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-[#FFE600] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">Proof of Residence &gt; 90 Days</span>
                <p className="text-[11px] text-purple-200/75 mt-0.5">
                  54% of flags · Utility bill issued outside statutory 3-month window.
                </p>
              </div>
            </div>

            <div className="py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-[#FF6B35] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">RSA ID Luhn Checksum Failure</span>
                <p className="text-[11px] text-purple-200/75 mt-0.5">
                  28% of flags · Typo or invalid digit entered in 13-digit ID number.
                </p>
              </div>
            </div>

            <div className="py-3 last:pb-0 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-[#FF2A85] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">Blurry / Glare on Smart ID Card</span>
                <p className="text-[11px] text-purple-200/75 mt-0.5">
                  18% of flags · Automated prompt dispatched requesting clearer photo.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
