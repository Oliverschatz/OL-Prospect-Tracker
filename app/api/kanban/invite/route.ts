import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createMailer, wrapHtml } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  // Authenticate via bearer token.
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectId: string = (body.projectId || '').toString();
  const email: string = (body.email || '').toString().trim().toLowerCase();
  if (!projectId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // The requester must own the project they're inviting to.
  const { data: project } = await admin
    .from('kanban_projects')
    .select('id, name, owner_id')
    .eq('id', projectId)
    .single();
  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const mailer = createMailer();
  if (!mailer) return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });

  const inviterName = user.user_metadata?.full_name || user.email || 'A colleague';
  const origin = (body.appUrl || req.headers.get('origin') || '').toString().replace(/\/$/, '');
  const link = `${origin}/kanban`;

  const text =
    `${inviterName} has invited you to collaborate on the Kanban project "${project.name}".\n\n` +
    `You have full access to view and edit the project's cards.\n\n` +
    `Open the board and sign in (or register) with this email address — ${email} — to get started:\n` +
    `${link}\n\n` +
    `The project will appear automatically once you log in with this address.`;

  try {
    await mailer.transporter.sendMail({
      from: mailer.fromEmail,
      to: email,
      replyTo: user.email || undefined,
      subject: `You've been invited to the Kanban project "${project.name}"`,
      html: wrapHtml('Kanban Invitation', text),
      text,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
