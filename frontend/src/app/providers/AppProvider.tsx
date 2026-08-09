import { BrowserRouter } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import '@/shared/i18n';
import { QueryProvider } from './QueryProvider';

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryProvider>
  );
}
