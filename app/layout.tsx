import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import NextTopLoader from 'nextjs-toploader';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Employee 201 File Management System — LSSTI',
  description: 'Employee 201 File Management System for Lanao School of Science and Technology, Inc.',
  icons: {
    icon: '/assets/logo.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextTopLoader color="#7A1F2B" height={3} showSpinner={false} shadow={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

