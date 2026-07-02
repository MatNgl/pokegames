import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppBackground } from '@/components/backgrounds/app-background';
import { AppHeader } from '@/components/layout/app-header';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { HOME_GAMES } from './games-list';

type Level = 'FACILE' | 'MOYEN' | 'DIFFICILE' | 'EXTREME';

const LEVELS: { key: Level; label: string; tagline: string }[] = [
  { key: 'FACILE', label: 'Facile', tagline: 'Tranquille : parfait pour débuter la journée.' },
  { key: 'MOYEN', label: 'Moyen', tagline: 'Un cran au-dessus, reste concentré.' },
  { key: 'DIFFICILE', label: 'Difficile', tagline: 'Ça se corse, les erreurs coûtent cher.' },
  { key: 'EXTREME', label: 'Extrême', tagline: 'Zone rouge. Seuls les meilleurs survivent.' },
];

const TAB_STYLE: Record<Level, string> = {
  FACILE: 'border-go-shadow bg-go text-go-foreground',
  MOYEN: 'border-primary-shadow bg-primary text-primary-foreground',
  DIFFICILE: 'border-[#9a3412] bg-[#ea580c] text-white',
  EXTREME: 'border-danger bg-danger text-white',
};

const CARD_STYLE: Record<Level, { card: string; title: string; bar: string; desc: string }> = {
  FACILE: {
    card: 'border-go bg-surface',
    title: 'text-foreground',
    bar: 'bg-go text-go-foreground',
    desc: 'text-muted',
  },
  MOYEN: {
    card: 'border-primary bg-surface',
    title: 'text-foreground',
    bar: 'bg-primary text-primary-foreground',
    desc: 'text-muted',
  },
  DIFFICILE: {
    card: 'border-[#c2410c] bg-[#fff3e6]',
    title: 'text-[#9a3412]',
    bar: 'bg-[#ea580c] text-white',
    desc: 'text-[#9a3412]/80',
  },
  EXTREME: {
    card: 'border-danger bg-[#1f1a1a] shadow-[0_0_22px_rgba(238,21,21,0.55)]',
    title: 'text-danger',
    bar: 'bg-danger text-white',
    desc: 'text-surface/70',
  },
};

// Variante B : un selecteur de niveau global restyle toutes les cartes ; l'Extreme fait peur.
export function LevelHome() {
  const [level, setLevel] = useState<Level>('FACILE');
  const style = CARD_STYLE[level];
  const isExtreme = level === 'EXTREME';

  return (
    <AppBackground>
      <div className={cn('flex min-h-screen flex-col transition-colors', isExtreme && 'bg-black/30')}>
        <AppHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-8">
          <h1
            className={cn('font-display text-2xl', isExtreme ? 'text-danger' : 'text-accent')}
            style={{ textShadow: isExtreme ? '0 0 14px rgba(238,21,21,0.7)' : '2px 2px 0 #28338c' }}
          >
            PokéGames
          </h1>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLevel(l.key)}
                className={cn(
                  'rounded-control border-2 px-4 py-1.5 font-display text-[10px] uppercase transition-all',
                  level === l.key
                    ? TAB_STYLE[l.key]
                    : 'border-border-strong bg-surface/80 text-muted hover:text-foreground',
                  l.key === 'EXTREME' && level === l.key && 'animate-pulse',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>

          <p
            className={cn(
              'mt-4 text-center font-semibold',
              isExtreme ? 'text-danger' : 'text-white',
            )}
            style={isExtreme ? undefined : { textShadow: '1px 1px 0 #28338c' }}
          >
            {LEVELS.find((l) => l.key === level)?.tagline}
          </p>

          <div className="mt-6 grid w-full gap-4 sm:grid-cols-2">
            {HOME_GAMES.filter((g) => g.title !== 'Qui est-ce').map((game) => (
              <Link key={game.title} to={game.to}>
                <Card
                  className={cn(
                    'flex h-full flex-col gap-3 border-4 p-4 transition-all duration-200 hover:-translate-y-0.5',
                    style.card,
                    isExtreme && 'hover:shadow-[0_0_28px_rgba(238,21,21,0.8)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className={cn('font-display text-[11px] uppercase leading-relaxed sm:text-xs', style.title)}>
                      {game.title}
                    </h2>
                    {isExtreme && <span className="font-display text-[9px] text-danger">⚠ EXTRÊME</span>}
                  </div>
                  <div className={cn('flex items-center gap-2 rounded-full px-3 py-2', style.bar)}>
                    <img src={game.iconImg} alt="" className="h-7 w-7 shrink-0 object-contain" draggable={false} />
                    <span className="min-w-0 truncate text-sm font-bold">{game.description}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </AppBackground>
  );
}
