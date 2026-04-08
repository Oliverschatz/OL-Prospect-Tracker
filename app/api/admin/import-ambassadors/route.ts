import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/verify-admin';
import { createMailer } from '@/lib/mailer';
import { listAllUsers } from '@/lib/list-all-users';
import { sendWelcomeEmail, callerDisplayName } from '@/lib/welcome-email';

// Larger imports will hit Vercel's default 10s limit on Hobby.
export const maxDuration = 300;

interface ImportRow {
  name: string;
  email: string;
  location: string;
  country: string;
  linkedin: string;
}

interface RowResult {
  email: string;
  status: 'created' | 'updated' | 'error';
  error?: string;
  email_sent?: boolean;
  email_error?: string;
}

function generateTempPassword(): string {
  // 12 random bytes → 16-char URL-safe string
  return randomBytes(12).toString('base64url');
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// POST /api/admin/import-ambassadors
// Body: { rows: ImportRow[], send_welcome: boolean }
export async function POST(req: NextRequest) {
  const caller = await verifyAdmin(req);
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const body = await req.json();
  const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
  const sendWelcome = body?.send_welcome !== false;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }

  // Prepare mailer (only needed if we'll send welcomes)
  const mailer = sendWelcome ? createMailer() : null;
  if (sendWelcome && !mailer) {
    return NextResponse.json(
      { error: 'SMTP not configured — cannot send welcome emails. Uncheck the option or configure SMTP.' },
      { status: 500 }
    );
  }

  // Load the welcome template once
  let welcomeTemplate: { subject: string; body: string } | null = null;
  if (sendWelcome) {
    const { data, error } = await admin
      .from('admin_email_templates')
      .select('subject, body')
      .eq('slug', 'welcome')
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "No 'welcome' email template found in Email Templates." },
        { status: 500 }
      );
    }
    welcomeTemplate = { subject: data.subject, body: data.body };
  }

  // Build email → user map for duplicate detection
  let emailMap: Map<string, { id: string; user_metadata: Record<string, unknown> }>;
  try {
    const allUsers = await listAllUsers(admin);
    emailMap = new Map();
    for (const u of allUsers) {
      if (u.email) {
        emailMap.set(u.email.toLowerCase().trim(), {
          id: u.id,
          user_metadata: (u.user_metadata as Record<string, unknown>) || {},
        });
      }
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const adminName = callerDisplayName(caller);
  const loginUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.oliverlehmann.com';

  const results: RowResult[] = [];
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const raw of rows) {
    const email = String(raw?.email || '').trim().toLowerCase();
    const name = String(raw?.name || '').trim();
    const location = String(raw?.location || '').trim();
    const country = String(raw?.country || '').trim();
    const linkedin = String(raw?.linkedin || '').trim();

    if (!email || !isValidEmail(email)) {
      results.push({ email: email || '(empty)', status: 'error', error: 'Invalid or missing email' });
      errors += 1;
      continue;
    }

    const existing = emailMap.get(email);

    try {
      if (existing) {
        // Update path — merge on top of existing metadata
        const mergedMeta = {
          ...existing.user_metadata,
          full_name: name || (existing.user_metadata.full_name as string | undefined) || '',
          location,
          country,
          linkedin,
        };
        const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
          user_metadata: mergedMeta,
        });
        if (upErr) throw upErr;
        results.push({ email, status: 'updated' });
        updated += 1;
      } else {
        // Create path — generate temp password, create user, send welcome email
        const tempPassword = generateTempPassword();
        const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: name, location, country, linkedin },
        });
        if (createErr || !createRes?.user) throw createErr || new Error('Create returned no user');

        // profiles row is created automatically by the on_auth_user_created trigger.

        const result: RowResult = { email, status: 'created' };
        if (sendWelcome && mailer && welcomeTemplate) {
          try {
            await sendWelcomeEmail({
              transporter: mailer.transporter,
              fromEmail: mailer.fromEmail,
              template: welcomeTemplate,
              targetEmail: email,
              fullName: name,
              tempPassword,
              loginUrl,
              adminName,
            });
            result.email_sent = true;
            // Throttle SMTP so we don't trip Host Europe limits
            await new Promise((r) => setTimeout(r, 100));
          } catch (mailErr: unknown) {
            result.email_sent = false;
            result.email_error = (mailErr as Error).message || 'Failed to send';
          }
        }
        results.push(result);
        created += 1;
      }
    } catch (e: unknown) {
      results.push({ email, status: 'error', error: (e as Error).message || 'Unknown error' });
      errors += 1;
    }
  }

  return NextResponse.json({
    total: rows.length,
    created,
    updated,
    errors,
    results,
  });
}
