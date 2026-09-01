'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { navConfig, type NavLinkItem } from './navConfig';
import { useApp, roleLabel } from '@/shared/context/AppContext';
import type { Role } from '@/shared/types';

interface LayoutProps {
  role: Role;
  eyebrow?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}

export default function Layout({ role, eyebrow, title, children }: LayoutProps) {
  const [navOpen, setNavOpen] = useState(false);
  const { currentUser, logout, notifications } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  const items = navConfig[role];

  const unreadNotificationsCount = notifications.filter((n) => n.status === 'unread').length;

  function isNavActive(item: NavLinkItem) {
    if (item.end) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(item.to + '/');
  }

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile scrim */}
      <div
        className={`fixed inset-0 bg-navy-dark/45 z-[35] transition-opacity md:hidden ${navOpen ? 'block' : 'hidden'}`}
        onClick={() => setNavOpen(false)}
      />

      <aside
        className={`w-[248px] flex-shrink-0 bg-navy-dark text-[#EDF1F6] flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-transform duration-200 ${
          navOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-[18px] py-5 border-b border-white/10">
          <img src="/assets/logo.png" alt="LSSTI seal" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="leading-tight">
            <strong className="block font-display text-[0.92rem] text-white">Employee 201 File</strong>
            <span className="block text-[0.72rem] text-[#AEB9C7]">LSSTI Management System</span>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3.5 overflow-y-auto scrollbar-thin">
          {items.map((item, i) =>
            'section' in item && item.section ? (
              <div key={i} className="text-[0.72rem] uppercase tracking-wider text-[#7C899B] px-3.5 pt-3.5 pb-1.5">
                {item.section}
              </div>
            ) : (
              (() => {
                const navItem = item as NavLinkItem;
                return (
                  <Link
                    key={navItem.to}
                    href={navItem.to}
                    onClick={() => setNavOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-[0.96rem] font-medium no-underline mb-1 transition-colors ${
                      isNavActive(navItem) ? 'bg-gold text-navy-dark font-semibold' : 'text-[#CBD5E1] hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <navItem.icon size={20} className="flex-shrink-0" />
                    <span className="flex-1">{navItem.label}</span>
                    {navItem.badgeKey === 'notifications' && unreadNotificationsCount > 0 && (
                      <span className="bg-danger-bg text-danger-text border border-danger-border rounded-full text-[0.72rem] font-bold px-2 py-0.5">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </Link>
                );
              })()
            )
          )}
        </nav>

        <div className="px-3.5 pt-3.5 pb-[18px] border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 text-[#F3C6C6] no-underline font-semibold text-[0.94rem] px-3 py-2.5 rounded-lg hover:bg-[rgba(240,120,120,0.14)] w-full transition-colors"
          >
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 md:ml-[248px]">
        <header className="h-[72px] bg-white border-b border-border flex items-center justify-between px-4 md:px-7 sticky top-0 z-30">
          <div className="flex items-center gap-3.5">
            <button
              aria-label="Open navigation menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((o) => !o)}
              className="md:hidden bg-transparent border-none cursor-pointer p-1.5 text-navy"
            >
              <Menu size={26} />
            </button>
            <div>
              <div className="text-[0.8rem] text-ink-faint font-medium mb-0.5">{eyebrow}</div>
              <h1 className="text-[1.3rem]">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="leading-tight hidden sm:block text-right">
              <strong className="block text-[0.92rem] text-ink">{currentUser?.name}</strong>
              <span className="block text-[0.78rem] text-ink-faint">{currentUser ? roleLabel(currentUser.role) : ''}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-navy-100 text-navy flex items-center justify-center font-bold font-display text-[0.95rem] flex-shrink-0">
              {currentUser?.initials}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-7 max-w-[1180px] w-full">{children}</div>
      </div>
    </div>
  );
}
