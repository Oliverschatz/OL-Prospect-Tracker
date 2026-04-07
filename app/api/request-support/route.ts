import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  // Authenticate via bearer token
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message: string = (body.message || '').toString().slice(0, 5000);

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM || 'Prospect Tracker <noreply@oliverlehmann.com>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const userName = user.user_metadata?.full_name || '';
  const userEmail = user.email || '';

  const html = `
<!DOCTYPE html>
<html><body style="font-family:'Source Sans 3',-apple-system,sans-serif;color:#2d3748;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1a2744;color:white;padding:16px 24px;border-radius:6px 6px 0 0">
    <h1 style="font-family:Georgia,serif;font-size:18px;margin:0">
      Prospect Tracker <span style="color:#e8a838;font-weight:400">— Sales Support Request</span>
    </h1>
  </div>
  <div style="border:1px solid #d8dde6;border-top:none;padding:24px;border-radius:0 0 6px 6px">
    <p style="font-size:14px;margin:0 0 12px"><strong>${userName || userEmail}</strong> is requesting sales support.</p>
    <table style="font-size:13px;margin-bottom:16px">
      <tr><td style="padding:4px 12px 4px 0;color:#718096">Name</td><td>${userName || '—'}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#718096">Email</td><td><a href="mailto:${userEmail}">${userEmail}</a></td></tr>
    </table>
    ${message ? `<div style="background:#f7fafc;border-left:3px solid #e8a838;padding:12px 16px;font-size:13px;white-space:pre-wrap">${message.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c))}</div>` : ''}
  </div>
</body></html>`;

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: 'oliver@oliverlehmann.com',
      replyTo: userEmail || undefined,
      subject: `Sales support requested by ${userName || userEmail}`,
      html,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
