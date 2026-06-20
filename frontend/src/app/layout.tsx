import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import Providers from '../components/Providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: {
    default: 'InsightForge | Location Intelligence & Demographics SaaS',
    template: '%s | InsightForge',
  },
  description: 'Self-serve market intelligence and demographic report generator for retail chains and business expansion.',
  keywords: ['location intelligence', 'demographics', 'market research', 'retail analytics', 'site selection'],
  authors: [{ name: 'InsightForge Team' }],
  openGraph: {
    title: 'InsightForge | Market Intelligence Reports',
    description: 'Generate instant location intelligence reports with demographics, competitor mapping, and footfall estimates.',
    type: 'website',
    url: 'https://insightforge.com',
    siteName: 'InsightForge',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
  }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-200`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
