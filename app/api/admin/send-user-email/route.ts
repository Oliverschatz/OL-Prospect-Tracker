import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/verify-admin';
import { createMailer, wrapHtml, fillPlaceholders } from '@/lib/mailer';

// POST /api/admin/send-user-email
// Body: { user_id, subject, body, vars? }
// Sends a one-off email to a single brand ambassador using nodemailer.
export async function POST(req: NextRequest) {
  const caller = await verifyAdmin(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { user_id, subject, body, vars } = await req.json();
  if (!user_id || !subject || !body) {
    return NextResponse.json({ error: 'user_id, subject, body required' }, { status: 400 });
  }

  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(user_id);
  if (userErr || !userRes?.user?.email) {
    return NextResponse.json({ error: userErr?.message || 'User not found' }, { status: 404 });
  }
  const target = userRes.user;

  // Pull the ambassador's personal code so [Code] can be substituted.
  const { data: profile } = await admin
    .from('profiles')
    .select('ambassador_code')
    .eq('id', target.id)
    .maybeSingle();

  const mailer = createMailer();
  if (!mailer) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });
  }

  const mergedVars: Record<string, string> = {
    FullName: target.user_metadata?.full_name || target.email || '',
    Email: target.email || '',
    LoginUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.oliverlehmann.com',
    AdminName: caller.user_metadata?.full_name || caller.email || 'Admin',
    Code: profile?.ambassador_code || '',
    ...(vars || {}),
  };

  const finalSubject = fillPlaceholders(subject, mergedVars);
  const finalBody = fillPlaceholders(body, mergedVars);

  try {
    await mailer.transporter.sendMail({
      from: mailer.fromEmail,
      to: target.email!,
      subject: finalSubject,
      text: finalBody,
      html: wrapHtml(finalSubject, finalBody),
    });
    return NextResponse.json({ ok: true, to: target.email });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message || 'Failed to send' }, { status: 500 });
  }
}
