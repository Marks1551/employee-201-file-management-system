'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import Layout from './Layout';
import { Card, Button, Field, inputCls } from './ui';
import { useToast } from '@/shared/context/ToastContext';
import type { Role } from '@/shared/types';

const eyebrows: Record<Role, string> = {
  admin: 'Admin › Account',
  hr: 'HR › Account',
  faculty: 'Faculty › Account',
};

interface FingerprintInfo {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Something went wrong. Please try again.');
  return data as T;
}

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  // Server returns UTC "YYYY-MM-DD HH:MM:SS" strings.
  const d = new Date(value.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function guessDeviceName(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) return 'Android phone';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'This device';
}

export default function FingerprintSetupPage({ role }: { role: Role }) {
  const showToast = useToast();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [fingerprints, setFingerprints] = useState<FingerprintInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { fingerprints } = await api<{ fingerprints: FingerprintInfo[] }>('/api/auth/fingerprint');
      setFingerprints(fingerprints);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your fingerprints.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLabel(guessDeviceName());
    (async () => {
      setSupported(browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable()));
    })();
    load();
  }, [load]);

  async function handleRegister() {
    setError('');
    setBusy(true);
    try {
      const options = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>('/api/auth/fingerprint/register/options', 'POST');
      const response = await startRegistration({ optionsJSON: options });
      await api('/api/auth/fingerprint/register/verify', 'POST', { response, label });
      showToast('Fingerprint registered. You can now sign in with it.');
      await load();
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setError('Fingerprint setup was cancelled. Try again when you are ready.');
      } else if (err instanceof Error && err.name === 'InvalidStateError') {
        setError('This device already has a fingerprint registered for your account.');
      } else {
        setError(err instanceof Error ? err.message : 'Fingerprint setup failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(fp: FingerprintInfo) {
    if (!window.confirm(`Remove "${fp.label}"? You will no longer be able to sign in with it.`)) return;
    try {
      await api(`/api/auth/fingerprint/${fp.id}`, 'DELETE');
      showToast('Fingerprint removed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove fingerprint.');
    }
  }

  return (
    <Layout role={role} eyebrow={eyebrows[role]} title="Fingerprint Login">
      <p className="text-ink-muted mb-5">
        Register this device&apos;s fingerprint sensor so you can sign in with just a touch — no username or password needed.
      </p>

      <Card className="max-w-xl mb-5">
        {supported === false ? (
          <p className="text-[0.92rem] text-ink-muted m-0">
            This browser or device doesn&apos;t have a fingerprint sensor available (or it isn&apos;t set up in your device
            settings). Enroll a fingerprint in Windows Hello / Touch ID / your phone&apos;s settings first, then come back. You can
            also open this page on a phone or laptop that has one.
          </p>
        ) : (
          <>
            <Field label="Device name" hint="So you can tell your devices apart later, e.g. “Office laptop”.">
              <input type="text" className={inputCls} value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            {error && (
              <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">{error}</p>
            )}
            <Button type="button" onClick={handleRegister} disabled={busy || supported === null || !label.trim()}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
              {busy ? 'Waiting for fingerprint…' : 'Set up fingerprint on this device'}
            </Button>
            <p className="text-[0.8rem] text-ink-faint mt-3 mb-0 flex items-start gap-1.5">
              <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
              Your fingerprint never leaves your device. The system only stores a public key that can&apos;t be used to recreate it.
            </p>
          </>
        )}
      </Card>

      <h2 className="text-[1.05rem] mb-3">Registered devices</h2>
      <Card className="max-w-xl">
        {loading ? (
          <p className="text-[0.9rem] text-ink-muted m-0">Loading…</p>
        ) : fingerprints.length === 0 ? (
          <p className="text-[0.9rem] text-ink-muted m-0">No fingerprints registered yet.</p>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-border">
            {fingerprints.map((fp) => (
              <li key={fp.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Fingerprint size={20} className="text-navy flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <strong className="block text-[0.92rem] text-ink truncate">{fp.label}</strong>
                  <span className="block text-[0.78rem] text-ink-faint">
                    Added {formatDate(fp.createdAt)} · Last used {formatDate(fp.lastUsedAt)}
                  </span>
                </div>
                <Button type="button" variant="danger" sm onClick={() => handleRemove(fp)} aria-label={`Remove ${fp.label}`}>
                  <Trash2 size={15} /> Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Layout>
  );
}
