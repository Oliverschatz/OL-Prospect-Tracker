import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kanban Board — OliverLehmann.com',
  description: 'Kanban board widget',
};

export default function KanbanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
