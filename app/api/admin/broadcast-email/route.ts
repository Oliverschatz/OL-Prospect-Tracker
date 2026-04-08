import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/verify-admin';
import { createMailer, wrapHtml, fillPlaceholders } from '@/lib/mailer';
import { listAllUsers } from '@/lib/list-all-users';

// POST /api/admin/broadcast-email
// Body: { subject, body, include_admins? }
// Sends an email to every brand ambassador (every user).
// Admins are excluded by default (include_admins defaults to false).
export async function POST(req: NextRequest) {
  const caller = await verifyAdmin(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { subject, body, include_admins } = await req.json();
  if (!subject || !body) {
    return NextResponse.json({ error: 'subject, body required' }, { status: 400 });
  }

  const mailer = createMailer();
  if (!mailer) return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });

  // Pull every profile in one shot. We need two things:
  //   1. is_admin  — to optionally skip admins
  //   2. ambassador_code — so [Code] can be injected per recipient
  const { data: allProfiles } = await admin
    .from('profiles')
    .select('id, is_admin, ambassador_code');
  const adminIds = new Set<string>();
  const codeById = new Map<string, string | null>();
  for (const p of (allProfiles || []) as { id: string; is_admin: boolean | null; ambassador_code: string | null }[]) {
    if (p.is_admin) adminIds.add(p.id);
    codeById.set(p.id, p.ambassador_code ?? null);
  }

  // Page through all users.
  const recipients: { id: string; email: string; full_name: string }[] = [];
  let allUsers;
  try {
    allUsers = await listAllUsers(admin);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  for (const u of allUsers) {
    if (!u.email) continue;
    if (!include_admins && adminIds.has(u.id)) continue;
    if (u.banned_until) continue;
    recipients.push({
      id: u.id,
      email: u.email,
      full_name: (u.user_metadata as { full_name?: string } | null)?.full_name || '',
    });
  }

  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const r of recipients) {
    const vars: Record<string, string> = {
      FullName: r.full_name || r.email,
      Email: r.email,
      LoginUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.oliverlehmann.com',
      AdminName: caller.user_metadata?.full_name || caller.email || 'Admin',
      Code: codeById.get(r.id) || '',
    };
    const finalSubject = fillPlaceholders(subject, vars);
    const finalBody = fillPlaceholders(body, vars);
    try {
      await mailer.transporter.sendMail({
        from: mailer.fromEmail,
        to: r.email,
        subject: finalSubject,
        text: finalBody,
        html: wrapHtml(finalSubject, finalBody),
      });
      results.push({ email: r.email, ok: true });
    } catch (e: unknown) {
      results.push({ email: r.email, ok: false, error: (e as Error).message });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  return NextResponse.json({ ok: true, sent, failed, total: results.length, results });
}
