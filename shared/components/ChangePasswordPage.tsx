'use client';

import { useState, type FormEvent } from 'react';
import Layout from './Layout';
import { Card, Button, Field, inputCls } from './ui';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import type { Role } from '@/shared/types';

const eyebrows: Record<Role, string> = {
  admin: 'Admin › Account',
  hr: 'HR › Account',
  faculty: 'Faculty › Account',
};

export default function ChangePasswordPage({ role }: { role: Role }) {
  const { currentUser, changePassword } = useApp();
  const showToast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (!currentUser) return;
    const result = await changePassword(currentUser.id, current, next);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    showToast('Your password has been changed.');
  }

  return (
    <Layout role={role} eyebrow={eyebrows[role]} title="Change Password">
      <p className="text-ink-muted mb-5">Update the password for your own account.</p>
      <Card className="max-w-md">
        <form onSubmit={handleSubmit}>
          <Field label="Current password">
            <input type="password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label="New password" hint="At least 6 characters.">
            <input type="password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Field label="Confirm new password">
            <input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {error && <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">{error}</p>}
          <Button type="submit">Update Password</Button>
        </form>
      </Card>
    </Layout>
  );
}
