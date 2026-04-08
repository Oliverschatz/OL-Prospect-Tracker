import type { Transporter } from 'nodemailer';
import type { User } from '@supabase/supabase-js';
import { wrapHtml, fillPlaceholders } from './mailer';

export interface WelcomeTemplate {
  subject: string;
  body: string;
}

export interface SendWelcomeArgs {
  transporter: Transporter;
  fromEmail: string;
  template: WelcomeTemplate;
  targetEmail: string;
  fullName: string;
  tempPassword: string;
  loginUrl: string;
  adminName: string;
}

// Send the welcome email using the given template and target user data.
// Placeholder substitution happens here so both the single-invite flow and
// the bulk-import flow produce identical emails.
export async function sendWelcomeEmail(args: SendWelcomeArgs): Promise<void> {
  const vars: Record<string, string> = {
    FullName: args.fullName || args.targetEmail,
    Email: args.targetEmail,
    TempPassword: args.tempPassword,
    LoginUrl: args.loginUrl,
    AdminName: args.adminName,
  };

  const subject = fillPlaceholders(args.template.subject, vars);
  const body = fillPlaceholders(args.template.body, vars);

  await args.transporter.sendMail({
    from: args.fromEmail,
    to: args.targetEmail,
    subject,
    text: body,
    html: wrapHtml(subject, body),
  });
}

// Helper: extract the caller's friendly name from their Supabase user object.
export function callerDisplayName(caller: User): string {
  const meta = caller.user_metadata as { full_name?: string } | null;
  return meta?.full_name || caller.email || 'Admin';
}
