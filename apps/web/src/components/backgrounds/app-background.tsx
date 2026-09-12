import type { ReactNode } from 'react';
import backgroundImg from '@/assets/background.png';

// Fond unique du site : image plein ecran (cover), immobile pendant le defilement.
// La couche est en `position: fixed` plutot qu'en `background-attachment: fixed`, que les
// navigateurs mobiles ignorent : le fond restait alors colle en haut du document et le bleu de
// `body` apparaissait des qu'on defilait au-dela d'une hauteur d'ecran.
export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImg})` }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
