import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kanban Board — OliverLehmann.com',
  description: 'Kanban board widget',
  icons: {
    icon: 'https://oliverlehmann.com/wp-content/uploads/2023/05/cropped-logo-ol.png',
  },
};

export default function KanbanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
