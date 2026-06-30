import type { ReactNode } from 'react';
import LightPillar from './light-pillar';

// Fond des pages de selection des jeux et d'authentification : LightPillar garde ses couleurs
// d'origine (touche de couleur assumee). Parametres valides par le porteur du projet.
export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <LightPillar
          pillarWidth={5.6}
          rotationSpeed={0.4}
          pillarHeight={0.5}
          pillarRotation={32}
          mixBlendMode="normal"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-background/30" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
