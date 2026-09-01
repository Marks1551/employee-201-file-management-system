'use client';

import { useState } from 'react';
import Layout from '@/shared/components/Layout';
import { Button, RoleBadge, inputCls } from '@/shared/components/ui';
import { TableWrap, Th, Td, CellName, CellSub } from '@/shared/components/Table';
import Pagination from '@/shared/components/Pagination';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import { usePagination } from '@/shared/lib/usePagination';
import type { User, Role } from '@/shared/types';

export default function AssignRoles() {
  const { users, setUserRole } = useApp();
  const showToast = useToast();
  const [pending, setPending] = useState<Record<string, Role>>({});
  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(users, 10);

  function handleChange(userId: string, role: Role) {
    setPending((p) => ({ ...p, [userId]: role }));
  }

  function handleSave(user: User) {
    const role = pending[user.id] ?? user.role;
    if (role === user.role) return;
    setUserRole(user.id, role);
    showToast(`${user.name}'s role is now ${roleName(role)}.`);
    setPending((p) => {
      const next = { ...p };
      delete next[user.id];
      return next;
    });
  }

  return (
    <Layout role="admin" eyebrow="Admin › Roles" title="Assign Roles">
      <p className="text-ink-muted mb-5">Choose a role for each account, then save your change. A role controls what a person can see and do.</p>

      <TableWrap>
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Current Role</Th>
              <Th>Set Role</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => {
              const value = pending[u.id] ?? u.role;
              const dirty = value !== u.role;
              return (
                <tr key={u.id} className="hover:bg-[#FBFAF7]">
                  <Td>
                    <CellName>{u.name}</CellName>
                    <CellSub>{u.email}</CellSub>
                  </Td>
                  <Td><RoleBadge role={u.role} /></Td>
                  <Td>
                    <select
                      className={`${inputCls} min-h-[40px] max-w-[220px]`}
                      value={value}
                      onChange={(e) => handleChange(u.id, e.target.value as Role)}
                    >
                      <option value="admin">System Administrator</option>
                      <option value="hr">HR Personnel</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </Td>
                  <Td>
                    <Button sm variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={() => handleSave(u)}>
                      Save
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={users.length}
        startIndex={startIndex}
        endIndex={endIndex}
        itemLabel="accounts"
      />
    </Layout>
  );
}

function roleName(role: Role) {
  return role === 'admin' ? 'System Administrator' : role === 'hr' ? 'HR Personnel' : 'Faculty';
}
