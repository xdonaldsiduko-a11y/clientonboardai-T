import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Download, 
  Copy,
  Check
} from 'lucide-react';
import { AuditLog, PracticeProfile } from '../types';

interface AuditLogViewProps {
  practice: PracticeProfile;
  auditLogs: AuditLog[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  practice,
  auditLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const filteredLogs = auditLogs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.performedBy.toLowerCase().includes(q) ||
      log.hash.toLowerCase().includes(q) ||
      log.intakeId.toLowerCase().includes(q)
    );
  });

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownloadFullAuditCertificate = () => {
    const certData = {
      title: 'REPUBLIC OF SOUTH AFRICA - POPIA SECTION 19 COMPLIANCE AUDIT CERTIFICATE',
      practiceName: practice.practiceName,
      ficaOfficer: practice.ficaOfficerName,
      generatedAt: new Date().toISOString(),
      statutoryAct: 'Protection of Personal Information Act No. 4 of 2013',
      totalAuditedEvents: auditLogs.length,
      integrityAuditTrail: auditLogs.map((log) => ({
        timestamp: log.timestamp,
        intakeId: log.intakeId,
        action: log.action,
        operator: log.performedBy,
        ipAddress: log.ipAddress,
        lawfulBasis: log.popiaLawfulBasis,
        sha256Hash: log.hash
      })),
      complianceDeclaration: 'All records are cryptographically hashed and safeguarded against unauthorized modification in accordance with POPIA Section 19.'
    };

    const blob = new Blob([JSON.stringify(certData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POPIA_Audit_Certificate_${practice.practiceName.replace(/\s+/g, '_')}_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="py-7 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#FFE600]" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              POPIA Section 19 Cryptographic Audit Ledger
            </h1>
          </div>
          <p className="text-xs text-purple-200/75 mt-1">
            Automated immutable logging for {practice.practiceName} · Every biometric sign-in, verification, and export is SHA-256 chained
          </p>
        </div>

        <button
          onClick={handleDownloadFullAuditCertificate}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] rounded-xl shadow-[0_0_22px_-4px_rgba(0,245,212,0.5)] hover:opacity-95 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Official Audit Certificate (JSON)</span>
        </button>
      </div>

      {/* Summary Safeguards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="synth-glass glow-cyan p-5 rounded-3xl">
          <div className="text-xs text-purple-200/75">Total Audited Events</div>
          <div className="text-3xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] bg-clip-text text-transparent mt-1.5">
            {auditLogs.length}
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1">Immutable append-only ledger</p>
        </div>

        <div className="synth-glass glow-amber p-5 rounded-3xl">
          <div className="text-xs text-purple-200/75">Security Standard</div>
          <div className="text-xl font-extrabold bg-gradient-to-r from-[#FF6B35] to-[#FFE600] bg-clip-text text-transparent mt-1.5">
            POPIA Section 19
          </div>
          <p className="text-[11px] text-[#00F5D4] mt-1 font-medium">Technical & WebAuthn safeguards active</p>
        </div>

        <div className="synth-glass glow-magenta p-5 rounded-3xl">
          <div className="text-xs text-purple-200/75">Cryptographic Integrity</div>
          <div className="text-xl font-extrabold font-mono bg-gradient-to-r from-[#FF2A85] to-[#9D4EDD] bg-clip-text text-transparent mt-1.5">
            SHA-256 Chained
          </div>
          <p className="text-[11px] text-purple-200/70 mt-1">Zero-tamper verification</p>
        </div>
      </div>

      {/* Table Container */}
      <div className="synth-glass rounded-3xl overflow-hidden">
        
        {/* Search Toolbar */}
        <div className="p-4 border-b border-purple-400/15 bg-[#100723]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-purple-300/60 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail by action, operator, hash, or intake..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs synth-inset rounded-xl text-white placeholder:text-purple-300/45 focus:outline-none focus:border-[#00F5D4] focus:ring-2 focus:ring-[#00F5D4]/20"
            />
          </div>
          <span className="text-xs text-purple-200/75 font-mono tabular-nums">
            Showing {filteredLogs.length} events
          </span>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#120929]/90 text-purple-200/80 font-semibold border-b border-purple-400/20">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Audit Action</th>
                <th className="py-3.5 px-4">Operator / Subject</th>
                <th className="py-3.5 px-4">IP & Endpoint</th>
                <th className="py-3.5 px-4">Lawful Basis (POPIA)</th>
                <th className="py-3.5 px-4">SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-400/10 font-sans">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-purple-500/10 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-purple-200/75 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-ZA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`font-bold font-mono text-[11px] ${
                      log.action.includes('WEBAUTHN') || log.action.includes('BIOMETRIC')
                        ? 'text-[#00F5D4]'
                        : log.action.includes('ACTION_REQUIRED') || log.action.includes('AGING')
                        ? 'text-[#FF6B35]'
                        : log.action.includes('EXPORT') || log.action.includes('BULK')
                        ? 'text-[#FFE600]'
                        : 'text-[#FF6BD6]'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-white font-medium">
                    {log.performedBy}
                  </td>
                  <td className="py-3.5 px-4 text-purple-200/70 text-[11px] max-w-[200px] truncate" title={log.userAgent}>
                    <span className="font-mono">{log.ipAddress}</span>
                  </td>
                  <td className="py-3.5 px-4 text-purple-100/85 text-[11px] max-w-[240px]">
                    {log.popiaLawfulBasis}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-purple-200/75">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[120px] select-all">{log.hash}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyHash(log.hash)}
                        className="text-purple-300/70 hover:text-[#00F5D4] cursor-pointer p-1 rounded"
                        title="Copy full SHA-256 hash"
                      >
                        {copiedHash === log.hash ? (
                          <Check className="w-3.5 h-3.5 text-[#00F5D4]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
