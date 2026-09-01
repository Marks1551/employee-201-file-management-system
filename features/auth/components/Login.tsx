'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, GraduationCap, type LucideIcon } from 'lucide-react';
import { useApp, roleHome } from '@/shared/context/AppContext';
import { isProduction } from '@/shared/lib/env';
import type { Role } from '@/shared/types';

export default function Login() {
  const { login, loginAsDemo } = useApp();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please enter both your username/employee ID and password.');
      return;
    }
    const result = await login(username, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(roleHome(result.user.role));
  }

  async function handleDemo(role: Role) {
    const user = await loginAsDemo(role);
    if (user) router.push(roleHome(role));
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
          <h1 className="text-[1.15rem] mb-1">Employee 201 File Management System</h1>
          <p className="text-[0.85rem] text-ink-muted m-0">Lanao School of Science and Technology, Inc.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block font-semibold text-[0.92rem] text-ink mb-1.5">
              Username or Employee ID
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jvillareal"
              className="w-full min-h-[48px] px-3.5 py-2.5 border-[1.5px] border-border-strong rounded-lg text-base focus:border-navy focus:outline-none"
              autoComplete="username"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block font-semibold text-[0.92rem] text-ink mb-1.5">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full min-h-[48px] px-3.5 py-2.5 border-[1.5px] border-border-strong rounded-lg text-base focus:border-navy focus:outline-none"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">{error}</p>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-lg font-semibold text-[0.95rem] bg-navy text-white hover:bg-navy-dark transition-colors"
          >
            Sign In
          </button>
        </form>

        <p className="text-[0.86rem] text-center mt-3 mb-0">
          <a href="/forgot-password" className="text-navy font-semibold no-underline hover:underline">
            Forgot your password?
          </a>
        </p>

        {!isProduction && (
          <>
            <p className="text-[0.78rem] text-ink-faint text-center mt-2 mb-0">
              Default password for every seeded account is <code className="bg-navy-100 px-1.5 py-0.5 rounded text-ink">lssti123</code>.
            </p>

            <div className="flex items-center gap-2.5 my-5 text-ink-faint text-[0.78rem] uppercase tracking-wide">
              <span className="flex-1 h-px bg-border" />
              Quick access
              <span className="flex-1 h-px bg-border" />
            </div>
            <p className="text-[0.86rem] text-ink-muted -mt-3 mb-3.5">Sign in instantly as a sample account for each role. Dev mode only.</p>

            <div className="grid gap-2.5">
              <DemoButton
                onClick={() => handleDemo('admin')}
                icon={Shield}
                bg="var(--color-admin-bg)"
                fg="var(--color-admin-text)"
                title="Continue as System Administrator"
                subtitle="Accounts, roles, backups, audit logs"
              />
              <DemoButton
                onClick={() => handleDemo('hr')}
                icon={Users}
                bg="var(--color-hr-bg)"
                fg="var(--color-hr-text)"
                title="Continue as HR Personnel"
                subtitle="Employee records, documents, reports"
              />
              <DemoButton
                onClick={() => handleDemo('faculty')}
                icon={GraduationCap}
                bg="var(--color-faculty-bg)"
                fg="var(--color-faculty-text)"
                title="Continue as Faculty"
                subtitle="View your 201 file, submit documents"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface DemoButtonProps {
  onClick: () => void;
  icon: LucideIcon;
  bg: string;
  fg: string;
  title: string;
  subtitle: string;
}

function DemoButton({ onClick, icon: Icon, bg, fg, title, subtitle }: DemoButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-3.5 py-3 rounded-lg border-[1.5px] border-border-strong bg-white cursor-pointer text-left hover:border-navy hover:bg-navy-100 transition-colors"
    >
      <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: bg, color: fg }}>
        <Icon size={18} />
      </span>
      <span>
        <strong className="block text-[0.92rem] text-ink">{title}</strong>
        <span className="block text-[0.78rem] text-ink-faint">{subtitle}</span>
      </span>
    </button>
  );
}
