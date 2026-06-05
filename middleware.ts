import { NextRequest, NextResponse } from 'next/server';

// Serve the invoicing app at the root of the invoicing.* subdomain
// (e.g. invoicing.oliverlehmann.com/ → /invoices), while the main domain
// keeps the tracker at "/". Only the root path is matched (see config).
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').toLowerCase();
  if (host.startsWith('invoicing.')) {
    const url = req.nextUrl.clone();
    url.pathname = '/invoices';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/'] };
