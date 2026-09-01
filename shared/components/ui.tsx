'use client';

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Check, AlertTriangle, type LucideIcon } from 'lucide-react';

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white border border-border rounded-2xl shadow-card p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

const btnBase =
  'inline-flex items-center justify-center gap-2 min-h-[46px] px-5 rounded-lg font-semibold text-[0.95rem] border-[1.5px] border-transparent cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-dark',
  gold: 'bg-gold text-navy-dark hover:bg-gold-dark',
  secondary: 'bg-white text-navy border-border-strong hover:bg-navy-100',
  ghost: 'bg-transparent text-navy border-transparent hover:bg-navy-100 px-3',
  danger: 'bg-white text-danger-text border-danger-border hover:bg-danger-bg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  sm?: boolean;
}

export function Button({ variant = 'primary', className = '', sm = false, children, ...props }: ButtonProps) {
  return (
    <button
      className={`${btnBase} ${variants[variant]} ${sm ? 'min-h-[38px] px-3.5 text-[0.86rem]' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  sm?: boolean;
}

export function LinkButton({ variant = 'primary', className = '', sm = false, children, ...props }: LinkButtonProps) {
  return (
    <a className={`${btnBase} ${variants[variant]} ${sm ? 'min-h-[38px] px-3.5 text-[0.86rem]' : ''} no-underline ${className}`} {...props}>
      {children}
    </a>
  );
}

const roleBadgeStyles: Record<string, string> = {
  admin: 'bg-admin-bg text-admin-text border-admin-border',
  hr: 'bg-hr-bg text-hr-text border-hr-border',
  faculty: 'bg-faculty-bg text-faculty-text border-faculty-border',
};

export function RoleBadge({ role }: { role: string }) {
  const label = role === 'admin' ? 'Admin' : role === 'hr' ? 'HR' : 'Faculty';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.78rem] font-bold uppercase tracking-wide border ${roleBadgeStyles[role]}`}>
      {label}
    </span>
  );
}

type TagKind = 'ok' | 'warn' | 'danger' | 'neutral';

const tagStyles: Record<TagKind, string> = {
  ok: 'bg-ok-bg text-ok-text border-ok-border',
  warn: 'bg-warn-bg text-warn-text border-warn-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
  neutral: 'bg-navy-100 text-navy border-border-strong',
};

interface TagProps {
  kind?: TagKind;
  children?: ReactNode;
  icon?: ReactNode | null;
}

export function Tag({ kind = 'neutral', children, icon }: TagProps) {
  const showIcon = icon === undefined ? (kind === 'ok' ? <Check size={13} strokeWidth={2.5} /> : kind === 'warn' || kind === 'danger' ? <AlertTriangle size={13} strokeWidth={2.5} /> : null) : icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.78rem] font-semibold border whitespace-nowrap ${tagStyles[kind]}`}>
      {showIcon}
      {children}
    </span>
  );
}

type StatColor = 'gold' | 'green' | 'purple' | 'navy';

const statIconBg: Record<StatColor, string> = {
  gold: 'bg-admin-bg text-admin-text',
  green: 'bg-hr-bg text-hr-text',
  purple: 'bg-faculty-bg text-faculty-text',
  navy: 'bg-navy-100 text-navy',
};

interface StatCardProps {
  icon: LucideIcon;
  color?: StatColor;
  value: ReactNode;
  label: ReactNode;
}

export function StatCard({ icon: Icon, color = 'navy', value, label }: StatCardProps) {
  return (
    <Card className="flex gap-3.5 items-start p-5">
      <div className={`w-[46px] h-[46px] rounded-xl flex items-center justify-center flex-shrink-0 ${statIconBg[color]}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="font-display text-2xl font-bold text-navy-dark leading-none mb-1">{value}</div>
        <div className="text-[0.86rem] text-ink-muted">{label}</div>
      </div>
    </Card>
  );
}

interface ActionTileProps {
  to?: string;
  onClick?: () => void;
  icon: LucideIcon;
  iconBg: string;
  title: ReactNode;
  description: ReactNode;
  as?: 'a' | 'link';
}

export function ActionTile({ to, onClick, icon: Icon, iconBg, title, description, as: As = 'a' }: ActionTileProps) {
  const content = (
    <>
      <div className={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={26} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="mb-0.5 text-[1.08rem]">{title}</h3>
        <p className="m-0 text-[0.86rem] text-ink-muted">{description}</p>
      </div>
      <div className="text-ink-faint flex-shrink-0">
        <ChevronRight />
      </div>
    </>
  );
  const cls = 'flex items-center gap-4 bg-white border border-border rounded-2xl p-5 no-underline text-ink shadow-card hover:border-gold hover:shadow-pop transition-all cursor-pointer text-left w-full';
  if (onClick) {
    return (
      <button onClick={onClick} className={cls}>
        {content}
      </button>
    );
  }
  return (
    <a href={to} className={cls} onClick={(e) => { if (As === 'link') e.preventDefault(); }}>
      {content}
    </a>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

type AvatarColor = 'hr' | 'faculty' | 'admin' | 'navy';
type AvatarSize = 'sm' | 'md' | 'lg';

const avatarColorBg: Record<AvatarColor, string> = {
  hr: 'bg-hr-bg text-hr-text',
  faculty: 'bg-faculty-bg text-faculty-text',
  admin: 'bg-admin-bg text-admin-text',
  navy: 'bg-navy-100 text-navy',
};

const avatarSizes: Record<AvatarSize, string> = {
  sm: 'w-9 h-9 text-[0.8rem]',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
};

interface AvatarProps {
  photoUrl?: string | null;
  initials?: string | null;
  color?: AvatarColor;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ photoUrl, initials, color = 'navy', size = 'md', className = '' }: AvatarProps) {
  const sizeCls = avatarSizes[size];
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials ? `Photo of ${initials}` : 'Employee photo'}
        className={`${sizeCls} rounded-full object-cover flex-shrink-0 border border-border ${className}`}
      />
    );
  }
  return (
    <div className={`${sizeCls} rounded-full flex items-center justify-center font-bold font-display flex-shrink-0 ${avatarColorBg[color]} ${className}`}>
      {initials}
    </div>
  );
}

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, children, htmlFor }: FieldProps) {
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={htmlFor} className="block font-semibold text-[0.92rem] text-ink mb-1.5">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-[0.8rem] text-ink-faint mt-1.5">{hint}</p>}
    </div>
  );
}

export const inputCls =
  'w-full min-h-[48px] px-3.5 py-2.5 border-[1.5px] border-border-strong rounded-lg text-base font-sans text-ink bg-white focus:border-navy focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-cream';
