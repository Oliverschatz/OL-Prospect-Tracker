import nodemailer, { Transporter } from 'nodemailer';

export interface MailerConfig {
  transporter: Transporter;
  fromEmail: string;
}

export function createMailer(): MailerConfig | null {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM || 'Prospect Tracker <noreply@oliverlehmann.com>';

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  return { transporter, fromEmail };
}

// Convert a plain-text body into a simple branded HTML email.
export function wrapHtml(subject: string, bodyText: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const htmlBody = safe(bodyText)
    .replace(/\r?\n/g, '<br>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1a4fa0">$1</a>');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Source Sans 3',-apple-system,sans-serif;color:#2d3748;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1a2744;color:white;padding:16px 24px;border-radius:6px 6px 0 0">
    <h1 style="font-family:Georgia,serif;font-size:18px;margin:0">
      Prospect Tracker <span style="color:#e8a838;font-weight:400">— ${safe(subject)}</span>
    </h1>
  </div>
  <div style="border:1px solid #d8dde6;border-top:none;padding:24px;border-radius:0 0 6px 6px;font-size:14px;line-height:1.6">
    ${htmlBody}
    <p style="font-size:11px;color:#718096;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
      Oliver F. Lehmann · Project Business Training · OliverLehmann.com
    </p>
  </div>
</body>
</html>`;
}

export function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\[([A-Za-z][A-Za-z0-9_]*)\]/g, (_match, key: string) => {
    return vars[key] ?? `[${key}]`;
  });
}
