import React, { useState } from 'react';
import {
  X,
  Mail,
  Send,
  Copy,
  Check,
  Sparkles,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  PracticeProfile,
  ClientIntake,
  EmailDeliverabilityReport,
  MicrosoftConnectionStatus
} from '../types';
import { sendMagicLinkEmail } from '../firebase';
import { checkEmailDeliverability } from '../utils/emailDeliverability';
import {
  sendMagicLinkViaGmail,
  sendMagicLinkViaOutlook
} from '../utils/workspaceAutomation';

interface MagicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePractice: PracticeProfile;
  intakes: ClientIntake[];
  onOpenIntakeDirectly: (intake: ClientIntake) => void;
  onCreateDraftIntake?: (intake: ClientIntake) => Promise<void> | void;
  googleConnected?: boolean;
  googleAccessToken?: string | null;
  officerEmail?: string;
  officerName?: string;
  microsoftStatus?: MicrosoftConnectionStatus;
  onConnectGoogle?: () => Promise<string | null>;
  onConnectMicrosoft?: () => Promise<void>;
  onMagicLinkDispatched?: (channel: 'gmail' | 'outlook', recipientEmail: string) => void;
}

export const MagicLinkModal: React.FC<MagicLinkModalProps> = ({
  isOpen,
  onClose,
  activePractice,
  intakes,
  onOpenIntakeDirectly,
  onCreateDraftIntake,
  googleConnected = false,
  googleAccessToken = null,
  officerEmail,
  officerName,
  microsoftStatus,
  onConnectGoogle,
  onConnectMicrosoft,
  onMagicLinkDispatched,
}) => {
  const [email, setEmail] = useState('');
  const [selectedIntakeId, setSelectedIntakeId] = useState<string>('new');
  const [isSending, setIsSending] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Anti-spam DNS SPF/DMARC deliverability audit & 1st-party mailbox delivery state
  const [deliverability, setDeliverability] = useState<EmailDeliverabilityReport | null>(null);
  const [isCheckingDns, setIsCheckingDns] = useState(false);
  const [pendingConfirmChannel, setPendingConfirmChannel] = useState<'gmail' | 'outlook' | null>(null);
  const [isDispatchingEmail, setIsDispatchingEmail] = useState(false);
  const [dispatchedNotice, setDispatchedNotice] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  if (!isOpen) return null;

  const senderEmail = officerEmail || activePractice.adminEmail;
  const senderName = officerName || activePractice.ficaOfficerName;
  const emailSubject = `Secure FICA Verification Link — ${activePractice.practiceName}`;

  const runDeliverabilityAudit = async (urlOverride?: string) => {
    setIsCheckingDns(true);
    setDispatchError(null);
    try {
      const report = await checkEmailDeliverability({
        senderEmail,
        recipientEmail: email || undefined,
        subject: emailSubject,
        actionUrl: urlOverride || generatedLink || window.location.origin,
      });
      setDeliverability(report);
    } catch (err) {
      setDispatchError(
        err instanceof Error ? err.message : 'Unable to query DNS SPF/DMARC records.'
      );
    } finally {
      setIsCheckingDns(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSending(true);
    setDispatchedNotice(null);
    setDispatchError(null);
    try {
      const targetIntake = intakes.find((i) => i.id === selectedIntakeId);
      const intakeIdParam = targetIntake ? targetIntake.id : undefined;

      const link = await sendMagicLinkEmail(email, activePractice.id, intakeIdParam);
      setGeneratedLink(link);
      await runDeliverabilityAudit(link);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleRequestChannelSend = async (channel: 'gmail' | 'outlook') => {
    setDispatchError(null);
    setDispatchedNotice(null);
    if (channel === 'gmail' && (!googleConnected || !googleAccessToken)) {
      if (onConnectGoogle) {
        const tok = await onConnectGoogle();
        if (!tok) return;
      }
    }
    if (channel === 'outlook' && !microsoftStatus?.connected) {
      if (onConnectMicrosoft) {
        try {
          await onConnectMicrosoft();
        } catch (err) {
          setDispatchError(err instanceof Error ? err.message : 'Microsoft sign-in required.');
          return;
        }
      }
    }
    setPendingConfirmChannel(channel);
  };

  const handleExecuteConfirmedSend = async () => {
    if (!pendingConfirmChannel || !generatedLink || !email) return;
    setIsDispatchingEmail(true);
    setDispatchError(null);

    const matchedIntake = intakes.find(
      (i) => i.clientEmail.toLowerCase() === email.toLowerCase()
    );

    try {
      if (pendingConfirmChannel === 'gmail') {
        let token = googleAccessToken;
        if (!token && onConnectGoogle) {
          token = await onConnectGoogle();
        }
        if (!token) {
          throw new Error('Google Workspace OAuth access token is required to send via Gmail.');
        }
        await sendMagicLinkViaGmail({
          accessToken: token,
          fromEmail: senderEmail,
          fromName: senderName,
          toEmail: email,
          clientName: matchedIntake?.clientName,
          practiceName: activePractice.practiceName,
          magicUrl: generatedLink,
        });
        setDispatchedNotice(
          `Magic link delivered directly from authenticated Gmail (${senderEmail}) using balanced RFC-5322 multipart/alternative formatting.`
        );
        onMagicLinkDispatched?.('gmail', email);
      } else {
        const res = await sendMagicLinkViaOutlook({
          toEmail: email,
          clientName: matchedIntake?.clientName,
          practiceName: activePractice.practiceName,
          magicUrl: generatedLink,
        });
        setDispatchedNotice(
          `Magic link delivered directly from authenticated Microsoft 365 Outlook (${res.senderEmail || senderEmail}) to avoid shared-relay spam filtering.`
        );
        onMagicLinkDispatched?.('outlook', email);
      }
      setPendingConfirmChannel(null);
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Authenticated email send failed.');
    } finally {
      setIsDispatchingEmail(false);
    }
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLaunchInPortal = async () => {
    const existing = intakes.find((i) => i.clientEmail.toLowerCase() === email.toLowerCase());
    if (existing) {
      onOpenIntakeDirectly(existing);
      onClose();
    } else {
      const newIntake: ClientIntake = {
        id: `intake-za-${Date.now().toString().slice(-6)}`,
        practiceId: activePractice.id,
        clientEmail: email,
        clientName: email.split('@')[0].replace(/[._]/g, ' ').toUpperCase(),
        clientType: 'individual',
        phone: '+27 82 000 0000',
        idNumber: '',
        status: 'draft',
        popiaConsent: false,
        currentStep: 1,
        magicLinkToken: 'token_' + Math.random().toString(36).substring(2, 8),
        riskRating: 'low',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (onCreateDraftIntake) {
        await onCreateDraftIntake(newIntake);
      }
      onOpenIntakeDirectly(newIntake);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060211]/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="synth-glass rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-purple-400/20 bg-gradient-to-r from-[#2B1252]/70 via-[#1C0E3B]/80 to-[#111538]/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF2A85] via-[#9D4EDD] to-[#00F5D4] flex items-center justify-center text-white shadow-[0_0_20px_-4px_rgba(255,42,133,0.65)]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Passwordless Magic Link &amp; Anti-Spam Dispatch
                </h3>
                <p className="text-xs text-purple-200/75">
                  Authenticated 1st-Party Delivery · SPF / DMARC Inbox Guard
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close magic link modal"
              className="p-1.5 text-purple-200/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Practice Context */}
          <div className="p-3.5 synth-inset rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-purple-300/70">Issuing Practice:</span>{' '}
              <span className="font-semibold text-white">{activePractice.practiceName}</span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-[#00F5D4]">
              Sender: {senderEmail}
            </span>
          </div>

          {/* Quick Pre-fills */}
          <div>
            <label className="block text-xs font-semibold text-purple-100 mb-2">
              Quick Select Existing South African Case:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {intakes.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEmail(item.clientEmail);
                    setSelectedIntakeId(item.id);
                  }}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    email === item.clientEmail
                      ? 'border-[#00F5D4]/60 bg-[#00F5D4]/12 text-white font-medium shadow-[0_0_18px_-6px_rgba(0,245,212,0.5)]'
                      : 'synth-inset border-purple-400/20 hover:border-purple-300/40 text-purple-100'
                  }`}
                >
                  <div className="font-semibold truncate">{item.clientName}</div>
                  <div className="text-[11px] text-purple-300/70 truncate">{item.clientEmail}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Email input form */}
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-purple-100 mb-1.5">
                Recipient Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-purple-300/60 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="e.g. client@domain.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm synth-inset rounded-xl text-white placeholder:text-purple-300/40 focus:outline-none focus:border-[#00F5D4] focus:ring-2 focus:ring-[#00F5D4]/20"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                disabled={isSending || !email}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-[#0B0518] bg-gradient-to-r from-[#FF2A85] via-[#FF6B35] to-[#FFE600] hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer shadow-[0_0_24px_-4px_rgba(255,42,133,0.6)]"
              >
                {isSending ? (
                  <span>Generating &amp; Auditing...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Generate Inbox-Safe Magic Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isCheckingDns}
                onClick={() => runDeliverabilityAudit()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#00F5D4] synth-inset border border-[#00F5D4]/35 hover:bg-[#00F5D4]/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isCheckingDns ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>Verify SPF / DMARC</span>
              </button>
            </div>
          </form>

          {/* DNS SPF/DMARC & Spam Content Audit Panel */}
          {deliverability && (
            <div className="p-4 synth-inset rounded-2xl border border-[#4CC9F0]/35 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#00F5D4]" />
                  <span>Anti-Spam &amp; DNS Alignment ({deliverability.domain})</span>
                </span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    deliverability.contentScore >= 80
                      ? 'text-[#00F5D4]'
                      : deliverability.contentScore >= 60
                        ? 'text-[#FFE600]'
                        : 'text-[#FF2A85]'
                  }`}
                >
                  Score: {deliverability.contentScore}/100
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-[#0B0518]/75 border border-purple-400/15">
                  <div className="text-purple-300/70">MX Hosts</div>
                  <div className={deliverability.hasMx ? 'text-[#00F5D4] font-bold' : 'text-[#FF2A85] font-bold'}>
                    {deliverability.hasMx ? `${deliverability.mxHosts.length} Active` : 'Missing'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#0B0518]/75 border border-purple-400/15">
                  <div className="text-purple-300/70">SPF TXT</div>
                  <div className={deliverability.spfValid ? 'text-[#00F5D4] font-bold' : 'text-[#FFE600] font-bold'}>
                    {deliverability.spfValid ? 'Verified' : 'Unpublished'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#0B0518]/75 border border-purple-400/15">
                  <div className="text-purple-300/70">DMARC</div>
                  <div className={deliverability.dmarcValid ? 'text-[#00F5D4] font-bold' : 'text-[#FFE600] font-bold'}>
                    {deliverability.dmarcValid ? `p=${deliverability.dmarcPolicy || 'set'}` : 'Not Found'}
                  </div>
                </div>
              </div>

              {deliverability.warnings.length > 0 && (
                <div className="text-[11px] text-[#FFE600] space-y-1">
                  {deliverability.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[11px] text-purple-200/80 leading-relaxed">
                {deliverability.recommendations[0]}
              </div>
            </div>
          )}

          {/* Result Link + First-Party Direct Email Sending */}
          {generatedLink && (
            <div className="p-4 bg-[#00F5D4]/10 rounded-2xl border border-[#00F5D4]/40 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-[#99FFF1] text-xs font-semibold">
                <Check className="w-4 h-4 text-[#00F5D4]" />
                <span>Magic Link Active · Send From Your Verified Practice Mailbox to Bypass Spam</span>
              </div>

              <div className="p-2.5 synth-inset rounded-xl font-mono text-[11px] text-purple-100 break-all select-all">
                {generatedLink}
              </div>

              {/* Direct Gmail / Outlook 365 Send Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleRequestChannelSend('gmail')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white synth-inset border border-[#4CC9F0]/45 hover:bg-[#4CC9F0]/15 rounded-xl transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-[#4CC9F0]" />
                  <span>
                    {googleConnected
                      ? 'Send via Authenticated Gmail'
                      : 'Connect & Send via Gmail'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRequestChannelSend('outlook')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white synth-inset border border-[#00F5D4]/45 hover:bg-[#00F5D4]/15 rounded-xl transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-[#00F5D4]" />
                  <span>
                    {microsoftStatus?.connected
                      ? 'Send via Authenticated Outlook'
                      : 'Connect & Send via Outlook'}
                  </span>
                </button>
              </div>

              {/* Explicit In-App Confirmation Box Before Calling Mail Send API */}
              {pendingConfirmChannel && (
                <div className="p-3 rounded-xl bg-[#0B0518]/90 border border-[#FFE600]/45 space-y-2 text-xs">
                  <div className="font-bold text-[#FFE600]">
                    Confirm 1st-Party Dispatch ({pendingConfirmChannel === 'gmail' ? 'Gmail API' : 'Microsoft Outlook Graph'})
                  </div>
                  <div className="text-[11px] text-purple-100/90 space-y-0.5 font-mono">
                    <div>From: {senderEmail}</div>
                    <div>To: {email}</div>
                    <div>Subject: {emailSubject}</div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingConfirmChannel(null)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-purple-200 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDispatchingEmail}
                      onClick={handleExecuteConfirmedSend}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-extrabold text-[#0B0518] bg-[#00F5D4] hover:opacity-95 cursor-pointer disabled:opacity-50"
                    >
                      {isDispatchingEmail ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3" />
                          <span>Confirm &amp; Send Email Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {dispatchedNotice && (
                <div className="p-2.5 rounded-xl bg-[#00F5D4]/15 border border-[#00F5D4]/45 text-[11px] text-[#99FFF1] flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
                  <span>{dispatchedNotice}</span>
                </div>
              )}

              {dispatchError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/45 text-[11px] text-rose-100 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#FF2A85] shrink-0 mt-0.5" />
                  <span>{dispatchError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-100 synth-inset rounded-xl hover:border-purple-300/40 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#00F5D4]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLaunchInPortal}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0B0518] bg-gradient-to-r from-[#00F5D4] to-[#4CC9F0] rounded-xl transition-opacity hover:opacity-95 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Launch Client Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Anti-Spam & POPIA Notice */}
          <div className="flex items-start gap-2 text-[11px] text-purple-200/70 pt-2 border-t border-purple-400/15">
            <ShieldCheck className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Anti-Spam &amp; POPIA Safeguard:</strong> Magic links expire in 24 hours. Dispatching via authenticated Gmail / Microsoft 365 (or Firebase Custom SMTP + DKIM) prevents default relay quarantine.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
