'use client';

import { useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { useApp } from '@/shared/context/AppContext';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError('Please enter your username or email address.');
      return;
    }
    setSubmitting(true);
    const result = await requestPasswordReset(identifier.trim());
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
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
          <h1 className="text-[1.15rem] mb-1">Reset Your Password</h1>
          <p className="text-[0.85rem] text-ink-muted m-0">Lanao School of Science and Technology, Inc.</p>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <MailCheck size={30} className="mx-auto mb-3 text-ok-text" />
            <p className="text-[0.92rem] text-ink font-semibold mb-1">Check your email</p>
            <p className="text-[0.86rem] text-ink-muted mb-5">
              If that username or email matches an account, we've sent a link to reset the password. The link expires in 2 hours.
            </p>
            <a href="/" className="text-[0.86rem] text-navy font-semibold no-underline hover:underline">
              Back to sign in
            </a>
          </div>
        ) : (
          <>
            <p className="text-[0.86rem] text-ink-muted -mt-2 mb-5">
              Enter your username or email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="identifier" className="block font-semibold text-[0.92rem] text-ink mb-1.5">
                  Username or email
                </label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. jvillareal"
                  className="w-full min-h-[48px] px-3.5 py-2.5 border-[1.5px] border-border-strong rounded-lg text-base focus:border-navy focus:outline-none"
                  autoComplete="username"
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
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-[0.86rem] text-center mt-5 mb-0">
              <a href="/" className="text-navy font-semibold no-underline hover:underline">
                Back to sign in
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
