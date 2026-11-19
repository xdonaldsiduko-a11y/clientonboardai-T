import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Activity, ShieldCheck, CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { ClientIntake, FicaExpiryState, VerificationDocument } from '../types';
import { calculateFicaDocumentExpiry } from '../utils/sa-fica';

interface ComplianceHealthPanelProps {
  intakes: ClientIntake[];
  documents: VerificationDocument[];
  onSelectIntake: (intake: ClientIntake) => void;
  onSelectExpiryFilter: (state: FicaExpiryState | 'all') => void;
}

interface HealthSlice {
  name: string;
  key: 'verified_valid' | 'expiring_soon' | 'pending' | 'flagged_expired';
  value: number;
  pct: number;
  color: string;
  filterState?: FicaExpiryState;
}

interface ClientBarDatum {
  intakeId: string;
  shortName: string;
  fullName: string;
  verifiedPct: number;
  verifiedCount: number;
  totalClientDocs: number;
  fill: string;
  intake: ClientIntake;
}

export const ComplianceHealthPanel: React.FC<ComplianceHealthPanelProps> = ({
  intakes,
  documents,
  onSelectIntake,
  onSelectExpiryFilter,
}) => {
  // Classify every document across all client intakes
  let verifiedValidCount = 0;
  let verifiedExpiringCount = 0;
  let pendingCount = 0;
  let flaggedOrExpiredCount = 0;

  documents.forEach((doc) => {
    const expiry = calculateFicaDocumentExpiry(doc);
    if (doc.status === 'flagged' || doc.status === 'rejected' || expiry.state === 'expired') {
      flaggedOrExpiredCount++;
    } else if (doc.status === 'pending') {
      pendingCount++;
    } else if (doc.status === 'valid' && expiry.state === 'expiring_soon') {
      verifiedExpiringCount++;
    } else {
      verifiedValidCount++;
    }
  });

  const totalDocs = documents.length;
  const totalVerifiedDocs = verifiedValidCount + verifiedExpiringCount;
  const overallVerifiedPct =
    totalDocs > 0 ? Math.round((totalVerifiedDocs / totalDocs) * 100) : 0;
  const strictHealthyPct =
    totalDocs > 0 ? Math.round((verifiedValidCount / totalDocs) * 100) : 0;

  const pieData: HealthSlice[] = [
    {
      name: 'Verified & Current',
      key: 'verified_valid',
      value: verifiedValidCount,
      pct: totalDocs > 0 ? Math.round((verifiedValidCount / totalDocs) * 100) : 0,
      color: '#00F5D4',
      filterState: 'valid',
    },
    {
      name: 'Verified (<30d Expiry)',
      key: 'expiring_soon',
      value: verifiedExpiringCount,
      pct: totalDocs > 0 ? Math.round((verifiedExpiringCount / totalDocs) * 100) : 0,
      color: '#FFE600',
      filterState: 'expiring_soon',
    },
    {
      name: 'Pending Validation',
      key: 'pending',
      value: pendingCount,
      pct: totalDocs > 0 ? Math.round((pendingCount / totalDocs) * 100) : 0,
      color: '#FF6B35',
    },
    {
      name: 'Flagged / Expired',
      key: 'flagged_expired',
      value: flaggedOrExpiredCount,
      pct: totalDocs > 0 ? Math.round((flaggedOrExpiredCount / totalDocs) * 100) : 0,
      color: '#FF2A85',
      filterState: 'expired',
    },
  ];

  const activePieSlices = pieData.filter((d) => d.value > 0);
  const safePieData =
    activePieSlices.length > 0
      ? activePieSlices
      : [{ name: 'No Documents', key: 'pending' as const, value: 1, pct: 0, color: '#3b2566' }];

  // Per-client intake readiness (% verified documents)
  const clientBarData: ClientBarDatum[] = intakes.map((intake) => {
    const clientDocs = documents.filter((d) => d.intakeId === intake.id);
    const verifiedClientDocs = clientDocs.filter((d) => {
      const exp = calculateFicaDocumentExpiry(d);
      return d.status === 'valid' && exp.state !== 'expired';
    });
    const expectedDenominator = Math.max(
      clientDocs.length,
      intake.clientType === 'individual' ? 2 : 2
    );
    const verifiedPct =
      expectedDenominator > 0
        ? Math.round((verifiedClientDocs.length / expectedDenominator) * 100)
        : 0;

    const firstWord = intake.clientName.split(' ')[0];
    const shortName =
      intake.clientName.length > 13 ? `${firstWord.slice(0, 11)}..` : intake.clientName;

    const fill =
      verifiedPct >= 100
        ? '#00F5D4'
        : verifiedPct >= 50
        ? '#FFE600'
        : '#FF2A85';

    return {
      intakeId: intake.id,
      shortName,
      fullName: intake.clientName,
      verifiedPct,
      verifiedCount: verifiedClientDocs.length,
      totalClientDocs: expectedDenominator,
      fill,
      intake,
    };
  });

  const ficaReadinessStatus =
    overallVerifiedPct >= 80
      ? { label: 'Audit-Ready', color: 'text-[#00F5D4]' }
      : overallVerifiedPct >= 50
      ? { label: 'Action Needed', color: 'text-[#FFE600]' }
      : { label: 'Critical Attention', color: 'text-[#FF2A85]' };

  return (
    <div className="synth-glass p-5 sm:p-6 rounded-3xl space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#00F5D4] shrink-0" />
            <h2 className="text-sm font-bold text-white">
              Compliance Health &amp; Practice FICA Readiness
            </h2>
          </div>
          <p className="text-xs text-purple-200/75">
            Verified document ratio across {intakes.length} client intakes ·{' '}
            <span className={`font-semibold ${ficaReadinessStatus.color}`}>
              {ficaReadinessStatus.label}
            </span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono tabular-nums text-purple-100">
              {totalVerifiedDocs}/{totalDocs} docs verified ({overallVerifiedPct}%)
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-purple-200/80">
            <ShieldCheck className="w-4 h-4 text-[#00F5D4]" />
            <span>Strict Non-Expired Ready:</span>
            <strong className="font-mono tabular-nums text-[#00F5D4]">{strictHealthyPct}%</strong>
          </div>
        </div>
      </div>

      {/* Synchronized Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Practice Document Verification Donut */}
        <div className="lg:col-span-5 synth-inset rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              Document Verification Mix
            </span>
            <span className="text-[11px] font-mono tabular-nums text-purple-300/75">
              {totalDocs} Total Files
            </span>
          </div>

          <div className="relative h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <defs>
                  <filter id="synthNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#00F5D4" floodOpacity="0.35" />
                  </filter>
                </defs>
                <Pie
                  data={safePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={4}
                  stroke="rgba(11,5,24,0.85)"
                  strokeWidth={2}
                >
                  {safePieData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as HealthSlice;
                    return (
                      <div className="rounded-xl bg-[#130829]/95 border border-purple-400/35 px-3 py-2 shadow-2xl text-xs text-white backdrop-blur-md">
                        <div className="font-bold" style={{ color: item.color }}>
                          {item.name}
                        </div>
                        <div className="font-mono tabular-nums text-purple-100 mt-0.5">
                          {item.value} document{item.value !== 1 ? 's' : ''} ({item.pct}%)
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Gauge Metric */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#00F5D4] via-[#4CC9F0] to-[#FFE600] bg-clip-text text-transparent">
                {overallVerifiedPct}%
              </span>
              <span className="text-[10px] font-semibold text-purple-200/75 tracking-tight">
                Verified Docs
              </span>
            </div>
          </div>

          {/* Interactive Breakdown Legend */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {pieData.map((slice) => {
              const Icon =
                slice.key === 'verified_valid'
                  ? CheckCircle2
                  : slice.key === 'expiring_soon'
                  ? AlertTriangle
                  : slice.key === 'pending'
                  ? Clock
                  : XCircle;
              const isClickable = !!slice.filterState && slice.value > 0;

              return (
                <button
                  key={slice.key}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => slice.filterState && onSelectExpiryFilter(slice.filterState)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl border border-purple-400/15 bg-[#0C061C]/70 text-left transition-colors ${
                    isClickable
                      ? 'hover:border-purple-300/45 cursor-pointer'
                      : 'cursor-default opacity-85'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0 truncate text-purple-100 font-medium">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: slice.color }} />
                    <span className="truncate">{slice.name}</span>
                  </span>
                  <span
                    className="font-mono font-bold tabular-nums ml-1.5 shrink-0"
                    style={{ color: slice.color }}
                  >
                    {slice.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Per-Client Verified Document Readiness Bar Chart */}
        <div className="lg:col-span-7 synth-inset rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-white block">
                Verified Document Readiness by Client Intake (%)
              </span>
              <span className="text-[11px] text-purple-200/70">
                Click any bar to inspect that client&apos;s FICA dossier
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-medium text-purple-200/75">
              <span className="inline-flex items-center gap-1 text-[#00F5D4]">
                <CheckCircle2 className="w-3 h-3" /> 100% Ready
              </span>
              <span className="inline-flex items-center gap-1 text-[#FFE600]">
                <AlertTriangle className="w-3 h-3" /> Partial
              </span>
              <span className="inline-flex items-center gap-1 text-[#FF2A85]">
                <XCircle className="w-3 h-3" /> Attention
              </span>
            </div>
          </div>

          <div className="h-[235px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={235}>
              <BarChart
                data={clientBarData}
                margin={{ top: 10, right: 12, left: -16, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(167, 139, 250, 0.14)"
                />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: '#DDD6FE', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(167, 139, 250, 0.2)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#C4B5FD', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(157, 78, 221, 0.12)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as ClientBarDatum;
                    return (
                      <div className="rounded-xl bg-[#130829]/95 border border-purple-400/35 px-3.5 py-2.5 shadow-2xl text-xs text-white backdrop-blur-md space-y-1">
                        <div className="font-bold text-white">{item.fullName}</div>
                        <div className="font-mono tabular-nums" style={{ color: item.fill }}>
                          {item.verifiedPct}% Verified ({item.verifiedCount}/{item.totalClientDocs} required docs)
                        </div>
                        <div className="text-[10px] text-purple-200/75 capitalize">
                          Status: {item.intake.status.replace('_', ' ')} · Click bar to inspect
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="verifiedPct"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                  className="cursor-pointer"
                  onClick={(barDatum) => {
                    const payload = barDatum?.payload as ClientBarDatum | undefined;
                    if (payload?.intake) {
                      onSelectIntake(payload.intake);
                    }
                  }}
                >
                  {clientBarData.map((entry) => (
                    <Cell key={entry.intakeId} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
