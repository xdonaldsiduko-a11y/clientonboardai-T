import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import {
  CalendarRange,
  Clock,
  Sparkles,
  TrendingUp,
  Users,
  FileCheck,
  ChevronRight,
  X,
} from 'lucide-react';
import { AuditLog, ClientIntake, VerificationDocument } from '../types';

interface ActivityHeatmapPanelProps {
  intakes: ClientIntake[];
  documents: VerificationDocument[];
  auditLogs: AuditLog[];
  onSelectIntake?: (intake: ClientIntake) => void;
}

type ActivityCategory = 'all' | 'intake' | 'verification';
type HeatmapViewMode = 'matrix' | 'timeline';

interface NormalizedEvent {
  id: string;
  timestamp: string;
  ms: number;
  category: 'intake' | 'verification';
  title: string;
  actor: string;
  intake?: ClientIntake;
  dayIndex: number; // 0 = Mon .. 6 = Sun
  hour: number; // 0..23 SAST
  slotIndex: number; // 0..11 (2-hour blocks)
  dateKey: string; // YYYY-MM-DD SAST
  dateLabel: string; // e.g. 04 Nov
  timeLabel: string; // HH:MM SAST
}

interface MatrixCellDatum {
  key: string;
  slotIndex: number;
  dayIndex: number;
  slotLabel: string;
  slotRange: string;
  dayLabel: string;
  total: number;
  intakeCount: number;
  verificationCount: number;
  fill: string;
  glow: boolean;
  events: NormalizedEvent[];
}

