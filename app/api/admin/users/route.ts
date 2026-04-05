import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

// Verify the caller is an admin by checking their JWT + profiles table
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

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { data: { users }, error } = await admin.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return safe subset — no sensitive data
  const safeUsers = users.map(u => ({
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || '',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    banned: u.banned_until ? true : false,
  }));

  return NextResponse.json(safeUsers);
}

// POST /api/admin/users — invite a new Brand Ambassador
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { email, full_name, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || '' },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create profile row
  await admin.from('profiles').insert({ id: data.user.id, is_admin: false });

  return NextResponse.json({ id: data.user.id, email: data.user.email });
}

// PATCH /api/admin/users — ban or unban a user
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const { user_id, action } = await req.json();
  if (!user_id || !['ban', 'unban'].includes(action)) {
    return NextResponse.json({ error: 'user_id and action (ban/unban) required' }, { status: 400 });
  }

  if (action === 'ban') {
    const { error } = await admin.auth.admin.updateUserById(user_id, {
      ban_duration: '876000h', // ~100 years
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.auth.admin.updateUserById(user_id, {
      ban_duration: 'none',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
