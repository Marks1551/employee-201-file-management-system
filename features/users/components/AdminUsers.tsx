'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Search, Mail } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { Button, Field, inputCls, RoleBadge, Tag } from '@/shared/components/ui';
import { TableWrap, Th, Td, CellName, CellSub } from '@/shared/components/Table';
import Pagination from '@/shared/components/Pagination';
import Modal from '@/shared/components/Modal';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import { usePagination } from '@/shared/lib/usePagination';
import type { User, Role } from '@/shared/types';

interface UserForm {
  name: string;
  email: string;
  username: string;
  role: Role;
}

export default function AdminUsers() {
  const { users, addUserInvite, setUserStatus, updateUser, resendInvite } = useApp();
  const showToast = useToast();
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({ name: '', email: '', username: '', role: 'hr' });
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<Role>('faculty');
  const [addError, setAddError] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const requiresEmployeeNumber = addRole === 'faculty';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(filtered, 10);

  function openAdd() {
    setEmployeeNumber('');
    setAddName('');
    setAddEmail('');
    setAddRole('faculty');
    setAddError('');
    setAddOpen(true);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError('');

    const hasEmployeeNumber = !!employeeNumber.trim();
    if (requiresEmployeeNumber && !hasEmployeeNumber) {
      setAddError('Please enter an employee number.');
      return;
    }
    if (!hasEmployeeNumber && (!addName.trim() || !addEmail.trim())) {
      setAddError('Please enter a full name and email address, or an employee number.');
      return;
    }

    setAddSubmitting(true);
    const result = await addUserInvite(
      hasEmployeeNumber
        ? { employeeNumber: employeeNumber.trim(), role: addRole }
        : { name: addName.trim(), email: addEmail.trim(), role: addRole }
    );
    setAddSubmitting(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddOpen(false);
    showToast(`Account created for ${hasEmployeeNumber ? `employee #${employeeNumber.trim()}` : addName.trim()} — a setup email was sent.`);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, username: u.username, role: u.role });
  }

  function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    updateUser(editUser.id, { name: form.name, email: form.email, username: form.username, role: form.role });
    setEditUser(null);
    showToast(`Account updated for ${form.name}.`);
  }

  function toggleStatus(u: User) {
    setUserStatus(u.id, u.status === 'active' ? 'deactivated' : 'active');
    showToast(`${u.name}'s account ${u.status === 'active' ? 'deactivated' : 'reactivated'}.`);
  }

  async function handleResendInvite(u: User) {
    const result = await resendInvite(u.id);
    showToast(result.ok ? `Setup email resent to ${u.name}.` : result.error);
  }

  return (
    <Layout role="admin" eyebrow="Admin › Accounts" title="User Accounts">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-ink-muted m-0">Create, edit, or deactivate accounts. Each account has one role.</p>
        <Button variant="gold" onClick={openAdd}>
          <Plus size={18} />
          Add New Account
        </Button>
      </div>

      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
        <div className="relative">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            placeholder="Search by name or email"
            aria-label="Search user accounts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputCls} pl-11`}
          />
        </div>
      </div>

      <TableWrap>
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Last Active</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => (
              <tr key={u.id} className="hover:bg-[#FBFAF7]">
                <Td>
                  <CellName>{u.name}</CellName>
                  <CellSub>{u.email}</CellSub>
                </Td>
                <Td><RoleBadge role={u.role} /></Td>
                <Td>
                  {u.status !== 'active' ? (
                    <Tag kind="neutral">Deactivated</Tag>
                  ) : u.needsPasswordSetup ? (
                    <Tag kind="warn">Pending Setup</Tag>
                  ) : (
                    <Tag kind="ok">Active</Tag>
                  )}
                </Td>
                <Td>{u.lastActive}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button variant="secondary" sm onClick={() => openEdit(u)}>Edit</Button>
                    {u.needsPasswordSetup && u.status === 'active' && (
                      <Button variant="secondary" sm onClick={() => handleResendInvite(u)}>
                        <Mail size={14} />
                        Resend Invite
                      </Button>
                    )}
                    {u.role !== 'admin' && (
                      u.status === 'active' ? (
                        <Button variant="danger" sm onClick={() => toggleStatus(u)}>Deactivate</Button>
                      ) : (
                        <Button variant="secondary" sm onClick={() => toggleStatus(u)}>Reactivate</Button>
                      )
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td className="text-ink-faint" colSpan={5}>No accounts match your search.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={filtered.length}
        startIndex={startIndex}
        endIndex={endIndex}
        itemLabel="accounts"
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add new account">
        <form onSubmit={handleAdd}>
          <Field label="Role">
            <select
              className={inputCls}
              value={addRole}
              onChange={(e) => {
                const nextRole = e.target.value as Role;
                setAddRole(nextRole);
                if (nextRole === 'faculty') {
                  setAddName('');
                  setAddEmail('');
                }
              }}
            >
              <option value="admin">System Administrator</option>
              <option value="hr">HR Personnel</option>
              <option value="faculty">Faculty</option>
            </select>
          </Field>

          <Field
            label={requiresEmployeeNumber ? 'Employee number' : 'Employee number (optional)'}
            hint={
              requiresEmployeeNumber
                ? "We'll pull the name and email from their 201 file and email them a link to set up their account."
                : "Link this account to a 201 file, or leave blank to create it directly (e.g. HR/Admin staff with no employee record)."
            }
          >
            <input
              className={inputCls}
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="e.g. 2024-0142"
              autoFocus
              required={requiresEmployeeNumber}
            />
          </Field>

          {!requiresEmployeeNumber && !employeeNumber.trim() && (
            <>
              <Field label="Full name">
                <input className={inputCls} value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Maria Santos" required />
              </Field>
              <Field label="Email address" hint="Their account setup link will be sent here.">
                <input
                  type="email"
                  className={inputCls}
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="e.g. maria.santos@lssti.edu.ph"
                  required
                />
              </Field>
            </>
          )}

          {addError && (
            <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">{addError}</p>
          )}

          <Button type="submit" className="w-full mt-2" disabled={addSubmitting}>
            {addSubmitting ? 'Creating…' : 'Create Account & Send Invite'}
          </Button>
        </form>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit account — ${editUser?.name || ''}`}>
        <form onSubmit={handleEditSave}>
          <Field label="Full name">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Email address">
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Username">
            <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </Field>
          <Field label="Role">
            <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="admin">System Administrator</option>
              <option value="hr">HR Personnel</option>
              <option value="faculty">Faculty</option>
            </select>
          </Field>
          <Button type="submit" className="w-full mt-2">Save Changes</Button>
        </form>
      </Modal>
    </Layout>
  );
}
