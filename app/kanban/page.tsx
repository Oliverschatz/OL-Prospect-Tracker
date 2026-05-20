'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { onAuthStateChange, signOut } from '@/lib/auth';
import KanbanBoard from '@/components/KanbanBoard';

export default function KanbanPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((u) => {
      setUser(u);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (checking) return null;

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: 'var(--pbf-muted)' }}>You need to be logged in to view the Kanban board.</p>
        <button className="btn-primary" onClick={() => router.push('/')}>Go to login</button>
      </div>
    );
  }

  return (
    <KanbanBoard
      user={user}
      onBack={() => router.push('/')}
      onLogout={async () => { await signOut(); router.push('/'); }}
    />
  );
}
