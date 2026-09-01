import {
  LayoutDashboard, Users, CheckSquare, Database, ClipboardList, KeyRound,
  FolderOpen, Search, Bell, FileBarChart, FileText, UploadCloud, type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/shared/types';

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeKey?: 'notifications';
  section?: undefined;
}

export interface NavSectionItem {
  section: string;
  to?: undefined;
}

export type NavItem = NavLinkItem | NavSectionItem;

export const navConfig: Record<Role, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'User Accounts', icon: Users },
    { to: '/admin/roles', label: 'Assign Roles', icon: CheckSquare },
    { to: '/admin/backup', label: 'Backup Database', icon: Database },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
    { section: 'Account' },
    { to: '/admin/change-password', label: 'Change Password', icon: KeyRound },
  ],
  hr: [
    { to: '/hr', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/hr/employees', label: 'Employee Records', icon: Users },
    { to: '/hr/documents', label: 'Document Management', icon: FolderOpen },
    { to: '/hr/search', label: 'Search Records', icon: Search },
    { to: '/hr/notifications', label: 'Notifications', icon: Bell, badgeKey: 'notifications' },
    { to: '/hr/reports', label: 'Generate Reports', icon: FileBarChart },
    { section: 'Account' },
    { to: '/hr/change-password', label: 'Change Password', icon: KeyRound },
  ],
  faculty: [
    { to: '/faculty', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/faculty/201file', label: 'My 201 File', icon: FileText },
    { to: '/faculty/submit', label: 'Submit a Document', icon: UploadCloud },
    { section: 'Account' },
    { to: '/faculty/change-password', label: 'Change Password', icon: KeyRound },
  ],
};
