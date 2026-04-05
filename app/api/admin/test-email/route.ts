import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const admin = createAdminClient();
  if (!admin) return null;
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return null;

  return user;
}

// POST /api/admin/test-email — send a test email to the admin
export async function POST(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM || 'Prospect Tracker <noreply@oliverlehmann.com>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json({ error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel env vars.' }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: user.email!,
      subject: 'Prospect Tracker — Test Email',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;color:#2d3748;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1a2744;color:white;padding:16px 24px;border-radius:6px 6px 0 0">
    <h1 style="font-family:Georgia,serif;font-size:18px;margin:0">
      Prospect Tracker <span style="color:#e8a838;font-weight:400">— Test Email</span>
    </h1>
  </div>
  <div style="border:1px solid #d8dde6;border-top:none;padding:24px;border-radius:0 0 6px 6px">
    <p style="font-size:14px">This is a test email from the Prospect Tracker.</p>
    <p style="font-size:14px">If you're reading this, SMTP is configured correctly!</p>
    <p style="font-size:12px;color:#718096;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
      SMTP Host: ${smtpHost}:${smtpPort}<br>
      From: ${fromEmail}<br>
      To: ${user.email}
    </p>
  </div>
</body>
</html>`,
    });
    return NextResponse.json({ ok: true, to: user.email });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message || 'Failed to send' }, { status: 500 });
  }
}
