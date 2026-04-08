import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/verify-admin';

// GET /api/admin/shared-templates — list all shared templates
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  const { data, error } = await admin
    .from('shared_templates')
    .select('*')
    .order('sort_order')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/admin/shared-templates — create
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  const { id, name, body, sort_order } = await req.json();
  if (!id || !name || !body) {
    return NextResponse.json({ error: 'id, name, body required' }, { status: 400 });
  }
  const { error } = await admin.from('shared_templates').insert({
    id,
    name,
    body,
    sort_order: sort_order ?? 0,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT /api/admin/shared-templates — update
export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  const { id, name, body, sort_order } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  // Only include fields the caller actually supplied so partial updates don't
  // clobber unrelated columns with null.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (body !== undefined) patch.body = body;
  if (sort_order !== undefined) patch.sort_order = sort_order;
  const { error } = await admin
    .from('shared_templates')
    .update(patch)
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/shared-templates — batch reorder
// Body: { order: string[] } — IDs in the desired display order.
// Reassigns sort_order to 0..N-1 in the given order.
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  const { order } = await req.json();
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'order must be an array of template IDs' }, { status: 400 });
  }
  const now = new Date().toISOString();
  // Supabase doesn't support a single update with per-row values, so issue
  // one update per ID. The list is small (a handful of shared templates) so
  // this is fine.
  for (let i = 0; i < order.length; i++) {
    const { error } = await admin
      .from('shared_templates')
      .update({ sort_order: i, updated_at: now })
      .eq('id', order[i]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/shared-templates?id=... — delete
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await admin.from('shared_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
