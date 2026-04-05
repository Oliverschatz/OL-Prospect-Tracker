import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

// POST /api/check-duplicate — check company name AND/OR contact across ambassadors
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { company_name, contact_name, contact_email } = await req.json();

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ duplicate: false });

  const warnings: string[] = [];

  // Check company name
  if (company_name) {
    const { data: companyMatches } = await admin
      .from('companies')
      .select('user_id')
      .ilike('name', company_name)
      .neq('user_id', user.id);

    if (companyMatches && companyMatches.length > 0) {
      const n = companyMatches.length;
      warnings.push(`Company "${company_name}" is already tracked by ${n} other ambassador${n > 1 ? 's' : ''}.`);
    }
  }

  // Check contact by email (most reliable match)
  if (contact_email) {
    const { data: emailMatches } = await admin
      .from('contacts')
      .select('user_id, name, company_id')
      .ilike('email', contact_email)
      .neq('user_id', user.id);

    if (emailMatches && emailMatches.length > 0) {
      // Look up the company names for context
      const companyIds = Array.from(new Set(emailMatches.map(m => m.company_id)));
      const { data: companies } = await admin
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      const companyNames = (companies || []).map(c => c.name).join(', ');
      warnings.push(`Contact "${contact_email}" is already known to another ambassador (at ${companyNames || 'unknown company'}).`);
    }
  }

  // Check contact by name (fuzzy — could be common names, so only if no email match)
  if (contact_name && !contact_email) {
    const { data: nameMatches } = await admin
      .from('contacts')
      .select('user_id, email, company_id')
      .ilike('name', contact_name)
      .neq('user_id', user.id);

    if (nameMatches && nameMatches.length > 0) {
      const companyIds = Array.from(new Set(nameMatches.map(m => m.company_id)));
      const { data: companies } = await admin
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      const companyNames = (companies || []).map(c => c.name).join(', ');
      warnings.push(`A contact named "${contact_name}" exists at another ambassador's prospect (${companyNames || 'unknown company'}).`);
    }
  }

  // If contact has both name and email, also check name separately for extra context
  if (contact_name && contact_email) {
    const { data: nameMatches } = await admin
      .from('contacts')
      .select('user_id, email, company_id')
      .ilike('name', contact_name)
      .neq('user_id', user.id)
      .not('email', 'ilike', contact_email); // Different email, same name

    if (nameMatches && nameMatches.length > 0) {
      warnings.push(`Note: another contact named "${contact_name}" (different email) exists at another ambassador's prospect.`);
    }
  }

  if (warnings.length > 0) {
    return NextResponse.json({
      duplicate: true,
      message: warnings.join(' '),
    });
  }

  return NextResponse.json({ duplicate: false });
}
