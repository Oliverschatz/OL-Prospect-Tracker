import type { SupabaseClient, User } from '@supabase/supabase-js';

// Pages through admin.auth.admin.listUsers until the server stops returning
// full pages. Returns every user in the project. Callers pass an admin
// client created with the service role key.
export async function listAllUsers(admin: SupabaseClient): Promise<User[]> {
  const perPage = 1000;
  const out: User[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    out.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return out;
}
