'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, KeyRound, ShieldAlert, Loader2 } from 'lucide-react';
import { useApp, roleHome } from '@/shared/context/AppContext';

type TokenState = { status: 'checking' } | { status: 'invalid' } | { status: 'valid'; name: string; username: string; purpose: 'setup' | 'reset' };

export default function AccountSetupPage() {
  return (
    <Suspense fallback={null}>
      <AccountSetupForm />
    </Suspense>
  );
}

function AccountSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { completeAccountSetup } = useApp();

  const [tokenState, setTokenState] = useState<TokenState>({ status: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState({ status: 'invalid' });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/auth/account-setup?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.valid) {
          setTokenState({ status: 'valid', name: data.name, username: data.username, purpose: data.purpose });
        } else {
          setTokenState({ status: 'invalid' });
        }
      } catch {
        setTokenState({ status: 'invalid' });
      }
    })();
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const result = await completeAccountSetup(token, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(() => router.push(roleHome(result.user.role)), 1200);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(circle at 15% 10%, rgba(217,164,65,0.10), transparent 40%), radial-gradient(circle at 85% 90%, rgba(122,31,43,0.10), transparent 40%), #F7F4EE',
      }}
    >
      <div className="w-full max-w-[400px] bg-white border border-border rounded-3xl shadow-pop px-8 py-9">
        <div className="text-center mb-6">
          <img src="/assets/logo.png" alt="Lanao School of Science and Technology, Inc. seal" className="w-16 h-16 mx-auto mb-3 rounded-full" />
          <h1 className="text-[1.15rem] mb-1">
            {tokenState.status === 'valid' && tokenState.purpose === 'reset' ? 'Reset Your Password' : 'Set Up Your Account'}
          </h1>
          <p className="text-[0.85rem] text-ink-muted m-0">Lanao School of Science and Technology, Inc.</p>
        </div>

        {tokenState.status === 'checking' && (
          <div className="flex flex-col items-center gap-2 py-6 text-ink-muted">
            <Loader2 size={22} className="animate-spin" />
            <p className="text-[0.86rem] m-0">Checking your link…</p>
          </div>
        )}

        {tokenState.status === 'invalid' && (
          <div className="text-center py-4">
            <ShieldAlert size={30} className="mx-auto mb-3 text-danger-text" />
            <p className="text-[0.92rem] text-ink mb-1 font-semibold">This link is invalid or has expired</p>
            <p className="text-[0.86rem] text-ink-muted mb-5">
              Setup and reset links are only valid for a limited time. Request a new one below, or contact HR / your administrator if you're setting up a
              brand-new account.
            </p>
            <a
              href="/forgot-password"
              className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-lg font-semibold text-[0.95rem] bg-navy text-white hover:bg-navy-dark transition-colors no-underline"
            >
              Request a new link
            </a>
          </div>
        )}

        {tokenState.status === 'valid' && !done && (
          <>
            <p className="text-[0.86rem] text-ink-muted -mt-2 mb-5">
              Hi {tokenState.name}, {tokenState.purpose === 'reset' ? 'choose a new password below.' : 'welcome! Choose a password to finish setting up your account.'}
              {' '}Your username is <strong className="text-ink">{tokenState.username}</strong>.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="password" className="block font-semibold text-[0.92rem] text-ink mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full min-h-[48px] px-3.5 py-2.5 border-[1.5px] border-border-strong rounded-lg text-base focus:border-navy focus:outline-none"
                  autoComplete="new-password"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="confirm" className="block font-semibold text-[0.92rem] text-ink mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full min-h-[48px] px-3.5 py-2.5 border-[1.5px] border-border-strong rounded-lg text-base focus:border-navy focus:outline-none"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-lg font-semibold text-[0.95rem] bg-navy text-white hover:bg-navy-dark transition-colors disabled:opacity-50"
              >
                <KeyRound size={18} />
                {submitting ? 'Saving…' : 'Set Password & Sign In'}
              </button>
            </form>
          </>
        )}

        {done && (
          <div className="text-center py-4">
            <CheckCircle2 size={30} className="mx-auto mb-3 text-ok-text" />
            <p className="text-[0.92rem] text-ink font-semibold mb-1">You're all set!</p>
            <p className="text-[0.86rem] text-ink-muted">Signing you in…</p>
          </div>
        )}
      </div>
    </div>
  );
}
