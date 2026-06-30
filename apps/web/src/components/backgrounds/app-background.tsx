import type { ReactNode } from 'react';
import backgroundImg from '@/assets/background.png';

// Fond unique du site : image plein ecran (cover), fixe au scroll. Le contenu passe par-dessus.
export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative min-h-screen w-full bg-contain bg-top bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundImg})`, backgroundColor: '#57b9f2' }}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
