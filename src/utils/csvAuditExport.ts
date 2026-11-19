import { AuditLog, ClientIntake, PracticeProfile } from '../types';

export interface AuditCsvExportResult {
  fileName: string;
  rowCount: number;
  exportedAt: string;
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @) while preserving readable compliance text
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function formatSastTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const sast = new Date(parsed.getTime() + 2 * 60 * 60 * 1000);
  const y = sast.getUTCFullYear();
  const m = String(sast.getUTCMonth() + 1).padStart(2, '0');
  const d = String(sast.getUTCDate()).padStart(2, '0');
  const hh = String(sast.getUTCHours()).padStart(2, '0');
  const mm = String(sast.getUTCMinutes()).padStart(2, '0');
  const ss = String(sast.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss} SAST`;
}

export function exportFilteredAuditLogsToCsv(
  practice: PracticeProfile,
  auditLogs: AuditLog[],
  intakes: ClientIntake[],
  filterSummary: string
): AuditCsvExportResult {
  const intakeMap = new Map<string, ClientIntake>();
  intakes.forEach((i) => intakeMap.set(i.id, i));

  const sortedLogs = [...auditLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const headers = [
    'Audit Log ID',
    'Timestamp (SAST UTC+2)',
    'Timestamp (ISO 8601)',
    'Practice Name',
    'Intake Reference',
    'Client / Entity Name',
    'Client Email',
    'Intake FICA Status',
    'FICA Risk Rating',
    'Audit Action',
    'Performed By',
    'IP Address / Endpoint',
    'POPIA Lawful Basis',
    'SHA-256 Integrity Hash',
    'Active Filter Scope',
    'User Agent',
  ];

  const rows = sortedLogs.map((log) => {
    const linkedIntake = intakeMap.get(log.intakeId);
    const isSystemScope =
      log.intakeId === 'SECURITY_WEBAUTHN' ||
      log.intakeId === 'BATCH_BULK_ARCHIVE' ||
      log.intakeId === 'BATCH_AUDIT_CSV_EXPORT';

    return [
      log.id,
      formatSastTimestamp(log.timestamp),
      log.timestamp,
      practice.practiceName,
      log.intakeId,
      linkedIntake?.clientName || (isSystemScope ? 'Practice-Wide Security / Archive' : 'Unlinked Intake'),
      linkedIntake?.clientEmail || practice.adminEmail,
      linkedIntake?.status || 'N/A',
      linkedIntake?.riskRating || 'N/A',
      log.action,
      log.performedBy,
      log.ipAddress,
      log.popiaLawfulBasis,
      log.hash,
      filterSummary,
      log.userAgent,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const exportedAt = new Date().toISOString();
  const safePracticeSlug = practice.practiceName
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const dateStamp = exportedAt.slice(0, 10);
  const fileName = `Audit_Report_${safePracticeSlug}_${dateStamp}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    fileName,
    rowCount: sortedLogs.length,
    exportedAt,
  };
}
