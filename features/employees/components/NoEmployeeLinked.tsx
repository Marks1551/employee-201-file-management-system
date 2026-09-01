import { UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import Layout from '@/shared/components/Layout';
import { Card } from '@/shared/components/ui';

interface NoEmployeeLinkedProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
}

export default function NoEmployeeLinked({ eyebrow, title }: NoEmployeeLinkedProps) {
  return (
    <Layout role="faculty" eyebrow={eyebrow} title={title}>
      <Card className="text-center py-12">
        <UserX size={36} className="mx-auto mb-3 text-ink-faint" />
        <h3 className="mb-1.5">No employee record is linked to your account yet</h3>
        <p className="text-ink-muted max-w-md mx-auto m-0">
          Ask your HR office to link your account to your employee 201 file. Once that's done, your dashboard and documents will show up here automatically.
        </p>
      </Card>
    </Layout>
  );
}
