import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import type { Invoice, SellerSettings } from '@/lib/invoice-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Attachment { filename: string; contentBase64: string; contentType?: string }

async function fetchLogo(url: string): Promise<Uint8Array | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try { const r = await fetch(url); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; }
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const invoice = body.invoice as Invoice;
  const seller = body.seller as SellerSettings;
  const to = String(body.to || '').trim();
  const cc = String(body.cc || '').trim();
  const subject = String(body.subject || '').slice(0, 300);
  const text = String(body.message || '').slice(0, 20000);
  const extra = (Array.isArray(body.attachments) ? body.attachments : []) as Attachment[];
  if (!invoice || !seller) return NextResponse.json({ error: 'Missing invoice/seller' }, { status: 400 });
  if (!to) return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM || 'Prospect Tracker <noreply@oliverlehmann.com>';
  if (!smtpHost || !smtpUser || !smtpPass) return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 });

  // Generate the ZUGFeRD invoice PDF server-side and attach it.
  let pdfBuffer: Buffer;
  try {
    const logoBytes = await fetchLogo(seller.logo_url);
    pdfBuffer = Buffer.from(await generateInvoicePdf(invoice, seller, { logoBytes }));
  } catch (e) {
    return NextResponse.json({ error: `PDF generation failed: ${(e as Error).message}` }, { status: 500 });
  }

  const attachments = [
    { filename: `Rechnung_${invoice.invoice_number || invoice.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
    ...extra
      .filter(a => a && a.filename && a.contentBase64)
      .map(a => ({ filename: a.filename, content: Buffer.from(a.contentBase64, 'base64'), contentType: a.contentType || undefined })),
  ];

  const transporter = nodemailer.createTransport({
    host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: fromEmail,
      to,
      cc: cc || undefined,
      replyTo: seller.email || undefined,
      subject: subject || `${invoice.language === 'en' ? 'Invoice' : 'Rechnung'} ${invoice.invoice_number}`,
      text: text || undefined,
      attachments,
    });
  } catch (e) {
    return NextResponse.json({ error: `Send failed: ${(e as Error).message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
