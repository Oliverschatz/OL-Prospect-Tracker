import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import type { Invoice, SellerSettings } from '@/lib/invoice-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchLogo(url: string): Promise<Uint8Array | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
}

async function authUser(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return null;
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user;
}

export async function POST(req: NextRequest) {
  const user = await authUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const invoice = body.invoice as Invoice;
  const seller = body.seller as SellerSettings;
  if (!invoice || !seller) return NextResponse.json({ error: 'Missing invoice/seller' }, { status: 400 });

  const logoBytes = await fetchLogo(seller.logo_url);
  try {
    const pdf = await generateInvoicePdf(invoice, seller, { logoBytes });
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rechnung_${invoice.invoice_number || invoice.id}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `PDF generation failed: ${(e as Error).message}` }, { status: 500 });
  }
}
