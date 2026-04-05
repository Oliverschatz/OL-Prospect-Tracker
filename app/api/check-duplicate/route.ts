import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

// POST /api/check-duplicate — check if a company name is tracked by another ambassador
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

  const { company_name } = await req.json();
  if (!company_name) return NextResponse.json({ duplicate: false });

  // Use admin client to check across all users (bypasses RLS)
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ duplicate: false });

  const { data: matches } = await admin
    .from('companies')
    .select('user_id')
    .ilike('name', company_name)
    .neq('user_id', user.id);

  if (matches && matches.length > 0) {
    return NextResponse.json({
      duplicate: true,
      count: matches.length,
      message: `This prospect is already being tracked by ${matches.length} other ambassador${matches.length > 1 ? 's' : ''}. Please coordinate to avoid surprises.`,
    });
  }

  return NextResponse.json({ duplicate: false });
}
