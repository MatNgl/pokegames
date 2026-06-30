import type { ReactNode } from 'react';
import LightPillar from './light-pillar';

// Fond des pages vitrines (accueil, connexion, inscription) : LightPillar garde ses couleurs
// d'origine (touche de couleur assumee), avec un voile sombre pour preserver la lisibilite du texte.
export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <LightPillar intensity={0.9} rotationSpeed={0.25} glowAmount={0.0045} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-background/50" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
