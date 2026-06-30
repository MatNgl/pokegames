import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/press-start-2p';
import '@fontsource-variable/nunito';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from '@/features/auth/auth-context';
import { queryClient } from '@/lib/query-client';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Element racine introuvable");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
