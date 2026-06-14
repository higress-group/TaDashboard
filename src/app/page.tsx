'use client';

import { HiClawDashboard } from '@/components/dashboard/hi-claw-dashboard';
import { QueryProvider } from '@/lib/query-provider';
import { SearchProvider } from '@/lib/search-context';
import { ThemeProvider } from 'next-themes';

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <SearchProvider>
          <HiClawDashboard />
        </SearchProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
