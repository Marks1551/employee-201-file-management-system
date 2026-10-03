"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import Layout from "./Layout";
import { Card, Button, Field, inputCls } from "./ui";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import type { Role } from "@/shared/types";

const eyebrows: Record<Role, string> = {
  admin: "Admin › Account",
  hr: "HR › Account",
  faculty: "Faculty › Account",
};

export default function ChangePasswordPage({ role }: { role: Role }) {
  const { currentUser, changePassword, changeUsername } = useApp();
  const showToast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (!currentUser) return;
    setSavingPassword(true);
    const result = await changePassword(currentUser.id, current, next).finally(() => setSavingPassword(false));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    showToast("Your password has been changed.");
  }

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameError("");
    const trimmed = newUsername.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      setUsernameError("Username must be 3 to 30 characters.");
      return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
      setUsernameError("Username can only use letters, numbers, dots, underscores and hyphens.");
      return;
    }
    setSavingUsername(true);
    const result = await changeUsername(trimmed, usernamePassword).finally(() => setSavingUsername(false));
    if (!result.ok) {
      setUsernameError(result.error);
      return;
    }
    setNewUsername("");
    setUsernamePassword("");
    showToast("Your username has been changed.");
  }

  return (
    <Layout role={role} eyebrow={eyebrows[role]} title="Change Username & Password">
      <h2 className="mb-2">Change username</h2>
      <p className="text-ink-muted mb-5">
        Your current username is <strong className="text-ink">{currentUser?.username}</strong>. You use it (or your
        email) to sign in.
      </p>
      <Card className="max-w-md">
        <form onSubmit={handleUsernameSubmit}>
          <Field label="New username" hint="3 to 30 characters: letters, numbers, dots, underscores or hyphens.">
            <input
              type="text"
              autoComplete="username"
              className={inputCls}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="Current password" hint="Needed to confirm it's you.">
            <input
              type="password"
              autoComplete="current-password"
              className={inputCls}
              value={usernamePassword}
              onChange={(e) => setUsernamePassword(e.target.value)}
              required
            />
          </Field>
          {usernameError && (
            <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">
              {usernameError}
            </p>
          )}
          <Button type="submit" disabled={savingUsername} className="disabled:opacity-70 disabled:cursor-not-allowed">
            {savingUsername ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Updating…
              </>
            ) : (
              "Update Username"
            )}
          </Button>
        </form>
      </Card>

      <h2 className="mt-8 mb-2">Change password</h2>
      <p className="text-ink-muted mb-5">Update the password for your own account.</p>
      <Card className="max-w-md">
        <form onSubmit={handleSubmit}>
          <Field label="Current password">
            <input
              type="password"
              className={inputCls}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </Field>
          <Field label="New password" hint="At least 6 characters.">
            <input
              type="password"
              className={inputCls}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              className={inputCls}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          {error && (
            <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">
              {error}
            </p>
          )}
          <Button type="submit" disabled={savingPassword} className="disabled:opacity-70 disabled:cursor-not-allowed">
            {savingPassword ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Updating…
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </Card>
    </Layout>
  );
}
