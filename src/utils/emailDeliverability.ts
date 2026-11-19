import { EmailDeliverabilityReport } from '../types';

export interface ComposedDeliverableEmail {
  subject: string;
  textBody: string;
  htmlBody: string;
  rawRfc2822Base64Url: string;
  spamRiskWarnings: string[];
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Inspects subject & body for common spam-filter triggers (ALL CAPS, excessive exclamation marks,
 * URL shorteners, missing plain-text balance) before sending.
 */
export function auditEmailSpamSignals(subject: string, bodyText: string, actionUrl?: string): string[] {
  const warnings: string[] = [];

  if (/[!]{2,}/.test(subject) || /[!]{2,}/.test(bodyText)) {
    warnings.push('Repeated exclamation marks ("!!") can trigger heuristic spam filters.');
  }

  const lettersOnly = subject.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length > 8 && lettersOnly === lettersOnly.toUpperCase()) {
    warnings.push('All-caps subject lines are flagged by Exchange Online Protection and Gmail.');
  }

  if (/\b(act now|urgent action immediately|click here immediately|free money|winner)\b/i.test(subject + ' ' + bodyText)) {
    warnings.push('Aggressive call-to-action phrasing increases bulk/spam classification risk.');
  }

  if (actionUrl && /(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly)/i.test(actionUrl)) {
    warnings.push('URL shorteners in compliance emails frequently fail corporate spam gateways.');
  }

  if (bodyText.trim().length < 120) {
    warnings.push('Very short email bodies with a link have a high link-to-text ratio.');
  }

  return warnings;
}

/**
 * Builds an RFC-5322 multipart/alternative email structured for maximum inbox placement:
 * - Balanced text/plain + semantic text/html parts (required by corporate gateways & Mimecast/Proofpoint)
 * - Clean transactional headers (Reply-To aligned with officer, MIME-Version 1.0, valid Message-ID)
 * - No URL shorteners, tracking pixels, or spammy formatting
 */
export function buildDeliverableTransactionalEmail(params: {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  replyToEmail?: string;
  subject: string;
  heading: string;
  introParagraph: string;
  bulletItems: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  practiceName: string;
  footerNote: string;
}): ComposedDeliverableEmail {
  const {
    fromEmail,
    fromName,
    toEmail,
    replyToEmail,
    subject,
    heading,
    introParagraph,
    bulletItems,
    ctaLabel,
    ctaUrl,
    practiceName,
    footerNote,
  } = params;

  const textLines: string[] = [
    `${practiceName}`,
    ``,
    heading,
    `${'-'.repeat(Math.min(60, heading.length))}`,
    ``,
    introParagraph,
    ``,
    ...bulletItems.map((item, i) => `${i + 1}. ${item}`),
  ];

  if (ctaUrl) {
    textLines.push(
      ``,
      `${ctaLabel || 'Open Client Portal'}:`,
      ctaUrl
    );
  }

  textLines.push(
    ``,
    `--`,
    footerNote,
    `Sent directly by ${fromName} (${fromEmail}) via ${practiceName}.`
  );

  const textBody = textLines.join('\r\n');

  const bulletHtml = bulletItems
    .map(
      (item) =>
        `<li style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; line-height: 1.5;">${escapeHtml(item)}</li>`
    )
    .join('');

  const ctaHtml = ctaUrl
    ? `<div style="margin: 24px 0;">
         <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 8px;">
           ${escapeHtml(ctaLabel || 'Access Secure Portal')}
         </a>
         <p style="margin: 10px 0 0 0; font-size: 12px; color: #475569; word-break: break-all;">
           Direct portal URL: <a href="${escapeHtml(ctaUrl)}" style="color: #0284c7;">${escapeHtml(ctaUrl)}</a>
         </p>
       </div>`
    : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px;">
    <div style="font-size: 12px; font-weight: 600; color: #0284c7; margin-bottom: 8px;">${escapeHtml(practiceName)} · FICA &amp; POPIA Compliance</div>
    <h1 style="margin: 0 0 14px 0; font-size: 18px; line-height: 1.35; color: #0f172a;">${escapeHtml(heading)}</h1>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">${escapeHtml(introParagraph)}</p>
    ${bulletItems.length > 0 ? `<ul style="margin: 0 0 16px 0; padding-left: 20px;">${bulletHtml}</ul>` : ''}
    ${ctaHtml}
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 22px 0 14px 0;" />
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
      ${escapeHtml(footerNote)}<br/>
      Issued by ${escapeHtml(fromName)} (${escapeHtml(fromEmail)})
    </p>
  </div>
</body>
</html>`;

  const domainPart = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'clientonboard.co.za';
  const boundary = `coai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2, 10)}@${domainPart}>`;

  const rfc2822Lines = [
    `From: "${fromName.replace(/"/g, '')}" <${fromEmail}>`,
    `To: <${toEmail}>`,
    `Reply-To: <${replyToEmail || fromEmail}>`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Language: en-ZA`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    textBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
  ];

  const spamRiskWarnings = auditEmailSpamSignals(subject, textBody, ctaUrl);

  return {
    subject,
    textBody,
    htmlBody,
    rawRfc2822Base64Url: toBase64UrlUtf8(rfc2822Lines.join('\r\n')),
    spamRiskWarnings,
  };
}

/**
 * Queries the backend DNS deliverability endpoint to verify live SPF, DMARC, and MX
 * records for the practice's sending domain so magic links avoid spam folders.
 */
export async function checkEmailDeliverability(params: {
  senderEmail: string;
  recipientEmail?: string;
  subject?: string;
  actionUrl?: string;
}): Promise<EmailDeliverabilityReport> {
  const res = await fetch('/api/email/deliverability-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error('Failed to check DNS SPF/DMARC deliverability records');
  }

  return res.json();
}
