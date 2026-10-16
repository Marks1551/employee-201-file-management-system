"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Search, Mail, MoreHorizontal, Pencil, UserX, UserCheck, Trash2 } from "lucide-react";
import Layout from "@/shared/components/Layout";
import { Button, Field, inputCls, RoleBadge, Tag, Avatar } from "@/shared/components/ui";
import { TableWrap, Th, Td, CellName, CellSub } from "@/shared/components/Table";
import Pagination from "@/shared/components/Pagination";
import Modal from "@/shared/components/Modal";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import { usePagination } from "@/shared/lib/usePagination";
import type { User, Role } from "@/shared/types";

interface UserForm {
  name: string;
  email: string;
  username: string;
  role: Role;
}

interface RowAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

/** One compact "Actions" button per row; the choices open in a small menu instead of a crowd of buttons. */
function RowActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const open = pos !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) return setPos(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // Open upwards if there isn't room below the button (menu is ~4 rows tall).
    const menuHeight = actions.length * 40 + 12;
    const top = r.bottom + menuHeight > window.innerHeight ? Math.max(8, r.top - menuHeight) : r.bottom + 4;
    setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${label}`}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-white text-navy cursor-pointer hover:bg-navy-100"
      >
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setPos(null)} aria-hidden="true" />
          <div
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-[71] min-w-[190px] bg-white border border-border rounded-xl shadow-pop p-1.5"
          >
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPos(null);
                  a.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3 min-h-[40px] rounded-lg bg-transparent border-none cursor-pointer text-left text-[0.9rem] font-medium ${
                  a.danger ? "text-danger-text hover:bg-danger-bg" : "text-ink hover:bg-navy-100"
                }`}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function AdminUsers() {
  const { users, currentUser, addUserInvite, setUserStatus, updateUser, resendInvite, deleteUser } = useApp();
  const showToast = useToast();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({ name: "", email: "", username: "", role: "hr" });
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<Role>("faculty");
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const requiresEmployeeNumber = addRole === "faculty";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(filtered, 10);

  function openAdd() {
    setEmployeeNumber("");
    setAddName("");
    setAddEmail("");
    setAddRole("faculty");
    setAddError("");
    setAddOpen(true);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError("");

    const hasEmployeeNumber = !!employeeNumber.trim();
    if (requiresEmployeeNumber && !hasEmployeeNumber) {
      setAddError("Please enter an employee number.");
      return;
    }
    if (!hasEmployeeNumber && (!addName.trim() || !addEmail.trim())) {
      setAddError("Please enter a full name and email address, or an employee number.");
      return;
    }

    setAddSubmitting(true);
    const result = await addUserInvite(
      hasEmployeeNumber
        ? { employeeNumber: employeeNumber.trim(), role: addRole }
        : { name: addName.trim(), email: addEmail.trim(), role: addRole },
    );
    setAddSubmitting(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddOpen(false);
    showToast(
      `Account created for ${hasEmployeeNumber ? `employee #${employeeNumber.trim()}` : addName.trim()} — a setup email was sent.`,
    );
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

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const result = await deleteUser(deleteTarget.id);
    setDeleteBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(`${deleteTarget.name}'s account was deleted.`);
    setDeleteTarget(null);
  }

  function toggleStatus(u: User) {
    setUserStatus(u.id, u.status === "active" ? "deactivated" : "active");
    showToast(`${u.name}'s account ${u.status === "active" ? "deactivated" : "reactivated"}.`);
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
                  <div className="flex items-center gap-3">
                    <Avatar
                      photoUrl={u.photoUrl}
                      initials={u.initials}
                      color={u.role === "faculty" ? "faculty" : u.role === "hr" ? "hr" : "admin"}
                      size="sm"
                    />
                    <div>
                      <CellName>{u.name}</CellName>
                      <CellSub>{u.email}</CellSub>
                    </div>
                  </div>
                </Td>
                <Td>
                  <RoleBadge role={u.role} />
                </Td>
                <Td>
                  {u.status !== "active" ? (
                    <Tag kind="neutral">Deactivated</Tag>
                  ) : u.needsPasswordSetup ? (
                    <Tag kind="warn">Pending Setup</Tag>
                  ) : (
                    <Tag kind="ok">Active</Tag>
                  )}
                </Td>
                <Td>{u.lastActive}</Td>
                <Td>
                  <RowActionsMenu
                    label={u.name}
                    actions={[
                      { label: "Edit account", icon: <Pencil size={16} />, onClick: () => openEdit(u) },
                      ...(u.needsPasswordSetup && u.status === "active"
                        ? [{ label: "Resend invite", icon: <Mail size={16} />, onClick: () => handleResendInvite(u) }]
                        : []),
                      ...(u.role !== "admin"
                        ? [
                            u.status === "active"
                              ? { label: "Deactivate", icon: <UserX size={16} />, onClick: () => toggleStatus(u) }
                              : { label: "Reactivate", icon: <UserCheck size={16} />, onClick: () => toggleStatus(u) },
                          ]
                        : []),
                      ...(u.id !== currentUser?.id
                        ? [
                            {
                              label: "Delete account",
                              icon: <Trash2 size={16} />,
                              onClick: () => setDeleteTarget(u),
                              danger: true,
                            },
                          ]
                        : []),
                    ]}
                  />
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td className="text-ink-faint" colSpan={5}>
                  No accounts match your search.
                </Td>
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

      <Modal
        open={!!deleteTarget}
        onClose={() => (deleteBusy ? null : setDeleteTarget(null))}
        title={`Delete account — ${deleteTarget?.name || ""}`}
      >
        <p className="text-[0.9rem] text-ink-muted mb-2">
          This permanently deletes the login account for <strong>{deleteTarget?.email}</strong>. They will no longer be
          able to sign in, and their chat messages are removed.
        </p>
        <p className="text-[0.9rem] text-ink-muted mb-4">
          {deleteTarget?.role === "faculty"
            ? "Their employee 201 file is not deleted — only the account is."
            : "This can't be undone."}
          {deleteTarget?.role === "faculty" ? " This can't be undone." : ""}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleteBusy}>
            {deleteBusy ? "Deleting…" : "Delete Account"}
          </Button>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add new account">
        <form onSubmit={handleAdd}>
          <Field label="Role">
            <select
              className={inputCls}
              value={addRole}
              onChange={(e) => {
                const nextRole = e.target.value as Role;
                setAddRole(nextRole);
                if (nextRole === "faculty") {
                  setAddName("");
                  setAddEmail("");
                }
              }}
            >
              <option value="admin">System Administrator</option>
              <option value="hr">HR Personnel</option>
              <option value="faculty">Faculty</option>
            </select>
          </Field>

          <Field
            label={requiresEmployeeNumber ? "Employee number" : "Employee number (optional)"}
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
                <input
                  className={inputCls}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  required
                />
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
            <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">
              {addError}
            </p>
          )}

          <Button type="submit" className="w-full mt-2" disabled={addSubmitting}>
            {addSubmitting ? "Creating…" : "Create Account & Send Invite"}
          </Button>
        </form>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit account — ${editUser?.name || ""}`}>
        <form onSubmit={handleEditSave}>
          <Field label="Full name">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Email address">
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="Username">
            <input
              className={inputCls}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </Field>
          <Field label="Role">
            <select
              className={inputCls}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="admin">System Administrator</option>
              <option value="hr">HR Personnel</option>
              <option value="faculty">Faculty</option>
            </select>
          </Field>
          <Button type="submit" className="w-full mt-2">
            Save Changes
          </Button>
        </form>
      </Modal>
    </Layout>
  );
}