interface TimelineDayDatum {
  dateKey: string;
  dateLabel: string;
  intakes: number;
  verifications: number;
  total: number;
  events: NormalizedEvent[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_LABELS = [
  '00:00',
  '02:00',
  '04:00',
  '06:00',
  '08:00',
  '10:00',
  '12:00',
  '14:00',
  '16:00',
  '18:00',
  '20:00',
  '22:00',
];
const SLOT_RANGES = [
  '00:00–02:00',
  '02:00–04:00',
  '04:00–06:00',
  '06:00–08:00',
  '08:00–10:00',
  '10:00–12:00',
  '12:00–14:00',
  '14:00–16:00',
  '16:00–18:00',
  '18:00–20:00',
  '20:00–22:00',
  '22:00–24:00',
];

function getSastParts(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Shift UTC ms by +2 hours for South Africa Standard Time (SAST, UTC+2, no DST)
  const sastDate = new Date(parsed.getTime() + 2 * 60 * 60 * 1000);
  const utcDay = sastDate.getUTCDay(); // 0=Sun..6=Sat
  const dayIndex = (utcDay + 6) % 7; // 0=Mon..6=Sun
  const hour = sastDate.getUTCHours();
  const minute = sastDate.getUTCMinutes();
  const slotIndex = Math.floor(hour / 2);

  const year = sastDate.getUTCFullYear();
  const month = String(sastDate.getUTCMonth() + 1).padStart(2, '0');
  const dayNum = String(sastDate.getUTCDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${dayNum}`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateLabel = `${dayNum} ${monthNames[sastDate.getUTCMonth()]}`;
  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    ms: parsed.getTime(),
    dayIndex,
    hour,
    slotIndex,
    dateKey,
    dateLabel,
    timeLabel,
  };
}

function getHeatColor(count: number, maxCount: number): { fill: string; glow: boolean } {
  if (count <= 0 || maxCount <= 0) {
    return { fill: '#170B2E', glow: false };
  }
  const ratio = count / Math.max(maxCount, 1);
  if (ratio <= 0.28) return { fill: '#4CC9F0', glow: false };
  if (ratio <= 0.55) return { fill: '#00F5D4', glow: true };
  if (ratio <= 0.78) return { fill: '#FF2A85', glow: true };
  return { fill: '#FFE600', glow: true };
}

interface CustomCellShapeProps {
  cx?: number;
  cy?: number;
  payload?: MatrixCellDatum;
  cellWidth: number;
  cellHeight: number;
  selectedKey: string | null;
  onSelectCell: (cell: MatrixCellDatum) => void;
}

const HeatmapCellShape: React.FC<CustomCellShapeProps> = ({
  cx = 0,
  cy = 0,
  payload,
  cellWidth,
  cellHeight,
  selectedKey,
  onSelectCell,
}) => {
  if (!payload) return null;
  const isSelected = selectedKey === payload.key;
  const hasEvents = payload.total > 0;
  const strokeColor = isSelected
    ? '#FFFFFF'
    : hasEvents
    ? 'rgba(255,255,255,0.22)'
    : 'rgba(167,139,250,0.14)';

  return (
    <g
      onClick={() => hasEvents && onSelectCell(payload)}
      style={{ cursor: hasEvents ? 'pointer' : 'default' }}
    >
      <rect
        x={cx - cellWidth / 2}
        y={cy - cellHeight / 2}
        width={cellWidth}
        height={cellHeight}
        rx={6}
        ry={6}
        fill={payload.fill}
        fillOpacity={hasEvents ? 0.92 : 0.78}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2 : 1}
      />
      {hasEvents && cellWidth >= 24 && (
        <text
          x={cx}
          y={cy + 3.5}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fontFamily="monospace"
          fill={payload.fill === '#FFE600' || payload.fill === '#00F5D4' || payload.fill === '#4CC9F0' ? '#0B0518' : '#FFFFFF'}
          pointerEvents="none"
        >
          {payload.total}
        </text>
      )}
    </g>
  );
};

export const ActivityHeatmapPanel: React.FC<ActivityHeatmapPanelProps> = ({
  intakes,
  documents,
  auditLogs,
  onSelectIntake,
}) => {
  const [viewMode, setViewMode] = useState<HeatmapViewMode>('matrix');
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory>('all');
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const chartWrapperRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(640);

  useEffect(() => {
    const el = chartWrapperRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setChartWidth(el.clientWidth);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [viewMode]);

  // Build deduplicated chronological event stream across intakes, documents, and audit logs
  const allEvents = useMemo<NormalizedEvent[]>(() => {
    const intakeMap = new Map<string, ClientIntake>();
    intakes.forEach((i) => intakeMap.set(i.id, i));

    const collected: NormalizedEvent[] = [];
    const seenFingerprints = new Set<string>();

    const pushEvent = (
      id: string,
      iso: string,
      category: 'intake' | 'verification',
      title: string,
      actor: string,
      intake?: ClientIntake
    ) => {
      const parts = getSastParts(iso);
      if (!parts) return;
      const minuteBucket = Math.floor(parts.ms / 60000);
      const fingerprint = `${category}:${intake?.id || actor}:${minuteBucket}:${title}`;
      if (seenFingerprints.has(fingerprint)) return;
      seenFingerprints.add(fingerprint);

      collected.push({
        id,
        timestamp: iso,
        ms: parts.ms,
        category,
        title,
        actor,
        intake,
        dayIndex: parts.dayIndex,
        hour: parts.hour,
        slotIndex: parts.slotIndex,
        dateKey: parts.dateKey,
        dateLabel: parts.dateLabel,
        timeLabel: parts.timeLabel,
      });
    };

    intakes.forEach((intake) => {
      pushEvent(
        `intake-created-${intake.id}`,
        intake.createdAt,
        'intake',
        `Intake Opened (${intake.clientType.toUpperCase()})`,
        intake.clientName,
        intake
      );

      const createdMs = new Date(intake.createdAt).getTime();
      const updatedMs = new Date(intake.updatedAt).getTime();
      if (!Number.isNaN(updatedMs) && Math.abs(updatedMs - createdMs) > 5 * 60 * 1000) {
        const isVerificationStage = ['ai_verified', 'approved', 'needs_review', 'rejected'].includes(
          intake.status
        );
        pushEvent(
          `intake-updated-${intake.id}`,
          intake.updatedAt,
          isVerificationStage ? 'verification' : 'intake',
          `Status: ${intake.status.replace('_', ' ')}`,
          intake.clientName,
          intake
        );
      }
    });

    documents.forEach((docItem) => {
      const parentIntake = intakeMap.get(docItem.intakeId);
      const docStatusLabel =
        docItem.status === 'valid'
          ? 'Document Verified'
          : docItem.status === 'flagged'
          ? 'Document Flagged'
          : docItem.status === 'rejected'
          ? 'Document Rejected'
          : 'Document Uploaded';
      pushEvent(
        `doc-${docItem.id}`,
        docItem.uploadedAt,
        'verification',
        `${docStatusLabel}: ${docItem.docType.replace(/_/g, ' ')}`,
        parentIntake?.clientName || docItem.fileName,
        parentIntake
      );
    });

    auditLogs.forEach((logItem) => {
      const parentIntake = intakeMap.get(logItem.intakeId);
      const upperAction = logItem.action.toUpperCase();
      const isVerification =
        upperAction.includes('VERIF') ||
        upperAction.includes('APPROVED') ||
        upperAction.includes('FLAG') ||
        upperAction.includes('CIPC') ||
        upperAction.includes('EXPIRY') ||
        upperAction.includes('REPORT') ||
        upperAction.includes('ARCHIVE') ||
        upperAction.includes('WEBAUTHN');

      pushEvent(
        `audit-${logItem.id}`,
        logItem.timestamp,
        isVerification ? 'verification' : 'intake',
        logItem.action.replace(/_/g, ' '),
        parentIntake?.clientName || logItem.performedBy,
        parentIntake
      );
    });

    return collected.sort((a, b) => a.ms - b.ms);
  }, [intakes, documents, auditLogs]);

  const filteredEvents = useMemo(
    () =>
      categoryFilter === 'all'
        ? allEvents
        : allEvents.filter((e) => e.category === categoryFilter),
    [allEvents, categoryFilter]
  );

  // Build 7 x 12 Heatmap Matrix Cells
  const { matrixCells, peakCell, peakIntakeSlot, peakVerificationSlot, afterHoursPct } = useMemo(() => {
    const gridMap = new Map<string, NormalizedEvent[]>();
    for (let d = 0; d < 7; d++) {
      for (let s = 0; s < 12; s++) {
        gridMap.set(`${d}-${s}`, []);
      }
    }

    const slotIntakeCounts = Array(12).fill(0);
    const slotVerifCounts = Array(12).fill(0);
    let afterHoursCount = 0;

    filteredEvents.forEach((ev) => {
      const key = `${ev.dayIndex}-${ev.slotIndex}`;
      gridMap.get(key)?.push(ev);

      if (ev.category === 'intake') {
        slotIntakeCounts[ev.slotIndex]++;
      } else {
        slotVerifCounts[ev.slotIndex]++;
      }

      const isWeekend = ev.dayIndex >= 5;
      const isOutsideOfficeHours = ev.hour < 8 || ev.hour >= 18;
      if (isWeekend || isOutsideOfficeHours) {
        afterHoursCount++;
      }
    });

    let maxCellCount = 0;
    gridMap.forEach((arr) => {
      if (arr.length > maxCellCount) maxCellCount = arr.length;
    });

    const cells: MatrixCellDatum[] = [];
    let bestCell: MatrixCellDatum | null = null;

    for (let d = 0; d < 7; d++) {
      for (let s = 0; s < 12; s++) {
        const key = `${d}-${s}`;
        const cellEvents = gridMap.get(key) || [];
        const intakeCount = cellEvents.filter((e) => e.category === 'intake').length;
        const verificationCount = cellEvents.filter((e) => e.category === 'verification').length;
        const total = cellEvents.length;
        const { fill, glow } = getHeatColor(total, maxCellCount);

        const datum: MatrixCellDatum = {
          key,
          slotIndex: s,
          dayIndex: d,
          slotLabel: SLOT_LABELS[s],
          slotRange: SLOT_RANGES[s],
          dayLabel: DAY_LABELS[d],
          total,
          intakeCount,
          verificationCount,
          fill,
          glow,
          events: cellEvents,
        };
        cells.push(datum);
        if (!bestCell || total > bestCell.total) {
          bestCell = datum;
        }
      }
    }

    const bestIntakeIdx = slotIntakeCounts.indexOf(Math.max(...slotIntakeCounts));
    const bestVerifIdx = slotVerifCounts.indexOf(Math.max(...slotVerifCounts));

    return {
      matrixCells: cells,
      peakCell: bestCell && bestCell.total > 0 ? bestCell : null,
      peakIntakeSlot:
        slotIntakeCounts[bestIntakeIdx] > 0
          ? `${SLOT_RANGES[bestIntakeIdx]} SAST (${slotIntakeCounts[bestIntakeIdx]})`
          : 'No intake events',
      peakVerificationSlot:
        slotVerifCounts[bestVerifIdx] > 0
          ? `${SLOT_RANGES[bestVerifIdx]} SAST (${slotVerifCounts[bestVerifIdx]})`
          : 'No verification events',
      afterHoursPct:
        filteredEvents.length > 0 ? Math.round((afterHoursCount / filteredEvents.length) * 100) : 0,
    };
  }, [filteredEvents]);

  // Build Chronological Daily Timeline Data
  const timelineData = useMemo<TimelineDayDatum[]>(() => {
    const byDate = new Map<string, TimelineDayDatum>();
    filteredEvents.forEach((ev) => {
      const existing = byDate.get(ev.dateKey);
      if (existing) {
        if (ev.category === 'intake') existing.intakes++;
        else existing.verifications++;
        existing.total++;
        existing.events.push(ev);
      } else {
        byDate.set(ev.dateKey, {
          dateKey: ev.dateKey,
          dateLabel: ev.dateLabel,
          intakes: ev.category === 'intake' ? 1 : 0,
          verifications: ev.category === 'verification' ? 1 : 0,
          total: 1,
          events: [ev],
        });
      }
    });

    return Array.from(byDate.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [filteredEvents]);

  const activeInspectCell = useMemo(
    () => matrixCells.find((c) => c.key === selectedCellKey) || null,
    [matrixCells, selectedCellKey]
  );

  const activeInspectDay = useMemo(
    () => timelineData.find((d) => d.dateKey === selectedDateKey) || null,
    [timelineData, selectedDateKey]
  );

  // Compute responsive cell geometry for 12 x 7 grid
  const plotWidth = Math.max(240, chartWidth - 62);
  const cellWidth = Math.max(15, Math.min(46, Math.floor(plotWidth / 12) - 5));
  const cellHeight = 22;

  return (
    <div className="synth-glass p-5 sm:p-6 rounded-3xl space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <CalendarRange className="w-5 h-5 text-[#FF2A85] shrink-0" />
            <h2 className="text-sm font-bold text-white">
              Chronological Activity Heatmap (Peak FICA Intake &amp; Verification Times)
            </h2>
          </div>
          <p className="text-xs text-purple-200/75">
            South Africa Standard Time (SAST · UTC+2) · {filteredEvents.length} chronological event
            {filteredEvents.length !== 1 ? 's' : ''} mapped across intakes, document uploads &amp; verifications
          </p>
        </div>

        {/* Interactive Mode & Category Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 synth-inset rounded-xl border border-purple-400/20">
            <button
              type="button"
              onClick={() => {
                setViewMode('matrix');
                setSelectedDateKey(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'matrix'
                  ? 'bg-gradient-to-r from-[#FF2A85] to-[#9D4EDD] text-white shadow-[0_0_14px_-3px_rgba(255,42,133,0.6)]'
                  : 'text-purple-200/75 hover:text-white'
              }`}
            >
              Peak Hours Matrix
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('timeline');
                setSelectedCellKey(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'timeline'
                  ? 'bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] text-[#0B0518] font-bold shadow-[0_0_14px_-3px_rgba(0,245,212,0.6)]'
                  : 'text-purple-200/75 hover:text-white'
              }`}
            >
              Chronological Timeline
            </button>
          </div>

          <div className="inline-flex items-center p-1 synth-inset rounded-xl border border-purple-400/20">
            {(
              [
                { id: 'all', label: 'All Activity' },
                { id: 'intake', label: 'Intakes' },
                { id: 'verification', label: 'Verifications' },
              ] as { id: ActivityCategory; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(tab.id);
                  setSelectedCellKey(null);
                  setSelectedDateKey(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  categoryFilter === tab.id
                    ? 'bg-white/15 text-white'
                    : 'text-purple-200/70 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow Optimization Insights Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 synth-inset rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-purple-300/75">
            <TrendingUp className="w-3.5 h-3.5 text-[#FFE600]" />
            <span>Peak Workflow Window</span>
          </div>
          <div className="font-bold font-mono tabular-nums text-[#FFE600] truncate">
            {peakCell ? `${peakCell.dayLabel} · ${peakCell.slotRange}` : 'No activity yet'}
          </div>
          <p className="text-[10px] text-purple-200/65 font-mono tabular-nums">
            {peakCell ? `${peakCell.total} FICA actions concentrated` : 'Awaiting intake logs'}
          </p>
        </div>

        <div className="p-3.5 synth-inset rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-purple-300/75">
            <Users className="w-3.5 h-3.5 text-[#FF2A85]" />
            <span>Peak Client Intake Time</span>
          </div>
          <div className="font-bold font-mono tabular-nums text-[#FF2A85] truncate">
            {peakIntakeSlot}
          </div>
          <p className="text-[10px] text-purple-200/65">
            Optimal window for automated reminders
          </p>
        </div>

        <div className="p-3.5 synth-inset rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-purple-300/75">
            <FileCheck className="w-3.5 h-3.5 text-[#00F5D4]" />
            <span>Peak Verification Time</span>
          </div>
          <div className="font-bold font-mono tabular-nums text-[#00F5D4] truncate">
            {peakVerificationSlot}
          </div>
          <p className="text-[10px] text-purple-200/65">
            Highest AI OCR &amp; officer sign-off load
          </p>
        </div>

        <div className="p-3.5 synth-inset rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-purple-300/75">
            <Clock className="w-3.5 h-3.5 text-[#4CC9F0]" />
            <span>After-Hours / Weekend Load</span>
          </div>
          <div className="font-bold font-mono tabular-nums text-[#4CC9F0]">
            {afterHoursPct}%
          </div>
          <p className="text-[10px] text-purple-200/65">
            Outside 08:00–18:00 SAST Mon–Fri
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization Container */}
      <div className="synth-inset rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00F5D4]" />
            <span>
              {viewMode === 'matrix'
                ? 'Day-of-Week × 2-Hour SAST Chronological Intensity Matrix'
                : 'Daily Intake & Verification Volume Timeline'}
            </span>
          </span>

          {viewMode === 'matrix' ? (
            <div className="flex items-center gap-2 text-[10px] font-mono text-purple-200/75">
              <span>Quiet</span>
              <span className="w-3.5 h-3 rounded bg-[#170B2E] border border-purple-400/25 inline-block" />
              <span className="w-3.5 h-3 rounded bg-[#4CC9F0] inline-block" />
              <span className="w-3.5 h-3 rounded bg-[#00F5D4] inline-block" />
              <span className="w-3.5 h-3 rounded bg-[#FF2A85] inline-block" />
              <span className="w-3.5 h-3 rounded bg-[#FFE600] inline-block" />
              <span>Peak Load</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[10px] font-medium text-purple-200/80">
              <span className="inline-flex items-center gap-1.5 text-[#FF2A85]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FF2A85] inline-block" /> Client Intakes
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#00F5D4]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#00F5D4] inline-block" /> Verifications &amp; Audits
              </span>
            </div>
          )}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center text-center text-xs text-purple-200/70 space-y-1">
            <Clock className="w-6 h-6 text-purple-300/60" />
            <p className="font-semibold text-white">No chronological events match this filter yet.</p>
            <p className="text-[11px]">Switch filters or submit a client FICA intake to populate the heatmap.</p>
          </div>
        ) : (
          <div ref={chartWrapperRef} className="w-full h-[250px] min-w-0">
            {viewMode === 'matrix' ? (
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart margin={{ top: 8, right: 14, bottom: 8, left: 0 }}>
                  <XAxis
                    type="number"
                    dataKey="slotIndex"
                    domain={[-0.5, 11.5]}
                    ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                    tickFormatter={(v) => SLOT_LABELS[v] || ''}
                    interval={0}
                    tick={{ fill: '#C4B5FD', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(167, 139, 250, 0.2)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="dayIndex"
                    domain={[-0.5, 6.5]}
                    ticks={[0, 1, 2, 3, 4, 5, 6]}
                    reversed
                    tickFormatter={(v) => DAY_LABELS[v] || ''}
                    interval={0}
                    width={38}
                    tick={{ fill: '#DDD6FE', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ZAxis type="number" dataKey="total" range={[100, 100]} />
                  <RechartsTooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const cell = payload[0].payload as MatrixCellDatum;
                      return (
                        <div className="rounded-xl bg-[#130829]/95 border border-purple-400/35 px-3.5 py-2.5 shadow-2xl text-xs text-white backdrop-blur-md space-y-1 max-w-[240px]">
                          <div className="font-bold text-white">
                            {cell.dayLabel} · {cell.slotRange} SAST
                          </div>
                          {cell.total === 0 ? (
                            <div className="text-[11px] text-purple-200/70">
                              No intake or verification activity recorded
                            </div>
                          ) : (
                            <>
                              <div className="font-mono tabular-nums text-[11px] text-[#00F5D4]">
                                {cell.total} Total Event{cell.total !== 1 ? 's' : ''}
                              </div>
                              <div className="flex items-center gap-3 text-[10.5px] font-mono tabular-nums">
                                <span className="text-[#FF2A85]">{cell.intakeCount} Intakes</span>
                                <span className="text-[#00F5D4]">{cell.verificationCount} Verifications</span>
                              </div>
                              <div className="text-[10px] text-purple-200/70 pt-0.5">
                                Click tile to inspect chronological trail
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={matrixCells}
                    shape={(props: unknown) => {
                      const p = props as { cx?: number; cy?: number; payload?: MatrixCellDatum };
                      return (
                        <HeatmapCellShape
                          cx={p.cx}
                          cy={p.cy}
                          payload={p.payload}
                          cellWidth={cellWidth}
                          cellHeight={cellHeight}
                          selectedKey={selectedCellKey}
                          onSelectCell={(cell) =>
                            setSelectedCellKey((prev) => (prev === cell.key ? null : cell.key))
                          }
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={timelineData}
                  margin={{ top: 10, right: 14, bottom: 8, left: -16 }}
                  onClick={(state) => {
                    const activeLabel = state?.activeLabel;
                    if (typeof activeLabel === 'string') {
                      const matched = timelineData.find((d) => d.dateLabel === activeLabel);
                      if (matched) {
                        setSelectedDateKey((prev) => (prev === matched.dateKey ? null : matched.dateKey));
                      }
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(167, 139, 250, 0.14)"
                  />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: '#DDD6FE', fontSize: 10.5 }}
                    axisLine={{ stroke: 'rgba(167, 139, 250, 0.2)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#C4B5FD', fontSize: 10.5 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(157, 78, 221, 0.14)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const datum = payload[0].payload as TimelineDayDatum;
                      return (
                        <div className="rounded-xl bg-[#130829]/95 border border-purple-400/35 px-3.5 py-2.5 shadow-2xl text-xs text-white backdrop-blur-md space-y-1">
                          <div className="font-bold text-white">
                            {datum.dateLabel} ({datum.dateKey})
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
                            <span className="text-[#FF2A85]">{datum.intakes} Intakes</span>
                            <span className="text-[#00F5D4]">{datum.verifications} Verifications</span>
                          </div>
                          <div className="text-[10px] text-purple-200/70">
                            Click bar to inspect day&apos;s workflow events
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="intakes"
                    stackId="workflow"
                    fill="#FF2A85"
                    radius={[0, 0, 4, 4]}
                    maxBarSize={42}
                    className="cursor-pointer"
                  />
                  <Bar
                    dataKey="verifications"
                    stackId="workflow"
                    fill="#00F5D4"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Interactive Drilldown Drawer for Selected Heatmap Cell or Timeline Date */}
        {(activeInspectCell || activeInspectDay) && (
          <div className="p-3.5 rounded-2xl bg-[#0D051F]/90 border border-purple-400/25 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="font-bold text-white">
                {activeInspectCell
                  ? `${activeInspectCell.dayLabel} · ${activeInspectCell.slotRange} SAST (${activeInspectCell.total} events)`
                  : activeInspectDay
                  ? `${activeInspectDay.dateLabel} (${activeInspectDay.dateKey}) — ${activeInspectDay.total} events`
                  : ''}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCellKey(null);
                  setSelectedDateKey(null);
                }}
                aria-label="Close activity drilldown"
                className="p-1 text-purple-200/70 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {(activeInspectCell?.events || activeInspectDay?.events || []).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-purple-400/15 text-[11px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-purple-300/80 shrink-0">
                        {ev.dateLabel} {ev.timeLabel}
                      </span>
                      <span
                        className={`font-bold truncate ${
                          ev.category === 'verification' ? 'text-[#00F5D4]' : 'text-[#FF2A85]'
                        }`}
                      >
                        {ev.title}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-purple-100/80 truncate">{ev.actor}</div>
                  </div>

                  {ev.intake && onSelectIntake && (
                    <button
                      type="button"
                      onClick={() => onSelectIntake(ev.intake!)}
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#00F5D4] hover:underline shrink-0 cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
