import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import nodemailer from 'nodemailer';

// Vercel Cron calls this once daily at 6:00 AM UTC (8:00 AM CET), Mon-Fri.
// Sends follow-up digest to all opted-in users.

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  // SMTP config
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

  const now = new Date();

  // Get all users with daily_email enabled
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, timezone, daily_email')
    .eq('daily_email', true);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No users opted in' });
  }

  // Get user emails
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers();
  const emailMap: Record<string, { email: string; name: string }> = {};
  for (const u of authUsers) {
    emailMap[u.id] = { email: u.email || '', name: u.user_metadata?.full_name || '' };
  }

  let sent = 0;

  for (const profile of profiles) {
    const tz = profile.timezone || 'Europe/Berlin';
    const userInfo = emailMap[profile.id];
    if (!userInfo?.email) continue;

    // Get today's date in user's timezone
    let todayStr: string;
    try {
      const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: tz });
      todayStr = dateFormatter.format(now);
    } catch {
      continue;
    }

    // Tomorrow's date
    const tomorrow = new Date(now.getTime() + 86400000);
    let tomorrowStr: string;
    try {
      const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: tz });
      tomorrowStr = dateFormatter.format(tomorrow);
    } catch {
      continue;
    }

    // Fetch user's companies with follow-up dates (service role bypasses RLS)
    const { data: companies } = await admin
      .from('companies')
      .select('name, follow_up_date, next_action, stage')
      .eq('user_id', profile.id)
      .not('follow_up_date', 'is', null)
      .order('follow_up_date');

    if (!companies || companies.length === 0) continue;

    const overdue = companies.filter(c => c.follow_up_date < todayStr && c.stage !== 'won' && c.stage !== 'lost');
    const dueToday = companies.filter(c => c.follow_up_date === todayStr);
    const dueTomorrow = companies.filter(c => c.follow_up_date === tomorrowStr);

    if (overdue.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0) continue;

    // Build and send email
    const html = buildEmailHtml(userInfo.name, overdue, dueToday, dueTomorrow, todayStr);
    try {
      await transporter.sendMail({
        from: fromEmail,
        to: userInfo.email,
        subject: buildSubject(overdue.length, dueToday.length, dueTomorrow.length),
        html,
      });
      sent++;
    } catch {
      // Continue with other users
    }
  }

  return NextResponse.json({ sent, checked: profiles.length });
}

function buildSubject(overdue: number, today: number, tomorrow: number): string {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (today > 0) parts.push(`${today} due today`);
  if (tomorrow > 0) parts.push(`${tomorrow} due tomorrow`);
  return `Prospect Tracker: ${parts.join(', ')}`;
}

interface FollowUp {
  name: string;
  follow_up_date: string;
  next_action: string;
  stage: string;
}

function buildEmailHtml(userName: string, overdue: FollowUp[], dueToday: FollowUp[], dueTomorrow: FollowUp[], todayStr: string): string {
  const renderList = (items: FollowUp[], color: string) => items.map(c =>
    `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600">${c.name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:${color}">${c.follow_up_date}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:#718096">${c.next_action || '—'}</td>
    </tr>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Source Sans 3',-apple-system,sans-serif;color:#2d3748;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1a2744;color:white;padding:16px 24px;border-radius:6px 6px 0 0">
    <h1 style="font-family:Georgia,serif;font-size:18px;margin:0">
      Prospect Tracker <span style="color:#e8a838;font-weight:400">— Daily Follow-ups</span>
    </h1>
  </div>
  <div style="border:1px solid #d8dde6;border-top:none;padding:24px;border-radius:0 0 6px 6px">
    <p style="font-size:14px;margin-bottom:16px">
      Good morning${userName ? ` ${userName}` : ''}! Here are your follow-ups for ${todayStr}:
    </p>

    ${overdue.length > 0 ? `
    <h3 style="color:#c53030;font-size:14px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em">
      Overdue (${overdue.length})
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${renderList(overdue, '#c53030')}
    </table>` : ''}

    ${dueToday.length > 0 ? `
    <h3 style="color:#d69e2e;font-size:14px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em">
      Due Today (${dueToday.length})
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${renderList(dueToday, '#d69e2e')}
    </table>` : ''}

    ${dueTomorrow.length > 0 ? `
    <h3 style="color:#2c5282;font-size:14px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em">
      Due Tomorrow (${dueTomorrow.length})
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${renderList(dueTomorrow, '#2c5282')}
    </table>` : ''}

    <p style="font-size:12px;color:#718096;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
      You can opt out of these emails in Settings > Daily Follow-up Email.
      <br>Oliver F. Lehmann · OliverLehmann.com
    </p>
  </div>
</body>
</html>`;
}
