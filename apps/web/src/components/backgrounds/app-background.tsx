import type { ReactNode } from 'react';

// Fond unique du site, style monde Pokemon : ciel degrade, nuages doux, bande d'herbe en bas.
export function AppBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #4aa8ec 0%, #76c9f5 50%, #b9e7ff 78%)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <span
          className="absolute left-[8%] top-[14%] h-16 w-40 rounded-full bg-white/80 blur-md"
          style={{ animation: 'cloud-drift 22s ease-in-out infinite alternate' }}
        />
        <span
          className="absolute left-[62%] top-[10%] h-20 w-56 rounded-full bg-white/75 blur-md"
          style={{ animation: 'cloud-drift 28s ease-in-out infinite alternate' }}
        />
        <span
          className="absolute left-[38%] top-[24%] h-12 w-32 rounded-full bg-white/70 blur-md"
          style={{ animation: 'cloud-drift 25s ease-in-out infinite alternate-reverse' }}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 sm:h-40"
        style={{ background: 'linear-gradient(180deg, #7cc34a 0%, #5da534 100%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
