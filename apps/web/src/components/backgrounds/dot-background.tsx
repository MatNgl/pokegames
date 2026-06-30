import type { CSSProperties, ReactNode } from 'react';

// Fond classique des parties : grille de points discrete sur le fond profond (adaptee au theme sombre).
const dotStyle: CSSProperties = {
  backgroundColor: '#0b0e14',
  backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.06) 1.5px, transparent 0)',
  backgroundSize: '28px 28px',
  backgroundPosition: '-5px -5px',
};

export function DotBackground({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full" style={dotStyle}>
      {children}
    </div>
  );
}
