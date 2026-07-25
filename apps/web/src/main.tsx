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

// Le build prerend les balises SEO de chaque route (pour les crawlers sans JavaScript). Des que
// l'app demarre, c'est le composant <Seo> qui les gere : on retire les balises statiques, sinon
// React ajoute les siennes par-dessus et la page se retrouve avec deux canonical et deux description.
document.querySelectorAll('[data-prerendered]').forEach((el) => el.remove());

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
