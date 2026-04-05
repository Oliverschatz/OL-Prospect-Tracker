import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return false;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;

  const admin = createAdminClient();
  if (!admin) return false;
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
  return profile?.is_admin === true;
}

// GET /api/admin/stats — usage overview per user (no individual prospect data)
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  // Get all users
  const { data: { users } } = await admin.auth.admin.listUsers();

  // Get aggregate counts per user (no actual data content exposed)
  const { data: companyCounts } = await admin.rpc('count_by_user', { table_name: 'companies' });
  const { data: contactCounts } = await admin.rpc('count_by_user', { table_name: 'contacts' });
  const { data: activityCounts } = await admin.rpc('count_by_user', { table_name: 'activities' });

  // Fallback: direct count queries if RPC not available
  const companyMap: Record<string, number> = {};
  const contactMap: Record<string, number> = {};
  const activityMap: Record<string, number> = {};

  if (companyCounts) {
    for (const r of companyCounts) companyMap[r.user_id] = r.count;
  } else {
    // Manual aggregation
    const { data: cos } = await admin.from('companies').select('user_id');
    for (const c of cos || []) {
      companyMap[c.user_id] = (companyMap[c.user_id] || 0) + 1;
    }
  }

  if (contactCounts) {
    for (const r of contactCounts) contactMap[r.user_id] = r.count;
  } else {
    const { data: cts } = await admin.from('contacts').select('user_id');
    for (const c of cts || []) {
      contactMap[c.user_id] = (contactMap[c.user_id] || 0) + 1;
    }
  }

  if (activityCounts) {
    for (const r of activityCounts) activityMap[r.user_id] = r.count;
  } else {
    const { data: acts } = await admin.from('activities').select('user_id');
    for (const a of acts || []) {
      activityMap[a.user_id] = (activityMap[a.user_id] || 0) + 1;
    }
  }

  // Get latest activity date per user
  const { data: latestActivities } = await admin
    .from('activities')
    .select('user_id, date')
    .order('date', { ascending: false });

  const lastActivityMap: Record<string, string> = {};
  for (const a of latestActivities || []) {
    if (!lastActivityMap[a.user_id]) lastActivityMap[a.user_id] = a.date;
  }

  const stats = users.map(u => ({
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || '',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    companies: companyMap[u.id] || 0,
    contacts: contactMap[u.id] || 0,
    activities: activityMap[u.id] || 0,
    last_activity: lastActivityMap[u.id] || null,
  }));

  // Summary totals
  const totals = {
    users: users.length,
    companies: Object.values(companyMap).reduce((a, b) => a + b, 0),
    contacts: Object.values(contactMap).reduce((a, b) => a + b, 0),
    activities: Object.values(activityMap).reduce((a, b) => a + b, 0),
  };

  return NextResponse.json({ totals, users: stats });
}
